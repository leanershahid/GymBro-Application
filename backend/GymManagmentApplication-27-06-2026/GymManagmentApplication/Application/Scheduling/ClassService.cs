using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Scheduling;
using GymManagmentApplication.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Scheduling;

/// <summary>
/// Group classes: class types, a schedule (with weekly series), member booking with a waitlist
/// that is promoted automatically when someone cancels — or, with the gym's "offer" waitlist
/// mode, offered with a claim window (<see cref="WaitlistOfferService"/>) — and roster / attendance for staff.
/// </summary>
public class ClassService(IAppDbContext db, ICurrentUser currentUser, GymManagmentApplication.Application.Engagement.Notifier notifier,
    GymManagmentApplication.Application.Safety.SafetyGate? safety = null)
{
    private readonly WaitlistOfferService waitlist = new(db, notifier);
    /// <summary>Cancellation / no-show rules (feature 9): late-cancel cut-off, penalties, booking blocks.</summary>
    private readonly BookingPenaltyEngine rules = new(db, notifier);
    private const int MaxRepeatWeeks = 26;
    /// <summary>Upper bound on one schedule read (the window is already capped at 62 days).</summary>
    public const int MaxScheduleRows = 1000;

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
        var classes = await q.AsNoTracking().AsSplitQuery().OrderBy(c => c.StartsAt).Take(MaxScheduleRows).ToListAsync();
        return await MapManyAsync(classes);
    }

    public async Task<ClassResponse> GetAsync(ulong id)
    {
        var c = await Query().AsNoTracking().FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Class not found.");
        if (currentUser.IsClient() && c.Status == ClassStatus.Cancelled && !c.Bookings.Any(b => b.ClientId == Me))
            throw new KeyNotFoundException("Class not found.");
        return (await MapManyAsync([c]))[0];
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

    public Task<ClassResponse> UpdateAsync(ulong id, UpdateClassRequest r) =>
        db.InTransactionAsync(() => UpdateLockedAsync(id, r));

    private async Task<ClassResponse> UpdateLockedAsync(ulong id, UpdateClassRequest r)
    {
        await db.LockRowAsync<GymClass>(id); // capacity check + waitlist promotion see a stable roster
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
        await waitlist.FillFreedSeatsAsync(c, DateTime.UtcNow);
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
        var now = DateTime.UtcNow;
        foreach (var t in targets)
        {
            await waitlist.WithdrawForClassAsync(t.Id, now);
            t.Status = ClassStatus.Cancelled;
            if (!string.IsNullOrWhiteSpace(r.Reason)) t.Notes = $"Cancelled: {r.Reason.Trim()}";
            foreach (var b in t.Bookings.Where(b => b.Status is BookingStatus.Booked or BookingStatus.Waitlisted))
            {
                b.Status = BookingStatus.Cancelled;
                b.CancelledAt = DateTime.UtcNow;
                notifier.Add(t.TenantId, b.ClientId, "Class cancelled",
                    $"{t.Title ?? "Your class"} on {t.StartsAt:dd MMM HH:mm} UTC was cancelled.{(string.IsNullOrWhiteSpace(r.Reason) ? "" : " " + r.Reason.Trim())}", "booking", t.Id,
                    urgent: t.StartsAt - now < TimeSpan.FromHours(24) && t.StartsAt > now); // service alert: skips quiet hours
            }
            t.RecountBookings();
        }
        await db.SaveChangesAsync();
        return targets.Count;
    }

    // ── Booking ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Books a spot, or the waitlist when the class is full. ARCH-016: the class row is locked
    /// (SELECT … FOR UPDATE) for the whole check-and-insert, so two members can't both take the
    /// last spot — the second one sees the class full and is waitlisted.
    /// </summary>
    public async Task<ClassResponse> BookAsync(ulong classId, BookClassRequest r)
    {
        // Booking block (repeated no-shows) and safety gate (waiver + health check): members booking
        // themselves. Staff booking for a member are the override.
        if (currentUser.IsClient()) await rules.EnsureCanSelfBookAsync(currentUser.ResolveTenantId(), Me, DateTime.UtcNow);
        if (safety is not null && currentUser.IsClient()) await safety.EnsureClearedAsync(Me, "class_booking");
        return await db.InTransactionAsync(() => BookLockedAsync(classId, r));
    }

    private async Task<ClassResponse> BookLockedAsync(ulong classId, BookClassRequest r)
    {
        var clientId = currentUser.IsClient() ? Me : r.ClientId ?? throw new ArgumentException("Choose the member to book.");
        await db.LockRowAsync<GymClass>(classId);
        var c = await Query().FirstOrDefaultAsync(x => x.Id == classId) ?? throw new KeyNotFoundException("Class not found.");
        if (c.Status == ClassStatus.Cancelled) throw new ArgumentException("This class was cancelled.");
        if (c.StartsAt <= DateTime.UtcNow) throw new ArgumentException("This class has already started.");
        if (!currentUser.IsClient() && !await db.Users.AnyAsync(u => u.Id == clientId && u.DeletedAt == null))
            throw new KeyNotFoundException("Member not found.");
        if (await MembershipRules.BlockReasonAsync(db, clientId, DateOnly.FromDateTime(c.StartsAt)) is { } blocked)
            throw new ArgumentException(blocked);

        var existing = c.Bookings.FirstOrDefault(b => b.ClientId == clientId && b.Status is BookingStatus.Booked or BookingStatus.Waitlisted);
        if (existing is not null)
            throw RuleException.Conflict(existing.Status == BookingStatus.Booked ? "Already booked for this class." : "Already on the waitlist.");

        var full = await waitlist.IsFullAsync(c, DateTime.UtcNow); // seats held by waitlist offers count
        c.Bookings.Add(new ClassBooking
        {
            TenantId = c.TenantId, ClassId = c.Id, ClientId = clientId,
            Status = full ? BookingStatus.Waitlisted : BookingStatus.Booked,
        });
        c.RecountBookings();
        await db.SaveChangesAsync();
        return (await MapManyAsync([c], clientId))[0];
    }

    /// <summary>
    /// Cancels a booking / leaves the waitlist. A member cancelling a booked spot inside the gym's
    /// cut-off gets 409 LATE_CANCEL_CONFIRM (with the consequence) unless <paramref name="confirmLate"/>;
    /// the spot still goes to the waitlist and the consequence is recorded. Staff cancels are free.
    /// </summary>
    public Task<ClassResponse> CancelBookingAsync(ulong classId, ulong? clientIdForStaff, bool confirmLate = false) =>
        db.InTransactionAsync(() => CancelBookingLockedAsync(classId, clientIdForStaff, confirmLate));

    private async Task<ClassResponse> CancelBookingLockedAsync(ulong classId, ulong? clientIdForStaff, bool confirmLate)
    {
        var clientId = currentUser.IsClient() ? Me : clientIdForStaff ?? throw new ArgumentException("Choose the member.");
        await db.LockRowAsync<GymClass>(classId); // waitlist promotion must not overfill the class
        var c = await Query().FirstOrDefaultAsync(x => x.Id == classId) ?? throw new KeyNotFoundException("Class not found.");
        var booking = c.Bookings.FirstOrDefault(b => b.ClientId == clientId && b.Status is BookingStatus.Booked or BookingStatus.Waitlisted)
                      ?? throw new ArgumentException("No booking to cancel.");
        var now = DateTime.UtcNow;
        if (currentUser.IsClient() && c.StartsAt <= now) throw new ArgumentException("This class has already started.");
        var wasWaitlisted = booking.Status == BookingStatus.Waitlisted;
        var lateFee = false;
        if (currentUser.IsClient() && !wasWaitlisted && c.Status != ClassStatus.Cancelled)
        {
            var late = await rules.LateCancelAsync(c.TenantId, c.StartsAt, pt: false, now);
            if (late.IsLate && late.Consequence != BookingRulesSettings.None)
            {
                if (!confirmLate) throw BookingPenaltyEngine.ConfirmRequired(late);
                lateFee = true;
            }
        }
        booking.Status = BookingStatus.Cancelled;
        booking.CancelledAt = now;
        if (wasWaitlisted) await waitlist.WithdrawForBookingAsync(booking.Id, now);
        await waitlist.FillFreedSeatsAsync(c, now); // a late cancel still frees the spot
        await db.SaveChangesAsync();
        if (lateFee)
            await rules.ApplyAsync(new PenaltySubject(c.TenantId, clientId, BookingPenaltyTypes.LateCancel, c.StartsAt,
                c.Title ?? c.ClassType.Name, BookingId: booking.Id, ClassId: c.Id), now);
        return (await MapManyAsync([c], clientId))[0];
    }

    // ── Waitlist offers ("offer" waitlist mode) ─────────────────────────────

    /// <summary>
    /// The member takes the spot held for them. Claimed = false when the window had already
    /// passed: the offer is then expired and rolled to the next person (committed), and the
    /// caller reports a 409.
    /// </summary>
    public Task<(ClassResponse Class, bool Claimed)> ClaimOfferAsync(ulong classId) =>
        db.InTransactionAsync(async () =>
        {
            await db.LockRowAsync<GymClass>(classId);
            var c = await Query().FirstOrDefaultAsync(x => x.Id == classId) ?? throw new KeyNotFoundException("Class not found.");
            if (c.Status == ClassStatus.Cancelled) throw new ArgumentException("This class was cancelled.");
            var claimed = await waitlist.ClaimAsync(c, Me, DateTime.UtcNow);
            await db.SaveChangesAsync();
            return ((await MapManyAsync([c], Me))[0], claimed);
        });

    /// <summary>The member passes on the held spot; it is offered to the next person.</summary>
    public Task<ClassResponse> DeclineOfferAsync(ulong classId) =>
        db.InTransactionAsync(async () =>
        {
            await db.LockRowAsync<GymClass>(classId);
            var c = await Query().FirstOrDefaultAsync(x => x.Id == classId) ?? throw new KeyNotFoundException("Class not found.");
            await waitlist.DeclineAsync(c, Me, DateTime.UtcNow);
            await db.SaveChangesAsync();
            return (await MapManyAsync([c], Me))[0];
        });

    public async Task<List<ClassResponse>> GetMyBookingsAsync()
    {
        var since = DateTime.UtcNow.AddDays(-30);
        var classes = await Query()
            .Where(c => c.StartsAt >= since && c.Bookings.Any(b => b.ClientId == Me && b.Status != BookingStatus.Cancelled))
            .AsNoTracking().AsSplitQuery().OrderBy(c => c.StartsAt).Take(200).ToListAsync();
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

    /// <summary>
    /// Marks attended / no-show. A no-show records the gym's no-show consequence once per booking
    /// (marking again is a no-op); correcting a no-show to attended waives its penalty.
    /// </summary>
    public Task MarkAttendanceAsync(ulong classId, MarkAttendanceRequest r) =>
        db.InTransactionAsync(async () =>
        {
            await db.LockRowAsync<GymClass>(classId); // two staff marking at once can't both record the penalty
            var c = await Query().FirstOrDefaultAsync(x => x.Id == classId) ?? throw new KeyNotFoundException("Class not found.");
            EnsureCanManage(c);
            var b = c.Bookings.FirstOrDefault(x => x.ClientId == r.ClientId && x.Status != BookingStatus.Cancelled && x.Status != BookingStatus.Waitlisted)
                    ?? throw new ArgumentException("That member isn't booked for this class.");
            var was = b.Status;
            b.Status = r.Attended ? BookingStatus.Attended : BookingStatus.NoShow;
            await db.SaveChangesAsync();
            var now = DateTime.UtcNow;
            if (b.Status == BookingStatus.NoShow)
                await rules.ApplyAsync(new PenaltySubject(c.TenantId, b.ClientId, BookingPenaltyTypes.NoShow, c.StartsAt,
                    c.Title ?? c.ClassType.Name, BookingId: b.Id, ClassId: c.Id, CreatedBy: currentUser.UserId), now);
            else if (was == BookingStatus.NoShow)
            {
                await rules.UndoNoShowAsync(c.TenantId, b.Id, null, currentUser.UserId, now);
                await db.SaveChangesAsync();
            }
        });

    // ── helpers ─────────────────────────────────────────────────────────────

    private ulong Me => currentUser.UserId ?? throw new UnauthorizedAccessException("Please sign in again.");

    private IQueryable<GymClass> Query() =>
        db.GymClasses.Include(c => c.ClassType).Include(c => c.Branch).Include(c => c.Trainer).Include(c => c.Bookings);

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

    private async Task<List<ClassResponse>> MapManyAsync(List<GymClass> classes, ulong? forClient = null)
    {
        var client = forClient ?? (currentUser.IsClient() ? currentUser.UserId : null);
        var ids = classes.Select(c => c.Id).ToList();
        var now = DateTime.UtcNow;
        var cutoff = classes.Count == 0 ? 0 : (await BookingPenaltyEngine.LoadSettingsAsync(db, classes[0].TenantId)).ClassCancelCutoffHours;
        List<OfferExpiry> offers = client is null ? [] : await db.WaitlistOffers.AsNoTracking()
            .Where(o => o.ClientId == client && ids.Contains(o.ClassId) && o.Status == WaitlistOfferStatuses.Pending && o.ExpiresAt > now)
            .Select(o => new OfferExpiry(o.ClassId, o.ExpiresAt)).ToListAsync();
        return classes.Select(c => new ClassResponse
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
            MyOfferExpiresAt = offers.Where(o => o.ClassId == c.Id).Select(o => (DateTime?)o.ExpiresAt).FirstOrDefault(),
            FreeCancelUntil = BookingPenaltyEngine.FreeCancelUntil(c.StartsAt, cutoff),
        }).ToList();
    }

    private sealed record OfferExpiry(ulong ClassId, DateTime ExpiresAt);
}
