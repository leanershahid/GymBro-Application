using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Engagement;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Domain.Entities.Operations;
using GymManagmentApplication.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Operations;

/// <summary>Who an announcement goes to, as a query of user ids (never loaded all at once).</summary>
public static class AnnouncementAudienceResolver
{
    public static List<ulong> ParseIds(string? csv) =>
        string.IsNullOrWhiteSpace(csv) ? []
            : csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(s => ulong.TryParse(s, out var v) ? v : 0).Where(v => v > 0).Distinct().ToList();

    public static string? FormatIds(IEnumerable<ulong> ids)
    {
        var list = ids.Where(i => i > 0).Distinct().ToList();
        return list.Count == 0 ? null : string.Join(",", list);
    }

    /// <summary>
    /// Ids of the gym's users in the audience. Members = active or pending (invited) client
    /// accounts that aren't deleted; Staff = every other gym role (admin, trainer, staff, custom).
    /// Filters are explicit (tenant included) so the result is the same from a request and from
    /// the background publish job.
    /// </summary>
    public static IQueryable<ulong> UserIds(IAppDbContext db, ulong tenantId, AnnouncementAudience audience, IReadOnlyCollection<ulong> ids)
    {
        var users = db.Users.IgnoreQueryFilters()
            .Where(u => u.TenantId == tenantId && u.DeletedAt == null
                        && (u.Status == UserStatus.Active || u.Status == UserStatus.Pending));
        var members = users.Where(u => u.Role.Slug == RoleNames.Client);
        var activeMemberships = db.GymMemberships.IgnoreQueryFilters()
            .Where(m => m.TenantId == tenantId && (m.Status == MembershipStatus.Active || m.Status == MembershipStatus.Trial));

        var picked = audience switch
        {
            AnnouncementAudience.AllMembers => members,
            AnnouncementAudience.Branches => members.Where(u =>
                (u.BranchId != null && ids.Contains(u.BranchId.Value))
                || activeMemberships.Any(m => m.UserId == u.Id && m.BranchId != null && ids.Contains(m.BranchId.Value))),
            AnnouncementAudience.Plans => members.Where(u => activeMemberships.Any(m => m.UserId == u.Id && ids.Contains(m.PlanId))),
            AnnouncementAudience.Tags => members.Where(u =>
                db.Taggables.Any(t => t.TaggableType == "User" && t.TaggableId == u.Id && ids.Contains(t.TagId))),
            AnnouncementAudience.Staff => users.Where(u => u.Role.Slug != RoleNames.Client && u.Role.Slug != RoleNames.SuperAdmin),
            _ => users.Where(_ => false),
        };
        return picked.Select(u => u.Id);
    }
}

/// <summary>
/// Delivers announcements: one <see cref="AnnouncementRecipient"/> row + in-app notification (and
/// queued push, through <see cref="Notifier"/>) per person, in pages of <see cref="BatchSize"/>
/// users. Safe to run from the admin request ("publish now") and the background job at once:
/// <list type="bullet">
/// <item>a lease (<see cref="Announcement.DeliveryLockedUntil"/>) taken with one conditional UPDATE
/// means only one runner delivers an announcement at a time;</item>
/// <item>each page is "audience minus people who already have a recipient row", and its recipient
/// rows and notifications are saved together, so a crash resumes after the last saved page;</item>
/// <item>the (AnnouncementId, UserId) key means nobody is delivered to twice, even when two runners
/// overlap after a lapsed lease (the slower save fails instead).</item>
/// </list>
/// </summary>
public class AnnouncementPublisher(IAppDbContext db, Notifier notifier)
{
    public const int DefaultBatchSize = 500;
    /// <summary>Users per page (one save each).</summary>
    public int BatchSize { get; set; } = DefaultBatchSize;
    public static readonly TimeSpan Lease = TimeSpan.FromMinutes(5);

    /// <summary>Delivers every due announcement (scheduled time reached, or a run left unfinished). Returns how many finished.</summary>
    public async Task<int> PublishDueAsync(DateTime? nowUtc = null, CancellationToken ct = default)
    {
        var now = nowUtc ?? DateTime.UtcNow;
        var due = await db.Announcements.IgnoreQueryFilters()
            .Where(a => (a.Status == AnnouncementStatus.Scheduled && a.PublishAt != null && a.PublishAt <= now)
                        || a.Status == AnnouncementStatus.Publishing)
            .Where(a => a.DeliveryLockedUntil == null || a.DeliveryLockedUntil < now)
            .OrderBy(a => a.PublishAt).Select(a => a.Id).Take(50).ToListAsync(ct);
        var done = 0;
        foreach (var id in due)
            if (await DeliverAsync(id, now, ct)) done++;
        return done;
    }

    /// <summary>Delivers one announcement if it is due and nobody else holds it. True when it is now fully published.</summary>
    public async Task<bool> DeliverAsync(ulong announcementId, DateTime? nowUtc = null, CancellationToken ct = default)
    {
        var now = nowUtc ?? DateTime.UtcNow;
        var leaseUntil = now + Lease;

        // Claim: Scheduled-and-due or Publishing, and not leased by another runner.
        var claimed = await db.Announcements.IgnoreQueryFilters()
            .Where(a => a.Id == announcementId
                        && ((a.Status == AnnouncementStatus.Scheduled && a.PublishAt != null && a.PublishAt <= now)
                            || a.Status == AnnouncementStatus.Publishing)
                        && (a.DeliveryLockedUntil == null || a.DeliveryLockedUntil < now))
            .ExecuteUpdateAsync(s => s
                .SetProperty(a => a.Status, AnnouncementStatus.Publishing)
                .SetProperty(a => a.DeliveryLockedUntil, leaseUntil), ct);
        if (claimed == 0) return false;

        var a = await db.Announcements.IgnoreQueryFilters().AsTracking().FirstAsync(x => x.Id == announcementId, ct);
        await db.Entry(a).ReloadAsync(ct); // the UPDATE above bypassed the change tracker
        var ids = AnnouncementAudienceResolver.ParseIds(a.AudienceIds);
        var audience = AnnouncementAudienceResolver.UserIds(db, a.TenantId, a.Audience, ids);

        // Each page = audience members without a recipient row yet (an anti-join on the
        // (AnnouncementId, UserId) key), so a resumed run naturally continues where it stopped and
        // people who joined the audience meanwhile are included. Bounded so a bug can't spin forever.
        var announcementKey = a.Id;
        for (var guard = 0; guard < 100_000; guard++)
        {
            ct.ThrowIfCancellationRequested();
            var page = await audience
                .Where(id => !db.AnnouncementRecipients.IgnoreQueryFilters().Any(r => r.AnnouncementId == announcementKey && r.UserId == id))
                .Take(BatchSize).ToListAsync(ct);
            if (page.Count == 0) break;

            foreach (var userId in page.Distinct())
            {
                db.AnnouncementRecipients.Add(new AnnouncementRecipient { AnnouncementId = a.Id, UserId = userId, TenantId = a.TenantId, DeliveredAt = now });
                Notify(a, userId);
            }
            a.RecipientCount += page.Distinct().Count();
            a.DeliveryLockedUntil = DateTime.UtcNow + Lease; // renew for long audiences
            // Recipients + notifications + count in one save: a page is delivered completely or not at all.
            await db.SaveChangesAsync(ct);
            DetachAllBut(a);
            if (page.Count < BatchSize) break;
        }

        a.Status = AnnouncementStatus.Published;
        a.PublishedAt ??= a.PublishAt is { } p && p <= now ? p : now;
        a.DeliveryLockedUntil = null;
        await db.SaveChangesAsync(ct);
        return true;
    }

    private void Notify(Announcement a, ulong userId) =>
        notifier.Add(a.TenantId, userId, a.Title, Snippet(a.Body), kind: "announcement", refId: a.Id,
            urgent: a.IsUrgent, category: NotificationCategories.Announcements, expiresAt: a.ExpiresAt,
            dedupeKey: $"announcement:{a.Id}:{userId}");

    /// <summary>Keeps the change tracker small between pages (the saved rows are not needed again).</summary>
    private void DetachAllBut(Announcement keep)
    {
        foreach (var e in db.ChangeTracker.Entries().Where(e => !ReferenceEquals(e.Entity, keep)).ToList())
            e.State = EntityState.Detached;
    }

    public static string Snippet(string body)
    {
        var flat = string.Join(' ', body.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries)).Replace("**", "").Trim();
        return flat.Length <= 140 ? flat : flat[..137].TrimEnd() + "…";
    }
}
