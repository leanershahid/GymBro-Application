using System.Text.Json;
using GymManagmentApplication.Application.Billing.Requests;
using GymManagmentApplication.Application.Billing.Services;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Training;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Scheduling;

/// <summary>
/// Personal training: trainers define session types (duration, price); members, trainers or
/// staff book sessions without clashing with the trainer's other sessions/classes or time off;
/// a priced session raises an invoice for the member; completed sessions feed trainer earnings.
/// </summary>
public class PtService(AppDbContext db, ICurrentUser currentUser, BillingCore billing)
{
    // ── Session types ───────────────────────────────────────────────────────

    public async Task<List<PtTypeResponse>> GetTypesAsync(ulong? trainerId)
    {
        var q = db.PtSessionTypes.Include(t => t.Trainer).AsQueryable();
        if (trainerId is { } tid) q = q.Where(t => t.TrainerId == tid);
        if (currentUser.IsClient()) q = q.Where(t => t.IsActive);
        return (await q.OrderBy(t => t.Trainer.DisplayName).ThenBy(t => t.Price).ToListAsync()).Select(Map).ToList();
    }

    public async Task<PtTypeResponse> SaveTypeAsync(ulong? id, PtTypeRequest r)
    {
        if (string.IsNullOrWhiteSpace(r.Name)) throw new ArgumentException("Give the session type a name.");
        if (r.DurationMin is < 15 or > 300) throw new ArgumentException("Duration must be between 15 and 300 minutes.");
        if (r.Price < 0) throw new ArgumentException("Price can't be negative.");

        PtSessionType type;
        if (id is null)
        {
            var trainerId = await TrainerForWriteAsync(r.TrainerId);
            var tenantId = currentUser.ResolveTenantId();
            var currency = await db.Tenants.Where(t => t.Id == tenantId).Select(t => t.Currency).FirstOrDefaultAsync() ?? "INR";
            type = db.PtSessionTypes.Add(new PtSessionType { TenantId = tenantId, TrainerId = trainerId, Currency = currency, Name = r.Name }).Entity;
        }
        else
        {
            type = await db.PtSessionTypes.FirstOrDefaultAsync(t => t.Id == id) ?? throw new KeyNotFoundException("Session type not found.");
            await TrainerForWriteAsync(type.TrainerId);
        }
        type.Name = r.Name.Trim();
        type.DurationMin = r.DurationMin;
        type.Price = BillingCore.Round(r.Price);
        type.Description = r.Description?.Trim();
        type.IsActive = r.IsActive;
        await db.SaveChangesAsync();
        await db.Entry(type).Reference(t => t.Trainer).LoadAsync();
        return Map(type);
    }

    // ── Sessions ────────────────────────────────────────────────────────────

    public async Task<List<PtSessionResponse>> GetSessionsAsync(DateTime? from, DateTime? to, ulong? trainerId, ulong? clientId)
    {
        var q = Query();
        if (currentUser.IsClient()) q = q.Where(s => s.ClientId == currentUser.UserId);
        else if (currentUser.IsTrainer()) q = q.Where(s => s.Trainer.UserId == currentUser.UserId);
        if (trainerId is { } t) q = q.Where(s => s.TrainerId == t);
        if (clientId is { } c) q = q.Where(s => s.ClientId == c);
        if (from is { } f) q = q.Where(s => s.StartsAt >= f);
        if (to is { } e) q = q.Where(s => s.StartsAt < e);
        var rows = await q.OrderBy(s => s.StartsAt).Take(300).ToListAsync();
        return await MapManyAsync(rows);
    }

    public async Task<PtSessionResponse> BookAsync(BookPtRequest r)
    {
        var type = await db.PtSessionTypes.Include(t => t.Trainer).FirstOrDefaultAsync(t => t.Id == r.SessionTypeId && t.IsActive)
                   ?? throw new ArgumentException("Choose an available session type.");
        if (currentUser.IsTrainer() && type.Trainer.UserId != currentUser.UserId)
            throw new UnauthorizedAccessException("You can only book your own sessions.");
        var clientId = currentUser.IsClient() ? currentUser.UserId!.Value : r.ClientId ?? throw new ArgumentException("Choose the member.");
        var client = await db.Users.FirstOrDefaultAsync(u => u.Id == clientId && u.DeletedAt == null) ?? throw new KeyNotFoundException("Member not found.");
        if (r.StartsAt <= DateTime.UtcNow) throw new ArgumentException("Pick a time in the future.");
        if (await MembershipRules.BlockReasonAsync(db, clientId, DateOnly.FromDateTime(r.StartsAt)) is { } blocked)
            throw new ArgumentException(blocked);

        var start = r.StartsAt;
        var end = start.AddMinutes(type.DurationMin);
        await EnsureTrainerFreeAsync(type.TrainerId, start, end, null);
        if (await db.PtSessions.AnyAsync(s => s.ClientId == clientId && s.Status != PtSessionStatus.Cancelled && s.StartsAt < end && s.EndsAt > start))
            throw new ArgumentException("The member already has a session at that time.");

        var session = new PtSession
        {
            TenantId = type.TenantId, BranchId = type.Trainer.BranchId, SessionTypeId = type.Id, TrainerId = type.TrainerId,
            ClientId = clientId, StartsAt = start, EndsAt = end, Price = type.Price, Notes = r.Notes?.Trim(),
            Status = currentUser.IsClient() ? PtSessionStatus.Booked : PtSessionStatus.Confirmed,
        };
        db.PtSessions.Add(session);
        await db.SaveChangesAsync();

        if (type.Price > 0)
        {
            await billing.CreateInvoiceAsync(new BillingCore.NewInvoice(type.TenantId, clientId,
                [new InvoiceLineItem { Description = $"{type.Name} with {type.Trainer.DisplayName} on {start:dd MMM yyyy HH:mm} UTC", UnitPrice = type.Price, Quantity = 1 }],
                DueDate: DateOnly.FromDateTime(start), Notes: $"PT session #{session.Id}"));
            await db.SaveChangesAsync();
        }
        return (await MapManyAsync([await Query().FirstAsync(s => s.Id == session.Id)]))[0];
    }

    public async Task<PtSessionResponse> UpdateStatusAsync(ulong id, UpdatePtStatusRequest r)
    {
        var s = await Query().FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Session not found.");
        var status = r.Status?.Trim().ToLowerInvariant() switch
        {
            "confirmed" => PtSessionStatus.Confirmed,
            "completed" => PtSessionStatus.Completed,
            "cancelled" or "canceled" => PtSessionStatus.Cancelled,
            "noshow" or "no-show" => PtSessionStatus.NoShow,
            _ => throw new ArgumentException("Status must be confirmed, completed, cancelled or noshow."),
        };

        if (currentUser.IsClient())
        {
            if (s.ClientId != currentUser.UserId) throw new UnauthorizedAccessException("Not your session.");
            if (status != PtSessionStatus.Cancelled) throw new UnauthorizedAccessException("You can only cancel your session.");
        }
        else if (currentUser.IsTrainer() && s.Trainer.UserId != currentUser.UserId)
            throw new UnauthorizedAccessException("Not your session.");

        if (s.Status is PtSessionStatus.Cancelled or PtSessionStatus.Completed)
            throw new ArgumentException($"This session is already {s.Status.ToString().ToLower()}.");
        if (status is PtSessionStatus.Completed or PtSessionStatus.NoShow && s.StartsAt > DateTime.UtcNow)
            throw new ArgumentException("A session can only be completed after it starts.");

        s.Status = status;
        if (r.TrainerNotes is not null && !currentUser.IsClient()) s.TrainerNotes = r.TrainerNotes.Trim();
        if (status == PtSessionStatus.Completed)
        {
            s.Trainer.TotalSessions++;
        }
        if (status == PtSessionStatus.Cancelled)
        {
            // An unpaid invoice raised for this session is voided with it.
            var note = $"PT session #{s.Id}";
            var inv = await db.Invoices.FirstOrDefaultAsync(i => i.UserId == s.ClientId && i.Notes == note && i.AmountPaid == 0
                                                                 && (i.Status == InvoiceStatus.Sent || i.Status == InvoiceStatus.Overdue));
            if (inv is not null) inv.Status = InvoiceStatus.Void;
        }
        await db.SaveChangesAsync();
        return (await MapManyAsync([s]))[0];
    }

    public async Task<PtSessionResponse> RateAsync(ulong id, RatePtRequest r)
    {
        if (r.Rating is < 1 or > 5) throw new ArgumentException("Rate from 1 to 5 stars.");
        var s = await Query().FirstOrDefaultAsync(x => x.Id == id && x.ClientId == currentUser.UserId)
                ?? throw new KeyNotFoundException("Session not found.");
        if (s.Status != PtSessionStatus.Completed) throw new ArgumentException("You can rate a session once it's completed.");
        s.Rating = r.Rating;
        await db.SaveChangesAsync();

        // Trainer rating = average of rated sessions.
        var ratings = await db.PtSessions.Where(x => x.TrainerId == s.TrainerId && x.Rating != null).Select(x => (int)x.Rating!).ToListAsync();
        s.Trainer.Rating = ratings.Count == 0 ? null : Math.Round((decimal)ratings.Average(), 2);
        await db.SaveChangesAsync();
        return (await MapManyAsync([s]))[0];
    }

    /// <summary>Trainer earnings for a month: completed sessions' price, and the PT commission % from the trainer's settings.</summary>
    public async Task<(decimal Total, decimal Commission, int Sessions)> EarningsAsync(ulong trainerId, int month, int year)
    {
        var from = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
        var sessions = await db.PtSessions.Where(s => s.TrainerId == trainerId && s.Status == PtSessionStatus.Completed
                                                      && s.StartsAt >= from && s.StartsAt < from.AddMonths(1))
            .Select(s => s.Price ?? 0).ToListAsync();
        var total = sessions.Sum();
        var trainer = await db.TrainerProfiles.FirstOrDefaultAsync(t => t.Id == trainerId);
        decimal pct = 0;
        if (trainer?.CommissionSettings?.RootElement is { ValueKind: JsonValueKind.Object } cs
            && cs.TryGetProperty("ptCommissionPercentage", out var p) && p.TryGetDecimal(out var v)
            && (!cs.TryGetProperty("eligibleForPersonalTrainingCommission", out var e) || e.ValueKind != JsonValueKind.False))
            pct = v;
        return (total, BillingCore.Round(total * pct / 100m), sessions.Count);
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private IQueryable<PtSession> Query() =>
        db.PtSessions.Include(s => s.SessionType).Include(s => s.Trainer).Include(s => s.Client);

    /// <summary>Trainers act for themselves; admins/staff for any trainer of the gym.</summary>
    private async Task<ulong> TrainerForWriteAsync(ulong? requested)
    {
        if (currentUser.IsClient()) throw new UnauthorizedAccessException("Only trainers and staff can manage session types.");
        if (currentUser.IsTrainer())
        {
            var mine = await db.TrainerProfiles.Where(t => t.UserId == currentUser.UserId).Select(t => (ulong?)t.Id).FirstOrDefaultAsync()
                       ?? throw new ArgumentException("Your trainer profile wasn't found.");
            if (requested is not null && requested != mine) throw new UnauthorizedAccessException("You can only manage your own session types.");
            return mine;
        }
        if (requested is null or 0) throw new ArgumentException("Choose the trainer.");
        return await db.TrainerProfiles.AnyAsync(t => t.Id == requested) ? requested.Value : throw new ArgumentException("Choose a trainer of this gym.");
    }

    private async Task EnsureTrainerFreeAsync(ulong trainerId, DateTime start, DateTime end, ulong? ignoreSessionId)
    {
        if (await db.PtSessions.AnyAsync(s => s.TrainerId == trainerId && s.Id != ignoreSessionId && s.Status != PtSessionStatus.Cancelled
                                              && s.StartsAt < end && s.EndsAt > start))
            throw new ArgumentException("The trainer is already booked at that time.");
        if (await db.GymClasses.AnyAsync(c => c.TrainerId == trainerId && c.Status != ClassStatus.Cancelled && c.StartsAt < end && c.EndsAt > start))
            throw new ArgumentException("The trainer teaches a class at that time.");
        if (await db.TrainerTimeOffs.AnyAsync(o => o.TrainerId == trainerId && o.Status != TimeOffStatus.Rejected && o.StartsAt < end && o.EndsAt > start))
            throw new ArgumentException("The trainer is off at that time.");
    }

    private static PtTypeResponse Map(PtSessionType t) => new()
    {
        Id = t.Id, TrainerId = t.TrainerId, TrainerName = t.Trainer?.DisplayName, Name = t.Name,
        DurationMin = t.DurationMin, Price = t.Price, Currency = t.Currency, Description = t.Description, IsActive = t.IsActive,
    };

    private async Task<List<PtSessionResponse>> MapManyAsync(List<PtSession> rows)
    {
        var notes = rows.Select(r => $"PT session #{r.Id}").ToList();
        var invoices = await db.Invoices.Where(i => i.Notes != null && notes.Contains(i.Notes))
            .Select(i => new { i.Id, i.Notes }).ToListAsync();
        return rows.Select(s => new PtSessionResponse
        {
            Id = s.Id, SessionTypeId = s.SessionTypeId, SessionTypeName = s.SessionType.Name,
            TrainerId = s.TrainerId, TrainerName = s.Trainer.DisplayName,
            ClientId = s.ClientId, ClientName = $"{s.Client.FirstName} {s.Client.LastName}".Trim(),
            StartsAt = s.StartsAt, EndsAt = s.EndsAt, Status = s.Status.ToString(),
            Price = s.Price, Currency = s.SessionType.Currency, Notes = s.Notes, TrainerNotes = s.TrainerNotes, Rating = s.Rating,
            InvoiceId = invoices.FirstOrDefault(i => i.Notes == $"PT session #{s.Id}")?.Id,
        }).ToList();
    }
}
