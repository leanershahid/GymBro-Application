using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Scheduling;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Scheduling;

/// <summary>
/// Group classes: class types, a schedule (with weekly series), member booking with a waitlist
/// that is promoted automatically when someone cancels, and roster / attendance for staff.
/// </summary>
public class ClassService(AppDbContext db, ICurrentUser currentUser, GymManagmentApplication.Application.Engagement.Notifier notifier)
{
    private const int MaxRepeatWeeks = 26;

    // ── Class types ─────────────────────────────────────────────────────────

    public async Task<List<ClassTypeResponse>> GetTypesAsync(bool includeInactive) =>
        (await db.ClassTypes.Where(t => includeInactive || t.IsActive).OrderBy(t => t.Name).ToListAsync()).Select(Map).ToList();

    public async Task<ClassTypeResponse> SaveTypeAsync(ulong? id, ClassTypeRequest r)
    {
        if (string.IsNullOrWhiteSpace(r.Name)) throw new ArgumentException("Give the class type a name.");
        if (r.DurationMin is <= 0 or > 600) throw new ArgumentException("Duration must be between 1 and 600 minutes.");
        if (r.MaxCapacity is <= 0) throw new ArgumentException("Capacity must be at least 1 (or empty for no limit).");
        var type = id is null
            ? db.ClassTypes.Add(new ClassType { TenantId = currentUser.ResolveTenantId(), Name = r.Name }).Entity
            : await db.ClassTypes.FirstOrDefaultAsync(t => t.Id == id) ?? throw new KeyNotFoundException("Class type not found.");
        type.Name = r.Name.Trim();
        type.Description = r.Description?.Trim();
        type.DurationMin = r.DurationMin;
        type.MaxCapacity = r.MaxCapacity;
        type.Color = r.Color;
        type.IsActive = r.IsActive;
        await db.SaveChangesAsync();
        return Map(type);
    }

    // ── Schedule ────────────────────────────────────────────────────────────

    public async Task<List<ClassResponse>> GetScheduleAsync(DateTime from, DateTime to, ulong? branchId, ulong? trainerId)
    {
        if (to <= from) to = from.AddDays(7);
        if ((to - from).TotalDays > 62) to = from.AddDays(62);
        var q = Query().Where(c => c.StartsAt >= from && c.StartsAt < to);
        if (branchId is { } b) q = q.Where(c => c.BranchId == b);
        if (trainerId is { } t) q = q.Where(c => c.TrainerId == t);
        if (currentUser.IsClient()) q = q.Where(c => c.Status != ClassStatus.Cancelled || c.Bookings.Any(x => x.ClientId == Me));
        var classes = await q.OrderBy(c => c.StartsAt).Take(500).ToListAsync();
        return await MapManyAsync(classes);
    }

    public async Task<List<ClassResponse>> CreateAsync(CreateClassRequest r)
    {
        var tenantId = currentUser.ResolveTenantId();
        var type = await db.ClassTypes.FirstOrDefaultAsync(t => t.Id == r.ClassTypeId && t.IsActive)
                   ?? throw new ArgumentException("Choose an active class type.");
        if (!await db.Branches.AnyAsync(b => b.Id == r.BranchId)) throw new ArgumentException("Choose a branch of this gym.");
        var trainerId = await ResolveTrainerAsync(r.TrainerId);
        if (r.RepeatWeeks is < 0 or > MaxRepeatWeeks) throw new ArgumentException($"Repeat for 0–{MaxRepeatWeeks} weeks.");
        if (r.StartsAt < DateTime.UtcNow.AddMinutes(-5)) throw new ArgumentException("A class can't start in the past.");
        var duration = r.DurationMin ?? type.DurationMin ?? 60;
        if (duration is <= 0 or > 600) throw new ArgumentException("Duration must be between 1 and 600 minutes.");

        var created = new List<GymClass>();
        for (var week = 0; week <= r.RepeatWeeks; week++)
        {
            var start = r.StartsAt.AddDays(7 * week);
            var c = new GymClass
            {
                TenantId = tenantId, BranchId = r.BranchId, ClassTypeId = type.Id, TrainerId = trainerId,
                Title = string.IsNullOrWhiteSpace(r.Title) ? null : r.Title.Trim(),
                StartsAt = start, EndsAt = start.AddMinutes(duration),
                MaxCapacity = r.MaxCapacity ?? type.MaxCapacity, Notes = r.Notes,
                RecurrenceRule = r.RepeatWeeks > 0 ? "FREQ=WEEKLY" : null,
            };
            if (trainerId is { } tid) await EnsureTrainerFreeAsync(tid, c.StartsAt, c.EndsAt, null);
            db.GymClasses.Add(c);
            created.Add(c);
        }
        await db.SaveChangesAsync();
        if (created.Count > 1)
        {
            foreach (var c in created) c.RecurrenceId = created[0].Id; // series id = first class id
            await db.SaveChangesAsync();
        }
        return await MapManyAsync(await Query().Where(c => created.Select(x => x.Id).Contains(c.Id)).ToListAsync());
    }

    public async Task<ClassResponse> UpdateAsync(ulong id, UpdateClassRequest r)
    {
        var c = await Query().FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Class not found.");
        if (c.Status == ClassStatus.Cancelled) throw new ArgumentException("This class was cancelled.");
        EnsureCanManage(c);
        var duration = r.DurationMin ?? (short)(c.EndsAt - c.StartsAt).TotalMinutes;
        if (r.StartsAt is { } start) c.StartsAt = start;
        c.EndsAt = c.StartsAt.AddMinutes(duration);
        if (r.TrainerId is not null) c.TrainerId = await ResolveTrainerAsync(r.TrainerId);
        if (r.Title is not null) c.Title = string.IsNullOrWhiteSpace(r.Title) ? null : r.Title.Trim();
        if (r.Notes is not null) c.Notes = r.Notes;
        if (r.MaxCapacity is { } cap)
        {
            var booked = c.Bookings.Count(b => b.Status is BookingStatus.Booked or BookingStatus.Attended);
            if (cap < booked) throw new ArgumentException($"{booked} people are already booked; capacity can't go below that.");
            c.MaxCapacity = cap;
        }
        if (c.TrainerId is { } tid) await EnsureTrainerFreeAsync(tid, c.StartsAt, c.EndsAt, c.Id);
        PromoteWaitlist(c);
        await db.SaveChangesAsync();
        return (await MapManyAsync([c]))[0];
    }

    public async Task<int> CancelAsync(ulong id, CancelClassRequest r)
    {
        var c = await db.GymClasses.FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Class not found.");
        EnsureCanManage(c);
        var targets = r.WholeSeries && c.RecurrenceId is { } series
            ? await db.GymClasses.Include(x => x.Bookings).Where(x => x.RecurrenceId == series && x.StartsAt >= c.StartsAt && x.Status != ClassStatus.Cancelled).ToListAsync()
            : await db.GymClasses.Include(x => x.Bookings).Where(x => x.Id == id).ToListAsync();
        foreach (var t in targets)
        {
            t.Status = ClassStatus.Cancelled;
            if (!string.IsNullOrWhiteSpace(r.Reason)) t.Notes = $"Cancelled: {r.Reason.Trim()}";
            foreach (var b in t.Bookings.Where(b => b.Status is BookingStatus.Booked or BookingStatus.Waitlisted))
            {
                b.Status = BookingStatus.Cancelled;
                b.CancelledAt = DateTime.UtcNow;
                notifier.Add(t.TenantId, b.ClientId, "Class cancelled",
                    $"{t.Title ?? "Your class"} on {t.StartsAt:dd MMM HH:mm} UTC was cancelled.{(string.IsNullOrWhiteSpace(r.Reason) ? "" : " " + r.Reason.Trim())}", "booking", t.Id);
            }
            Recount(t);
        }
        await db.SaveChangesAsync();
        return targets.Count;
    }

    // ── Booking ─────────────────────────────────────────────────────────────

    public async Task<ClassResponse> BookAsync(ulong classId, BookClassRequest r)
    {
        var clientId = currentUser.IsClient() ? Me : r.ClientId ?? throw new ArgumentException("Choose the member to book.");
        var c = await Query().FirstOrDefaultAsync(x => x.Id == classId) ?? throw new KeyNotFoundException("Class not found.");
        if (c.Status == ClassStatus.Cancelled) throw new ArgumentException("This class was cancelled.");
        if (c.StartsAt <= DateTime.UtcNow) throw new ArgumentException("This class has already started.");
        if (!currentUser.IsClient() && !await db.Users.AnyAsync(u => u.Id == clientId && u.DeletedAt == null))
            throw new KeyNotFoundException("Member not found.");
        if (await MembershipRules.BlockReasonAsync(db, clientId, DateOnly.FromDateTime(c.StartsAt)) is { } blocked)
            throw new ArgumentException(blocked);

        var existing = c.Bookings.FirstOrDefault(b => b.ClientId == clientId && b.Status is BookingStatus.Booked or BookingStatus.Waitlisted);
        if (existing is not null)
            throw new ArgumentException(existing.Status == BookingStatus.Booked ? "Already booked for this class." : "Already on the waitlist.");

        var full = c.MaxCapacity is { } cap && c.Bookings.Count(b => b.Status == BookingStatus.Booked) >= cap;
        c.Bookings.Add(new ClassBooking
        {
            TenantId = c.TenantId, ClassId = c.Id, ClientId = clientId,
            Status = full ? BookingStatus.Waitlisted : BookingStatus.Booked,
        });
        Recount(c);
        await db.SaveChangesAsync();
        return (await MapManyAsync([c], clientId))[0];
    }

    public async Task<ClassResponse> CancelBookingAsync(ulong classId, ulong? clientIdForStaff)
    {
        var clientId = currentUser.IsClient() ? Me : clientIdForStaff ?? throw new ArgumentException("Choose the member.");
        var c = await Query().FirstOrDefaultAsync(x => x.Id == classId) ?? throw new KeyNotFoundException("Class not found.");
        var booking = c.Bookings.FirstOrDefault(b => b.ClientId == clientId && b.Status is BookingStatus.Booked or BookingStatus.Waitlisted)
                      ?? throw new ArgumentException("No booking to cancel.");
        if (currentUser.IsClient() && c.StartsAt <= DateTime.UtcNow) throw new ArgumentException("This class has already started.");
        booking.Status = BookingStatus.Cancelled;
        booking.CancelledAt = DateTime.UtcNow;
        PromoteWaitlist(c);
        await db.SaveChangesAsync();
        return (await MapManyAsync([c], clientId))[0];
    }

    public async Task<List<ClassResponse>> GetMyBookingsAsync()
    {
        var since = DateTime.UtcNow.AddDays(-30);
        var classes = await Query()
            .Where(c => c.StartsAt >= since && c.Bookings.Any(b => b.ClientId == Me && b.Status != BookingStatus.Cancelled))
            .OrderBy(c => c.StartsAt).Take(200).ToListAsync();
        return await MapManyAsync(classes, Me);
    }

    // ── Roster / attendance ─────────────────────────────────────────────────

    public async Task<List<RosterEntryResponse>> GetRosterAsync(ulong classId)
    {
        var c = await db.GymClasses.FirstOrDefaultAsync(x => x.Id == classId) ?? throw new KeyNotFoundException("Class not found.");
        EnsureCanManage(c);
        return await db.ClassBookings.Where(b => b.ClassId == classId && b.Status != BookingStatus.Cancelled)
            .OrderBy(b => b.Status).ThenBy(b => b.BookedAt)
            .Select(b => new RosterEntryResponse
            {
                BookingId = b.Id, ClientId = b.ClientId, Status = b.Status.ToString(), BookedAt = b.BookedAt,
                ClientName = (b.Client.FirstName + " " + b.Client.LastName).Trim(),
            }).ToListAsync();
    }

    public async Task MarkAttendanceAsync(ulong classId, MarkAttendanceRequest r)
    {
        var c = await Query().FirstOrDefaultAsync(x => x.Id == classId) ?? throw new KeyNotFoundException("Class not found.");
        EnsureCanManage(c);
        var b = c.Bookings.FirstOrDefault(x => x.ClientId == r.ClientId && x.Status != BookingStatus.Cancelled && x.Status != BookingStatus.Waitlisted)
                ?? throw new ArgumentException("That member isn't booked for this class.");
        b.Status = r.Attended ? BookingStatus.Attended : BookingStatus.NoShow;
        await db.SaveChangesAsync();
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private ulong Me => currentUser.UserId ?? throw new UnauthorizedAccessException("Please sign in again.");

    private IQueryable<GymClass> Query() =>
        db.GymClasses.Include(c => c.ClassType).Include(c => c.Branch).Include(c => c.Trainer).Include(c => c.Bookings);

    /// <summary>Moves people off the waitlist (first come, first served) while there's room.</summary>
    private void PromoteWaitlist(GymClass c)
    {
        foreach (var w in c.Bookings.Where(b => b.Status == BookingStatus.Waitlisted).OrderBy(b => b.BookedAt))
        {
            if (c.MaxCapacity is { } cap && c.Bookings.Count(b => b.Status == BookingStatus.Booked) >= cap) break;
            w.Status = BookingStatus.Booked;
            notifier.Add(c.TenantId, w.ClientId, "You're in!",
                $"A spot opened up in {c.Title ?? c.ClassType?.Name ?? "your class"} on {c.StartsAt:dd MMM HH:mm} UTC.", "booking", c.Id);
        }
        Recount(c);
    }

    private static void Recount(GymClass c)
    {
        c.EnrolledCount = (short)c.Bookings.Count(b => b.Status is BookingStatus.Booked or BookingStatus.Attended);
        c.WaitlistCount = (short)c.Bookings.Count(b => b.Status == BookingStatus.Waitlisted);
    }

    /// <summary>Trainers may only change classes they teach; admins/staff any.</summary>
    private void EnsureCanManage(GymClass c)
    {
        if (currentUser.IsClient()) throw new UnauthorizedAccessException("Only staff can manage classes.");
        if (currentUser.IsTrainer() && c.Trainer?.UserId != currentUser.UserId && c.TrainerId is not null)
            throw new UnauthorizedAccessException("You can only manage classes you teach.");
    }

    /// <summary>Trainers creating classes teach them themselves.</summary>
    private async Task<ulong?> ResolveTrainerAsync(ulong? requested)
    {
        if (currentUser.IsTrainer())
            return await db.TrainerProfiles.Where(t => t.UserId == currentUser.UserId).Select(t => (ulong?)t.Id).FirstOrDefaultAsync()
                   ?? throw new ArgumentException("Your trainer profile wasn't found.");
        if (requested is null or 0) return null;
        return await db.TrainerProfiles.AnyAsync(t => t.Id == requested) ? requested : throw new ArgumentException("Choose a trainer of this gym.");
    }

    private async Task EnsureTrainerFreeAsync(ulong trainerId, DateTime start, DateTime end, ulong? ignoreClassId)
    {
        if (await db.GymClasses.AnyAsync(c => c.TrainerId == trainerId && c.Id != ignoreClassId && c.Status != ClassStatus.Cancelled
                                              && c.StartsAt < end && c.EndsAt > start))
            throw new ArgumentException($"The trainer already teaches a class at {start:dd MMM HH:mm} (UTC).");
        if (await db.PtSessions.AnyAsync(p => p.TrainerId == trainerId && p.Status != PtSessionStatus.Cancelled
                                              && p.StartsAt < end && p.EndsAt > start))
            throw new ArgumentException($"The trainer has a personal-training session at {start:dd MMM HH:mm} (UTC).");
    }

    private static ClassTypeResponse Map(ClassType t) => new()
    {
        Id = t.Id, Name = t.Name, Description = t.Description, DurationMin = t.DurationMin,
        MaxCapacity = t.MaxCapacity, Color = t.Color, IsActive = t.IsActive,
    };

    private Task<List<ClassResponse>> MapManyAsync(List<GymClass> classes, ulong? forClient = null)
    {
        var client = forClient ?? (currentUser.IsClient() ? currentUser.UserId : null);
        return Task.FromResult(classes.Select(c => new ClassResponse
        {
            Id = c.Id, ClassTypeId = c.ClassTypeId, ClassTypeName = c.ClassType.Name,
            Title = c.Title ?? c.ClassType.Name, Color = c.ClassType.Color,
            BranchId = c.BranchId, BranchName = c.Branch?.Name,
            TrainerId = c.TrainerId, TrainerName = c.Trainer?.DisplayName,
            StartsAt = c.StartsAt, EndsAt = c.EndsAt, Capacity = c.MaxCapacity,
            Booked = c.Bookings.Count(b => b.Status is BookingStatus.Booked or BookingStatus.Attended),
            Waitlisted = c.Bookings.Count(b => b.Status == BookingStatus.Waitlisted),
            Status = c.Status.ToString(), SeriesId = c.RecurrenceId, Notes = c.Notes,
            MyBooking = client is null ? null
                : c.Bookings.Where(b => b.ClientId == client && b.Status != BookingStatus.Cancelled).Select(b => b.Status.ToString()).FirstOrDefault(),
        }).ToList());
    }
}
