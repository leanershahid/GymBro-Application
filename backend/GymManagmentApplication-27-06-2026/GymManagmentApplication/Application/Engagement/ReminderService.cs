using System.Globalization;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Scheduling;
using GymManagmentApplication.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Engagement;

/// <summary>
/// Class and PT reminders 24 h and 2 h before start (see <see cref="NotificationPolicy.DueReminder"/>).
/// Idempotent: every reminder carries a dedupe key ("class-reminder:{bookingId}:{kind}",
/// "pt-reminder:{sessionId}:{kind}") stored on its queued push row, and keys already queued are
/// skipped, so the 5-minute scheduler can run any number of times (and on several instances).
/// </summary>
public class ReminderService(IAppDbContext db, Notifier notifier)
{
    public static string ClassKey(ulong bookingId, string kind) => $"class-reminder:{bookingId}:{kind}";
    public static string PtKey(ulong sessionId, string kind) => $"pt-reminder:{sessionId}:{kind}";

    /// <summary>Queues the reminders due now for one gym and saves; returns how many were queued.</summary>
    public async Task<int> QueueDueAsync(ulong tenantId, DateTime utcNow, CancellationToken ct = default)
    {
        var settings = await WaitlistOfferService.LoadSettingsAsync(db, tenantId, ct);
        if (!settings.RemindersEnabled) return 0;

        var horizon = utcNow.AddHours(24);
        var tenantZone = (await TenantClock.ForAsync(db, tenantId)).Zone;
        var branchZones = (await db.Branches.IgnoreQueryFilters().AsNoTracking().Where(b => b.TenantId == tenantId)
            .Select(b => new { b.Id, b.Timezone }).ToListAsync(ct))
            .ToDictionary(b => b.Id, b => !string.IsNullOrWhiteSpace(b.Timezone) && b.Timezone != "UTC" ? TenantClock.Resolve(b.Timezone) : tenantZone);
        TimeZoneInfo ZoneOf(ulong? branchId) => branchId is { } id && branchZones.TryGetValue(id, out var z) ? z : tenantZone;

        // Classes
        var bookings = await db.ClassBookings.IgnoreQueryFilters().AsNoTracking()
            .Where(b => b.TenantId == tenantId && b.Status == BookingStatus.Booked
                        && b.Class.Status == ClassStatus.Scheduled && b.Class.StartsAt > utcNow && b.Class.StartsAt <= horizon)
            .Select(b => new { b.Id, b.ClientId, b.BookedAt, b.ClassId, b.Class.StartsAt, b.Class.BranchId, Name = b.Class.Title ?? b.Class.ClassType.Name })
            .ToListAsync(ct);
        var classDue = bookings.Select(b => (b, Kind: NotificationPolicy.DueReminder(b.StartsAt, b.BookedAt, utcNow)))
            .Where(x => x.Kind is not null).ToList();

        // PT sessions
        var sessions = await db.PtSessions.IgnoreQueryFilters().AsNoTracking()
            .Where(s => s.TenantId == tenantId && (s.Status == PtSessionStatus.Booked || s.Status == PtSessionStatus.Confirmed)
                        && s.StartsAt > utcNow && s.StartsAt <= horizon)
            .Select(s => new { s.Id, s.ClientId, s.CreatedAt, s.StartsAt, s.BranchId, Type = s.SessionType.Name, Trainer = s.Trainer.DisplayName })
            .ToListAsync(ct);
        var ptDue = sessions.Select(s => (s, Kind: NotificationPolicy.DueReminder(s.StartsAt, s.CreatedAt, utcNow)))
            .Where(x => x.Kind is not null).ToList();

        var keys = classDue.Select(x => ClassKey(x.b.Id, x.Kind!)).Concat(ptDue.Select(x => PtKey(x.s.Id, x.Kind!))).ToList();
        if (keys.Count == 0) return 0;
        var done = await notifier.AlreadyQueuedAsync(tenantId, keys, ct);

        var queued = 0;
        foreach (var (b, kind) in classDue)
        {
            var key = ClassKey(b.Id, kind!);
            if (!done.Add(key)) continue;
            var at = Local(b.StartsAt, ZoneOf(b.BranchId));
            notifier.Add(tenantId, b.ClientId,
                kind == NotificationPolicy.Reminder2h ? $"{b.Name} starts in 2 hours" : $"{b.Name} is tomorrow",
                kind == NotificationPolicy.Reminder2h ? $"See you at {at}. Can't make it? Cancel so someone on the waitlist gets your spot."
                                                      : $"You're booked for {at}.",
                "class_reminder", b.ClassId, expiresAt: b.StartsAt, dedupeKey: key);
            queued++;
        }
        foreach (var (s, kind) in ptDue)
        {
            var key = PtKey(s.Id, kind!);
            if (!done.Add(key)) continue;
            var at = Local(s.StartsAt, ZoneOf(s.BranchId));
            notifier.Add(tenantId, s.ClientId,
                kind == NotificationPolicy.Reminder2h ? $"{s.Type} in 2 hours" : $"{s.Type} tomorrow",
                $"With {s.Trainer} at {at}.", "pt_reminder", s.Id, expiresAt: s.StartsAt, dedupeKey: key);
            queued++;
        }
        await db.SaveChangesAsync(ct);
        return queued;
    }

    private static string Local(DateTime utc, TimeZoneInfo zone) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), zone)
            .ToString("ddd d MMM, h:mmtt", CultureInfo.InvariantCulture).Replace("AM", "am").Replace("PM", "pm");
}
