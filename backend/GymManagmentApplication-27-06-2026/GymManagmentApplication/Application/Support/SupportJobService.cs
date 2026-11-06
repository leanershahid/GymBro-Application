using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Engagement;
using GymManagmentApplication.Domain.Entities.Support;
using Microsoft.EntityFrameworkCore;
using S = GymManagmentApplication.Domain.Entities.Support.SupportStatuses;

namespace GymManagmentApplication.Application.Support;

/// <summary>
/// Background work for the help desk (run by Infrastructure/Jobs/SupportJob, no signed-in user, so
/// every query names its tenant): closes requests resolved more than 7 days ago, and once a day
/// (from 8am gym time) sends the gym's support staff a digest of overdue requests. The digest
/// carries a dedupe key per gym, day and person, so it is sent at most once a day.
/// </summary>
public class SupportJobService(IAppDbContext db, Notifier notifier)
{
    public const int DigestHour = 8;

    public static string DigestKey(ulong tenantId, DateOnly day, ulong userId) => $"support-digest:{tenantId}:{day:yyyyMMdd}:{userId}";

    /// <summary>Closes resolved requests whose reopen window has passed. Returns how many.</summary>
    public async Task<int> CloseStaleAsync(ulong tenantId, DateTime now, CancellationToken ct = default)
    {
        var cutoff = now.AddDays(-SupportCommon.ReopenDays);
        var stale = await db.SupportRequests.AcrossTenants()
            .Where(r => r.TenantId == tenantId && r.Status == S.Resolved && r.ResolvedAt != null && r.ResolvedAt < cutoff)
            .ToListAsync(ct);
        foreach (var r in stale)
        {
            r.Status = S.Closed;
            r.ClosedAt = now;
            db.SupportMessages.Add(new SupportMessage
            {
                TenantId = tenantId, RequestId = r.Id, AuthorRole = SupportAuthorRoles.System, Kind = SupportMessageKinds.Event,
                Body = "Closed automatically", CreatedAt = now, UpdatedAt = now,
            });
        }
        if (stale.Count > 0) await db.SaveChangesAsync(ct);
        return stale.Count;
    }

    /// <summary>The daily overdue digest for one gym (when its local time is past 8am). Returns notifications queued.</summary>
    public async Task<int> SendDigestAsync(ulong tenantId, DateTime now, DateOnly localDay, int localHour, CancellationToken ct = default)
    {
        if (localHour < DigestHour) return 0;
        var settings = await SupportSettingsStore.LoadAsync(db, tenantId, ct);
        var overdue = await db.SupportRequests.AcrossTenants().Where(r => r.TenantId == tenantId)
            .WhereOverdue(settings, now).Select(r => new { r.Id, r.AssigneeId }).ToListAsync(ct);
        if (overdue.Count == 0) return 0;

        var recipients = await SupportCommon.StaffRecipientsAsync(db, tenantId, ct);
        var keys = recipients.ToDictionary(u => u, u => DigestKey(tenantId, localDay, u));
        var sent = await notifier.AlreadyQueuedAsync(tenantId, keys.Values.ToList(), ct);
        var unassigned = overdue.Count(o => o.AssigneeId == null);
        var n = 0;
        foreach (var (userId, key) in keys)
        {
            if (sent.Contains(key)) continue;
            notifier.Add(tenantId, userId,
                overdue.Count == 1 ? "1 help request is overdue" : $"{overdue.Count} help requests are overdue",
                unassigned > 0 ? $"{unassigned} of them not assigned yet. Open Support to catch up." : "Open Support to catch up.",
                SupportCommon.DigestKind, null, dedupeKey: key);
            n++;
        }
        if (n > 0) await db.SaveChangesAsync(ct);
        return n;
    }
}
