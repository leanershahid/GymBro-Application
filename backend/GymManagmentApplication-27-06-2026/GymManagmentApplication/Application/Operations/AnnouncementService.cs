using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Operations;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Operations;

/// <summary>
/// Announcements: admins compose (draft / schedule / publish now) and see reach; everyone reads
/// the ones delivered to them (<see cref="AnnouncementRecipient"/> rows), pinned first.
/// Delivery itself is <see cref="AnnouncementPublisher"/>.
/// </summary>
public class AnnouncementService(IAppDbContext db, ICurrentUser currentUser, AnnouncementPublisher publisher)
{
    private ulong Me => currentUser.UserId ?? 0;

    // ── Admin ────────────────────────────────────────────────────────────────

    public async Task<List<AnnouncementAdminDto>> ListAsync(string? status)
    {
        var q = db.Announcements.AsQueryable();
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<AnnouncementStatus>(status, true, out var st))
            q = q.Where(a => a.Status == st);
        var rows = await q.OrderByDescending(a => a.IsPinned).ThenByDescending(a => a.PublishedAt ?? a.PublishAt ?? a.CreatedAt)
            .Take(200).ToListAsync();
        return await MapAdminAsync(rows);
    }

    public async Task<AnnouncementAdminDto> GetAdminAsync(ulong id)
    {
        var a = await db.Announcements.FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Announcement not found.");
        return (await MapAdminAsync([a]))[0];
    }

    public async Task<AnnouncementAdminDto> CreateAsync(AnnouncementRequest request)
    {
        var a = new Announcement { TenantId = currentUser.ResolveTenantId(), CreatedByUserId = currentUser.UserId };
        await ApplyContentAsync(a, request, audienceEditable: true);
        db.Announcements.Add(a);
        await ApplyActionAsync(a, request);
        return await GetAdminAsync(a.Id);
    }

    /// <summary>
    /// Drafts and scheduled announcements can change completely; a published one only its text,
    /// image, button, pin and expiry (editing never notifies anyone again).
    /// </summary>
    public async Task<AnnouncementAdminDto> UpdateAsync(ulong id, AnnouncementRequest request)
    {
        var a = await db.Announcements.FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Announcement not found.");
        if (a.Status == AnnouncementStatus.Publishing)
            throw new RuleException("This announcement is being sent right now. Try again in a minute.", RuleException.ConflictStatus);
        var sent = a.Status == AnnouncementStatus.Published;
        await ApplyContentAsync(a, request, audienceEditable: !sent);
        if (sent) await db.SaveChangesAsync();
        else await ApplyActionAsync(a, request);
        return await GetAdminAsync(a.Id);
    }

    public async Task<AnnouncementAdminDto> PublishNowAsync(ulong id)
    {
        var a = await db.Announcements.FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Announcement not found.");
        if (a.Status is AnnouncementStatus.Published) return await GetAdminAsync(id);
        await ApplyActionAsync(a, new AnnouncementRequest { Action = "publish" });
        return await GetAdminAsync(id);
    }

    /// <summary>Scheduled → back to draft (not sent).</summary>
    public async Task<AnnouncementAdminDto> UnscheduleAsync(ulong id)
    {
        var a = await db.Announcements.FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Announcement not found.");
        if (a.Status != AnnouncementStatus.Scheduled) throw new RuleException("Only a scheduled announcement can be unscheduled.", RuleException.ConflictStatus);
        // Conditional so it can't race the publish job claiming it.
        var n = await db.Announcements.Where(x => x.Id == id && x.Status == AnnouncementStatus.Scheduled && x.DeliveryLockedUntil == null)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, AnnouncementStatus.Draft));
        if (n == 0) throw new RuleException("It has just started sending.", RuleException.ConflictStatus);
        await db.Entry(a).ReloadAsync();
        return await GetAdminAsync(id);
    }

    /// <summary>Drafts / scheduled: deleted. Published: taken down (expired now), reach kept.</summary>
    public async Task<bool> DeleteAsync(ulong id)
    {
        var a = await db.Announcements.FirstOrDefaultAsync(x => x.Id == id);
        if (a is null) return false;
        switch (a.Status)
        {
            case AnnouncementStatus.Publishing:
                throw new RuleException("This announcement is being sent right now. Try again in a minute.", RuleException.ConflictStatus);
            case AnnouncementStatus.Published:
                a.ExpiresAt = DateTime.UtcNow;
                a.IsPinned = false;
                break;
            default:
                db.Announcements.Remove(a);
                break;
        }
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<int> AudienceCountAsync(AudiencePreviewRequest request)
    {
        var audience = ParseAudience(request.Audience);
        var ids = request.AudienceIds?.Distinct().ToList() ?? [];
        if (audience != AnnouncementAudience.AllMembers && audience != AnnouncementAudience.Staff && ids.Count == 0) return 0;
        return await AnnouncementAudienceResolver.UserIds(db, currentUser.ResolveTenantId(), audience, ids).CountAsync();
    }

    /// <summary>What the audience picker offers: the gym's branches, active plans and member tags.</summary>
    public async Task<AudienceOptionsResponse> AudienceOptionsAsync() => new()
    {
        Branches = await db.Branches.OrderBy(b => b.Name).Select(b => new IdName(b.Id, b.Name)).ToListAsync(),
        Plans = await db.MembershipPlans.Where(p => p.IsActive).OrderBy(p => p.Name).Select(p => new IdName(p.Id, p.Name)).ToListAsync(),
        Tags = await db.Tags.OrderBy(t => t.Name).Select(t => new IdName(t.Id, t.Name)).ToListAsync(),
    };

    private async Task ApplyContentAsync(Announcement a, AnnouncementRequest r, bool audienceEditable)
    {
        var title = r.Title?.Trim() ?? "";
        var body = r.Body?.Trim() ?? "";
        if (title.Length == 0) throw new ArgumentException("Give the announcement a title.");
        if (title.Length > 150) throw new ArgumentException("The title can be at most 150 characters.");
        if (body.Length == 0) throw new ArgumentException("Write the announcement text.");
        if (body.Length > 10_000) throw new ArgumentException("The text can be at most 10,000 characters.");
        var ctaLabel = string.IsNullOrWhiteSpace(r.CtaLabel) ? null : r.CtaLabel.Trim();
        var ctaRoute = string.IsNullOrWhiteSpace(r.CtaRoute) ? null : r.CtaRoute.Trim().TrimStart('/');
        if ((ctaLabel is null) != (ctaRoute is null)) throw new ArgumentException("A button needs both a label and a screen to open.");
        if (ctaLabel is { Length: > 40 }) throw new ArgumentException("The button label can be at most 40 characters.");
        if (ctaRoute is not null && (ctaRoute.Length > 200 || ctaRoute.Contains("://") || ctaRoute.Any(char.IsWhiteSpace)))
            throw new ArgumentException("The button must open an app screen, e.g. \"book\" or \"shop\".");
        if (r.ImageUrl is { Length: > 1000 }) throw new ArgumentException("Image URL is too long.");
        var expires = r.ExpiresAt is { } e ? DateTime.SpecifyKind(e, DateTimeKind.Utc) : (DateTime?)null;

        a.Title = title;
        a.Body = body;
        a.ImageUrl = string.IsNullOrWhiteSpace(r.ImageUrl) ? null : r.ImageUrl.Trim();
        a.CtaLabel = ctaLabel;
        a.CtaRoute = ctaRoute;
        a.IsPinned = r.IsPinned;
        a.ExpiresAt = expires;
        if (!audienceEditable) return;

        var audience = ParseAudience(r.Audience);
        var ids = r.AudienceIds?.Where(i => i > 0).Distinct().ToList() ?? [];
        if (audience is AnnouncementAudience.Branches or AnnouncementAudience.Plans or AnnouncementAudience.Tags)
        {
            if (ids.Count == 0) throw new ArgumentException("Pick at least one branch, plan or tag.");
            var known = audience switch
            {
                AnnouncementAudience.Branches => await db.Branches.CountAsync(b => ids.Contains(b.Id)),
                AnnouncementAudience.Plans => await db.MembershipPlans.CountAsync(p => ids.Contains(p.Id)),
                _ => await db.Tags.CountAsync(t => ids.Contains(t.Id)),
            };
            if (known != ids.Count) throw new ArgumentException("Some of the chosen branches, plans or tags no longer exist.");
        }
        else ids = [];
        a.Audience = audience;
        a.AudienceIds = AnnouncementAudienceResolver.FormatIds(ids);
        a.IsUrgent = r.IsUrgent;
    }

    private async Task ApplyActionAsync(Announcement a, AnnouncementRequest r)
    {
        var now = DateTime.UtcNow;
        switch ((r.Action ?? "draft").Trim().ToLowerInvariant())
        {
            case "schedule":
                if (r.PublishAt is not { } at) throw new ArgumentException("Pick when to send it.");
                var when = DateTime.SpecifyKind(at, DateTimeKind.Utc);
                if (when < now.AddMinutes(-1)) throw new ArgumentException("The send time is in the past.");
                if (a.ExpiresAt is { } ex && ex <= when) throw new ArgumentException("The expiry must be after the send time.");
                a.Status = AnnouncementStatus.Scheduled;
                a.PublishAt = when;
                await db.SaveChangesAsync();
                return;
            case "publish":
                if (a.ExpiresAt is { } ex2 && ex2 <= now) throw new ArgumentException("The expiry is already in the past.");
                a.Status = AnnouncementStatus.Scheduled;
                a.PublishAt = now;
                await db.SaveChangesAsync();
                await publisher.DeliverAsync(a.Id, now);
                await db.Entry(a).ReloadAsync();
                return;
            case "draft":
                a.Status = AnnouncementStatus.Draft;
                a.PublishAt = r.PublishAt is { } p ? DateTime.SpecifyKind(p, DateTimeKind.Utc) : null;
                await db.SaveChangesAsync();
                return;
            default:
                throw new ArgumentException("Action must be draft, schedule or publish.");
        }
    }

    private static AnnouncementAudience ParseAudience(string? s) =>
        Enum.TryParse<AnnouncementAudience>(s?.Replace("_", "").Replace("-", ""), true, out var v)
            ? v : throw new ArgumentException("Audience must be AllMembers, Branches, Plans, Tags or Staff.");

    private async Task<List<AnnouncementAdminDto>> MapAdminAsync(List<Announcement> rows)
    {
        var ids = rows.Select(r => r.Id).ToList();
        var reads = await db.AnnouncementRecipients.Where(r => ids.Contains(r.AnnouncementId) && r.ReadAt != null)
            .GroupBy(r => r.AnnouncementId).Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count);
        var labels = await AudienceLabelsAsync(rows);
        var now = DateTime.UtcNow;
        return rows.Select(a => new AnnouncementAdminDto
        {
            Id = a.Id, Title = a.Title, Body = a.Body, ImageUrl = a.ImageUrl, CtaLabel = a.CtaLabel, CtaRoute = a.CtaRoute,
            Audience = a.Audience.ToString(), AudienceIds = AnnouncementAudienceResolver.ParseIds(a.AudienceIds),
            AudienceLabel = labels.GetValueOrDefault(a.Id, ""),
            IsPinned = a.IsPinned, IsUrgent = a.IsUrgent,
            Status = a.Status == AnnouncementStatus.Published && a.ExpiresAt <= now ? "Expired" : a.Status.ToString(),
            PublishAt = a.PublishAt, PublishedAt = a.PublishedAt, ExpiresAt = a.ExpiresAt,
            RecipientCount = a.RecipientCount, ReadCount = reads.GetValueOrDefault(a.Id), CreatedAt = a.CreatedAt,
        }).ToList();
    }

    private async Task<Dictionary<ulong, string>> AudienceLabelsAsync(List<Announcement> rows)
    {
        var all = rows.SelectMany(r => AnnouncementAudienceResolver.ParseIds(r.AudienceIds)).Distinct().ToList();
        var branches = rows.Any(r => r.Audience == AnnouncementAudience.Branches)
            ? await db.Branches.Where(b => all.Contains(b.Id)).ToDictionaryAsync(b => b.Id, b => b.Name) : [];
        var plans = rows.Any(r => r.Audience == AnnouncementAudience.Plans)
            ? await db.MembershipPlans.Where(p => all.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.Name) : [];
        var tags = rows.Any(r => r.Audience == AnnouncementAudience.Tags)
            ? await db.Tags.Where(t => all.Contains(t.Id)).ToDictionaryAsync(t => t.Id, t => t.Name) : [];

        static string Names(IEnumerable<ulong> ids, Dictionary<ulong, string> names, string noun)
        {
            var list = ids.Select(i => names.GetValueOrDefault(i)).Where(n => n is not null).ToList();
            return list.Count switch
            {
                0 => $"No {noun}s",
                <= 2 => string.Join(" & ", list),
                _ => $"{list.Count} {noun}s",
            };
        }

        return rows.ToDictionary(r => r.Id, r =>
        {
            var ids = AnnouncementAudienceResolver.ParseIds(r.AudienceIds);
            return r.Audience switch
            {
                AnnouncementAudience.AllMembers => "All members",
                AnnouncementAudience.Staff => "Trainers & staff",
                AnnouncementAudience.Branches => Names(ids, branches, "branch"),
                AnnouncementAudience.Plans => Names(ids, plans, "plan"),
                AnnouncementAudience.Tags => Names(ids, tags, "tag"),
                _ => r.Audience.ToString(),
            };
        });
    }

    // ── Everyone: my feed ────────────────────────────────────────────────────

    /// <summary>Announcements delivered to me that haven't expired: pinned first, then newest.</summary>
    public async Task<AnnouncementFeedResponse> GetFeedAsync(int page, int size)
    {
        page = Math.Max(1, page);
        size = Math.Clamp(size, 1, 50);
        var now = DateTime.UtcNow;
        var q = from r in db.AnnouncementRecipients
                join a in db.Announcements on r.AnnouncementId equals a.Id
                where r.UserId == Me && a.Status == AnnouncementStatus.Published && (a.ExpiresAt == null || a.ExpiresAt > now)
                select new { a, r.ReadAt };
        var rows = await q.OrderByDescending(x => x.a.IsPinned).ThenByDescending(x => x.a.PublishedAt)
            .Skip((page - 1) * size).Take(size + 1).ToListAsync();
        var unread = await q.CountAsync(x => x.ReadAt == null);
        return new AnnouncementFeedResponse
        {
            Items = rows.Take(size).Select(x => MapFeed(x.a, x.ReadAt)).ToList(),
            UnreadCount = unread, PageNumber = page, HasMore = rows.Count > size,
        };
    }

    public async Task<int> UnreadCountAsync()
    {
        var now = DateTime.UtcNow;
        return await (from r in db.AnnouncementRecipients
                      join a in db.Announcements on r.AnnouncementId equals a.Id
                      where r.UserId == Me && r.ReadAt == null && a.Status == AnnouncementStatus.Published && (a.ExpiresAt == null || a.ExpiresAt > now)
                      select r).CountAsync();
    }

    /// <summary>The newest unread one (urgent first), for the Home card; null when all are read.</summary>
    public async Task<AnnouncementFeedItem?> LatestUnreadAsync()
    {
        var now = DateTime.UtcNow;
        var row = await (from r in db.AnnouncementRecipients
                         join a in db.Announcements on r.AnnouncementId equals a.Id
                         where r.UserId == Me && r.ReadAt == null && a.Status == AnnouncementStatus.Published && (a.ExpiresAt == null || a.ExpiresAt > now)
                         orderby a.IsUrgent descending, a.PublishedAt descending
                         select a).FirstOrDefaultAsync();
        return row is null ? null : MapFeed(row, null);
    }

    /// <summary>One of my announcements; opening it marks it read.</summary>
    public async Task<AnnouncementFeedItem> GetMineAsync(ulong id)
    {
        var now = DateTime.UtcNow;
        var r = await db.AnnouncementRecipients.FirstOrDefaultAsync(x => x.AnnouncementId == id && x.UserId == Me)
                ?? throw new KeyNotFoundException("Announcement not found.");
        var a = await db.Announcements.FirstOrDefaultAsync(x => x.Id == id && x.Status == AnnouncementStatus.Published && (x.ExpiresAt == null || x.ExpiresAt > now))
                ?? throw new KeyNotFoundException("This announcement is no longer available.");
        if (r.ReadAt is null)
        {
            r.ReadAt = now;
            await db.SaveChangesAsync();
        }
        return MapFeed(a, r.ReadAt);
    }

    public async Task<int> MarkReadAsync(ulong? id)
    {
        var now = DateTime.UtcNow;
        return await db.AnnouncementRecipients.Where(r => r.UserId == Me && r.ReadAt == null && (id == null || r.AnnouncementId == id))
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.ReadAt, now));
    }

    private static AnnouncementFeedItem MapFeed(Announcement a, DateTime? readAt) => new()
    {
        Id = a.Id, Title = a.Title, Body = a.Body, ImageUrl = a.ImageUrl, CtaLabel = a.CtaLabel, CtaRoute = a.CtaRoute,
        IsPinned = a.IsPinned, IsUrgent = a.IsUrgent, PublishedAt = a.PublishedAt ?? a.CreatedAt, IsRead = readAt != null,
    };
}
