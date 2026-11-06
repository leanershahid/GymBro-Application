using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Engagement;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Domain.Entities.Support;
using Microsoft.EntityFrameworkCore;
using S = GymManagmentApplication.Domain.Entities.Support.SupportStatuses;

namespace GymManagmentApplication.Application.Support;

/// <summary>
/// Help &amp; feedback (roadmap feature 6): members raise requests and talk to the gym in a thread;
/// staff with the <c>admin.support</c> module work the queue (assign, prioritise, reply, add internal
/// notes, change status); trainers see only the requests assigned to them.
/// <list type="bullet">
/// <item>Everything is the caller's tenant (global filter, plus explicit tenant ids where filters are bypassed).</item>
/// <item>Internal notes and assignment / priority events are <see cref="SupportMessage.IsInternal"/>
/// and are never mapped for a member (<see cref="MapDetail"/> with <c>staff: false</c>).</item>
/// <item>Member: reply (a reply to a resolved request reopens it within 7 days), rate once after it
/// was resolved, reopen within 7 days. The job closes resolved requests after 7 days.</item>
/// </list>
/// </summary>
public class SupportService(IAppDbContext db, ICurrentUser currentUser, Notifier notifier)
{
    private ulong Me => currentUser.UserId ?? throw new UnauthorizedAccessException("Please sign in again.");
    private ulong TenantId => currentUser.ResolveTenantId();

    // ═════════════════════════════ Member ═════════════════════════════

    /// <summary>FAQ (published, optionally filtered by <paramref name="search"/>), categories and the member's open counts.</summary>
    public async Task<HelpCentreResponse> HelpCentreAsync(string? search)
    {
        var tenantId = TenantId;
        var me = Me;
        var settings = await SupportSettingsStore.LoadAsync(db, tenantId);
        var q = db.SupportFaqs.Where(f => f.IsPublished);
        var term = SupportCommon.Clean(search, 100)?.ToLowerInvariant();
        if (term is not null) q = q.Where(f => f.Question.ToLower().Contains(term) || f.Answer.ToLower().Contains(term));
        var faqs = (await q.OrderBy(f => f.SortOrder).Take(100).ToListAsync()).OrderBy(f => f.SortOrder).ThenBy(f => f.Id).ToList();
        var mine = await db.SupportRequests.Where(r => r.UserId == me && (r.Status == S.Open || r.Status == S.Waiting))
            .Select(r => r.Status).ToListAsync();
        return new HelpCentreResponse
        {
            Faqs = faqs.Select(SupportContentService.MapFaq).ToList(),
            Categories = SupportCategories.All.Select(c => new SupportCategoryDto { Key = c, Label = SupportCategories.Label(c) }).ToList(),
            RequestsEnabled = settings.RequestsEnabled,
            OpenRequests = mine.Count,
            WaitingOnYou = mine.Count(s => s == S.Waiting),
            FirstResponseHours = settings.FirstResponseHours,
        };
    }

    public async Task<List<SupportRequestSummary>> MineAsync()
    {
        var me = Me;
        var rows = await db.SupportRequests.AsNoTracking().Where(r => r.UserId == me)
            .OrderByDescending(r => r.LastMessageAt).Take(100).ToListAsync();
        return await MapSummariesAsync(rows, staff: false);
    }

    public async Task<SupportRequestDetail> MineAsync(ulong id)
    {
        var me = Me;
        var r = await db.SupportRequests.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id && x.UserId == me)
                ?? throw new KeyNotFoundException("Request not found.");
        return await MapDetailAsync(r, staff: false);
    }

    public async Task<SupportRequestDetail> CreateAsync(CreateSupportRequestBody body)
    {
        var me = Me;
        var tenantId = TenantId;
        var settings = await SupportSettingsStore.LoadAsync(db, tenantId);
        if (!settings.RequestsEnabled) throw RuleException.Unprocessable("Your gym isn't taking requests in the app right now. Please contact the front desk.");

        var category = SupportCommon.Category(body.Category);
        var subject = SupportCommon.Required(body.Subject, 150, "Subject");
        var message = SupportCommon.Required(body.Message, 4000, "Message");
        var photos = SupportCommon.Photos(body.Photos, tenantId);
        if (body.BranchId is { } branchId && !await db.Branches.AnyAsync(b => b.Id == branchId && b.TenantId == tenantId))
            throw new ArgumentException("Branch not found.");

        var request = await db.InTransactionAsync(async () =>
        {
            // One submission at a time per member (double-tap safe).
            await db.LockRowAsync<Domain.Entities.Identity.User>(me);
            var cutoff = DateTime.UtcNow.AddSeconds(-30);
            var duplicate = await db.SupportRequests.FirstOrDefaultAsync(r => r.UserId == me && r.Subject == subject && r.CreatedAt > cutoff);
            if (duplicate is not null) return duplicate;

            var now = DateTime.UtcNow;
            var r = new SupportRequest
            {
                TenantId = tenantId, UserId = me, BranchId = body.BranchId, Category = category, Subject = subject,
                Status = S.Open, Priority = SupportPriorities.Normal, CanContact = body.CanContact,
                ContactMethod = SupportCommon.ContactMethod(body.CanContact, body.ContactMethod),
                LastMessageAt = now, LastMessageBy = SupportAuthorRoles.Member, CreatedAt = now, UpdatedAt = now,
            };
            r.Messages.Add(new SupportMessage
            {
                TenantId = tenantId, AuthorId = me, AuthorRole = SupportAuthorRoles.Member, Kind = SupportMessageKinds.Message,
                Body = message, Photos = photos, CreatedAt = now, UpdatedAt = now,
            });
            db.SupportRequests.Add(r);
            await db.SaveChangesAsync();

            var who = await MemberNameAsync(me);
            foreach (var staff in await SupportCommon.StaffRecipientsAsync(db, tenantId))
                notifier.Add(tenantId, staff, $"New help request: {SupportCategories.Label(category)}",
                    $"{who}: {subject}", SupportCommon.StaffKind, r.Id);
            await db.SaveChangesAsync();
            return r;
        });
        return await MapDetailAsync(request, staff: false);
    }

    /// <summary>The member replies. Waiting → open; a resolved request reopens (within 7 days); closed ones can't take replies.</summary>
    public async Task<SupportRequestDetail> MemberReplyAsync(ulong id, SupportReplyBody body)
    {
        var me = Me;
        var tenantId = TenantId;
        var text = SupportCommon.Required(body.Body, 4000, "Message");
        var photos = SupportCommon.Photos(body.Photos, tenantId);
        var r = await db.InTransactionAsync(async () =>
        {
            await db.LockRowAsync<SupportRequest>(id);
            var x = await db.SupportRequests.FirstOrDefaultAsync(q => q.Id == id && q.UserId == me)
                    ?? throw new KeyNotFoundException("Request not found.");
            var now = DateTime.UtcNow;
            if (x.Status == S.Closed) throw RuleException.Conflict("This request is closed. Start a new one and we'll pick it up.");
            if (x.Status == S.Resolved)
            {
                if (!CanReopen(x, now)) throw RuleException.Conflict($"This request was resolved more than {SupportCommon.ReopenDays} days ago. Start a new one and we'll pick it up.");
                Reopen(x, now);
            }
            else x.Status = S.Open;

            AddMessage(x, me, SupportAuthorRoles.Member, SupportMessageKinds.Message, text, photos, isInternal: false, now);
            x.LastMessageAt = now;
            x.LastMessageBy = SupportAuthorRoles.Member;
            await db.SaveChangesAsync();
            await NotifyStaffOfMemberAsync(x, "New reply on a help request", text);
            await db.SaveChangesAsync();
            return x;
        });
        return await MapDetailAsync(r, staff: false);
    }

    /// <summary>"Rate this help": 1–5 + comment, once, after the request was resolved.</summary>
    public async Task<SupportRequestDetail> RateAsync(ulong id, RateSupportBody body)
    {
        var me = Me;
        if (body.Score is < 1 or > 5) throw new ArgumentException("Pick 1 to 5 stars.");
        var r = await db.InTransactionAsync(async () =>
        {
            await db.LockRowAsync<SupportRequest>(id);
            var x = await db.SupportRequests.FirstOrDefaultAsync(q => q.Id == id && q.UserId == me)
                    ?? throw new KeyNotFoundException("Request not found.");
            if (x.Rating is not null) throw RuleException.Conflict("You've already rated this request — thank you!");
            if (x.Status is not (S.Resolved or S.Closed)) throw RuleException.Unprocessable("You can rate a request once it's resolved.");
            var now = DateTime.UtcNow;
            x.Rating = (byte)body.Score;
            x.RatingComment = SupportCommon.Clean(body.Comment, 1000);
            x.RatedAt = now;
            AddMessage(x, me, SupportAuthorRoles.Member, SupportMessageKinds.Event, $"Rated {body.Score}/5", null, isInternal: false, now);
            await db.SaveChangesAsync();
            return x;
        });
        return await MapDetailAsync(r, staff: false);
    }

    /// <summary>Reopens a resolved request within 7 days of it being resolved.</summary>
    public async Task<SupportRequestDetail> ReopenAsync(ulong id, ReopenSupportBody? body)
    {
        var me = Me;
        var text = SupportCommon.Clean(body?.Message, 4000);
        var r = await db.InTransactionAsync(async () =>
        {
            await db.LockRowAsync<SupportRequest>(id);
            var x = await db.SupportRequests.FirstOrDefaultAsync(q => q.Id == id && q.UserId == me)
                    ?? throw new KeyNotFoundException("Request not found.");
            var now = DateTime.UtcNow;
            if (S.IsActive(x.Status)) throw RuleException.Conflict("This request is already open.");
            if (!CanReopen(x, now))
                throw RuleException.Conflict(x.Status == S.Closed
                    ? "This request is closed. Start a new one and we'll pick it up."
                    : $"Requests can be reopened for {SupportCommon.ReopenDays} days after they're resolved. Start a new one and we'll pick it up.");
            Reopen(x, now);
            AddMessage(x, me, SupportAuthorRoles.Member, SupportMessageKinds.Event, "Reopened", null, isInternal: false, now);
            if (text is not null) AddMessage(x, me, SupportAuthorRoles.Member, SupportMessageKinds.Message, text, null, isInternal: false, now.AddMilliseconds(1));
            x.LastMessageAt = now;
            x.LastMessageBy = SupportAuthorRoles.Member;
            await db.SaveChangesAsync();
            await NotifyStaffOfMemberAsync(x, "Help request reopened", text ?? x.Subject);
            await db.SaveChangesAsync();
            return x;
        });
        return await MapDetailAsync(r, staff: false);
    }

    /// <summary>The member says it's sorted.</summary>
    public async Task<SupportRequestDetail> MemberResolveAsync(ulong id)
    {
        var me = Me;
        var r = await db.InTransactionAsync(async () =>
        {
            await db.LockRowAsync<SupportRequest>(id);
            var x = await db.SupportRequests.FirstOrDefaultAsync(q => q.Id == id && q.UserId == me)
                    ?? throw new KeyNotFoundException("Request not found.");
            if (!S.IsActive(x.Status)) return x;
            var now = DateTime.UtcNow;
            x.Status = S.Resolved;
            x.ResolvedAt = now;
            AddMessage(x, me, SupportAuthorRoles.Member, SupportMessageKinds.Event, "Marked as resolved by the member", null, isInternal: false, now);
            await db.SaveChangesAsync();
            return x;
        });
        return await MapDetailAsync(r, staff: false);
    }

    public static bool CanReopen(SupportRequest r, DateTime now) =>
        r.Status == S.Resolved && r.ResolvedAt is { } at && now <= at.AddDays(SupportCommon.ReopenDays);

    private static void Reopen(SupportRequest x, DateTime now)
    {
        x.Status = S.Open;
        x.ReopenedAt = now;
        x.ReopenCount++;
        x.ResolvedAt = null;
        x.ClosedAt = null;
    }

    // ═════════════════════════════ Staff / trainer ═════════════════════════════

    /// <summary>The requests the caller may work: all of the gym's (staff), or only those assigned to them (trainer view).</summary>
    private IQueryable<SupportRequest> Scope(bool assignedOnly)
    {
        var me = Me;
        return assignedOnly ? db.SupportRequests.Where(r => r.AssigneeId == me) : db.SupportRequests;
    }

    public async Task<PagedResponse<SupportRequestSummary>> QueueAsync(SupportQueueFilter f, bool assignedOnly = false)
    {
        var tenantId = TenantId;
        var me = Me;
        var settings = await SupportSettingsStore.LoadAsync(db, tenantId);
        var now = DateTime.UtcNow;
        var q = Scope(assignedOnly).AsNoTracking();

        var status = (f.Status ?? "active").Trim().ToLowerInvariant();
        q = status switch
        {
            "active" or "" => q.Where(r => r.Status == S.Open || r.Status == S.Waiting),
            "all" => q,
            var s when S.All.Contains(s) => q.Where(r => r.Status == s),
            _ => throw new ArgumentException("Status: active, open, waiting, resolved, closed or all."),
        };
        if (!string.IsNullOrWhiteSpace(f.Category)) { var c = SupportCommon.Category(f.Category); q = q.Where(r => r.Category == c); }
        if (!string.IsNullOrWhiteSpace(f.Priority))
        {
            var p = f.Priority.Trim().ToLowerInvariant();
            if (!SupportPriorities.All.Contains(p)) throw new ArgumentException("Priority: low, normal, high or urgent.");
            q = q.Where(r => r.Priority == p);
        }
        switch ((f.Assignee ?? "").Trim().ToLowerInvariant())
        {
            case "": break;
            case "me": q = q.Where(r => r.AssigneeId == me); break;
            case "none": q = q.Where(r => r.AssigneeId == null); break;
            case var a when ulong.TryParse(a, out var aid): q = q.Where(r => r.AssigneeId == aid); break;
            default: throw new ArgumentException("Assignee: me, none or a staff id.");
        }
        if (f.BranchId is { } b) q = q.Where(r => r.BranchId == b);
        if (f.MemberId is { } m) q = q.Where(r => r.UserId == m);
        if (f.Overdue) q = q.WhereOverdue(settings, now);
        var term = SupportCommon.Clean(f.Search, 100)?.ToLowerInvariant();
        if (term is not null)
        {
            var idTerm = ulong.TryParse(term.TrimStart('#'), out var n) ? n : 0;
            var memberIds = db.Users.IgnoreQueryFilters()
                .Where(u => u.TenantId == tenantId && ((u.FirstName + " " + u.LastName).ToLower().Contains(term) || u.Email.ToLower().Contains(term)))
                .Select(u => u.Id);
            q = q.Where(r => r.Id == idTerm || r.Subject.ToLower().Contains(term) || memberIds.Contains(r.UserId));
        }

        var (page, size) = Paging.Clamp(f.Page, f.Size);
        var total = await q.CountAsync();
        // Urgent first, then the oldest activity waiting on the gym.
        var rows = await q
            .OrderBy(r => r.Status == S.Open ? 0 : r.Status == S.Waiting ? 1 : 2)
            .ThenBy(r => r.Priority == SupportPriorities.Urgent ? 0 : r.Priority == SupportPriorities.High ? 1 : r.Priority == SupportPriorities.Normal ? 2 : 3)
            .ThenByDescending(r => r.LastMessageAt)
            .Page(page, size).ToListAsync();
        return new PagedResponse<SupportRequestSummary>
        {
            Items = await MapSummariesAsync(rows, staff: true, settings, now), PageNumber = page, PageSize = size, TotalRecords = total,
        };
    }

    public async Task<SupportCountResponse> CountAsync(bool assignedOnly = false)
    {
        var tenantId = TenantId;
        var me = Me;
        var settings = await SupportSettingsStore.LoadAsync(db, tenantId);
        var now = DateTime.UtcNow;
        var active = Scope(assignedOnly).Where(r => r.Status == S.Open || r.Status == S.Waiting);
        var unassigned = await active.Where(r => r.AssigneeId == null).Select(r => r.Id).ToListAsync();
        var overdue = await active.WhereOverdue(settings, now).Select(r => r.Id).ToListAsync();
        return new SupportCountResponse
        {
            Unassigned = unassigned.Count,
            Overdue = overdue.Count,
            Open = await active.CountAsync(r => r.Status == S.Open),
            Mine = await active.CountAsync(r => r.AssigneeId == me),
            Badge = assignedOnly ? await active.CountAsync() : unassigned.Union(overdue).Count(),
        };
    }

    public async Task<SupportRequestDetail> GetAsync(ulong id, bool assignedOnly = false)
    {
        var r = await Scope(assignedOnly).AsNoTracking().FirstOrDefaultAsync(x => x.Id == id)
                ?? throw new KeyNotFoundException("Request not found.");
        return await MapDetailAsync(r, staff: true);
    }

    /// <summary>A reply the member sees (default status after it: waiting on the member), or an internal note.</summary>
    public async Task<SupportRequestDetail> StaffReplyAsync(ulong id, SupportReplyBody body, bool assignedOnly = false)
    {
        var me = Me;
        var tenantId = TenantId;
        var text = SupportCommon.Required(body.Body, 4000, body.Internal ? "Note" : "Reply");
        var photos = SupportCommon.Photos(body.Photos, tenantId);
        string? newStatus = null;
        if (!body.Internal)
        {
            newStatus = (body.Status ?? S.Waiting).Trim().ToLowerInvariant();
            if (!S.All.Contains(newStatus)) throw new ArgumentException("Status: open, waiting, resolved or closed.");
        }

        var r = await db.InTransactionAsync(async () =>
        {
            await db.LockRowAsync<SupportRequest>(id);
            var x = await Scope(assignedOnly).FirstOrDefaultAsync(q => q.Id == id) ?? throw new KeyNotFoundException("Request not found.");
            var now = DateTime.UtcNow;
            if (body.Internal)
            {
                AddMessage(x, me, SupportAuthorRoles.Staff, SupportMessageKinds.Note, text, photos, isInternal: true, now);
                await db.SaveChangesAsync();
                if (x.AssigneeId is { } a && a != me)
                    notifier.Add(tenantId, a, "New note on a help request", SupportCommon.Preview(text), SupportCommon.StaffKind, x.Id);
                await db.SaveChangesAsync();
                return x;
            }

            var before = x.Status;
            AddMessage(x, me, SupportAuthorRoles.Staff, SupportMessageKinds.Message, text, photos, isInternal: false, now);
            x.FirstResponseAt ??= now;
            x.AssigneeId ??= me; // whoever answers an unassigned request owns it
            x.LastMessageAt = now;
            x.LastMessageBy = SupportAuthorRoles.Staff;
            ApplyStatus(x, newStatus!, now);
            if (newStatus != before && newStatus is S.Resolved or S.Closed)
                AddMessage(x, me, SupportAuthorRoles.Staff, SupportMessageKinds.Event, EventText(newStatus), null, isInternal: false, now.AddMilliseconds(1));
            await db.SaveChangesAsync();

            var gym = await GymNameAsync(tenantId);
            notifier.Add(tenantId, x.UserId,
                newStatus == S.Resolved ? $"{gym} resolved your request" : $"{gym} replied to your request",
                $"{x.Subject}: {SupportCommon.Preview(text)}", SupportCommon.MemberKind, x.Id);
            await db.SaveChangesAsync();
            return x;
        });
        return await MapDetailAsync(r, staff: true);
    }

    public async Task<SupportRequestDetail> SetStatusAsync(ulong id, SupportStatusBody body, bool assignedOnly = false)
    {
        var me = Me;
        var tenantId = TenantId;
        var status = (body.Status ?? "").Trim().ToLowerInvariant();
        if (!S.All.Contains(status)) throw new ArgumentException("Status: open, waiting, resolved or closed.");
        var r = await db.InTransactionAsync(async () =>
        {
            await db.LockRowAsync<SupportRequest>(id);
            var x = await Scope(assignedOnly).FirstOrDefaultAsync(q => q.Id == id) ?? throw new KeyNotFoundException("Request not found.");
            if (x.Status == status) return x;
            var now = DateTime.UtcNow;
            if (status == S.Open && x.Status is S.Resolved or S.Closed) { x.ReopenedAt = now; x.ReopenCount++; }
            ApplyStatus(x, status, now);
            AddMessage(x, me, SupportAuthorRoles.Staff, SupportMessageKinds.Event, EventText(status), null, isInternal: false, now);
            await db.SaveChangesAsync();
            var gym = await GymNameAsync(tenantId);
            notifier.Add(tenantId, x.UserId, $"Your request is now {SupportCommon.StatusLabel(status).ToLowerInvariant()}",
                $"{gym}: {x.Subject}", SupportCommon.MemberKind, x.Id);
            await db.SaveChangesAsync();
            return x;
        });
        return await MapDetailAsync(r, staff: true);
    }

    public async Task<SupportRequestDetail> AssignAsync(ulong id, AssignSupportBody body)
    {
        var me = Me;
        var tenantId = TenantId;
        string? assigneeName = null;
        if (body.AssigneeId is { } aid)
        {
            var staff = (await StaffOptionsAsync()).FirstOrDefault(s => s.Id == aid)
                        ?? throw new ArgumentException("Pick a staff member or trainer of this gym.");
            assigneeName = staff.Name;
        }
        var r = await db.InTransactionAsync(async () =>
        {
            await db.LockRowAsync<SupportRequest>(id);
            var x = await db.SupportRequests.FirstOrDefaultAsync(q => q.Id == id) ?? throw new KeyNotFoundException("Request not found.");
            if (x.AssigneeId == body.AssigneeId) return x;
            x.AssigneeId = body.AssigneeId;
            AddMessage(x, me, SupportAuthorRoles.Staff, SupportMessageKinds.Event,
                assigneeName is null ? "Unassigned" : $"Assigned to {assigneeName}", null, isInternal: true, DateTime.UtcNow);
            await db.SaveChangesAsync();
            if (body.AssigneeId is { } a)
                notifier.Add(tenantId, a, "Help request assigned to you", $"{SupportCategories.Label(x.Category)}: {x.Subject}", SupportCommon.StaffKind, x.Id);
            await db.SaveChangesAsync();
            return x;
        });
        return await MapDetailAsync(r, staff: true);
    }

    public async Task<SupportRequestDetail> SetPriorityAsync(ulong id, SupportPriorityBody body)
    {
        var me = Me;
        var p = (body.Priority ?? "").Trim().ToLowerInvariant();
        if (!SupportPriorities.All.Contains(p)) throw new ArgumentException("Priority: low, normal, high or urgent.");
        var x = await db.SupportRequests.FirstOrDefaultAsync(q => q.Id == id) ?? throw new KeyNotFoundException("Request not found.");
        if (x.Priority != p)
        {
            x.Priority = p;
            AddMessage(x, me, SupportAuthorRoles.Staff, SupportMessageKinds.Event, $"Priority set to {p}", null, isInternal: true, DateTime.UtcNow);
            await db.SaveChangesAsync();
        }
        return await MapDetailAsync(x, staff: true);
    }

    /// <summary>People a request can be assigned to: the gym's admins, staff / custom roles and trainers (not members).</summary>
    public async Task<List<SupportStaffOption>> StaffOptionsAsync()
    {
        var tenantId = TenantId;
        var rows = await (from u in db.Users.IgnoreQueryFilters()
                          join role in db.Roles.IgnoreQueryFilters() on u.RoleId equals role.Id
                          where u.TenantId == tenantId && u.DeletedAt == null
                                && role.Slug != RoleNames.Client && role.Slug != RoleNames.SuperAdmin
                          orderby u.FirstName, u.LastName
                          select new { u.Id, u.FirstName, u.LastName, role.Name, role.Slug }).ToListAsync();
        return rows.Select(u => new SupportStaffOption { Id = u.Id, Name = SupportCommon.Name(u.FirstName, u.LastName, "Staff"), Role = u.Name ?? u.Slug }).ToList();
    }

    private static void ApplyStatus(SupportRequest x, string status, DateTime now)
    {
        x.Status = status;
        switch (status)
        {
            case S.Resolved: x.ResolvedAt = now; x.ClosedAt = null; break;
            case S.Closed: x.ResolvedAt ??= now; x.ClosedAt = now; break;
            default: x.ResolvedAt = null; x.ClosedAt = null; break;
        }
    }

    private static string EventText(string status) => status switch
    {
        S.Resolved => "Marked as resolved",
        S.Closed => "Closed",
        S.Waiting => "Waiting on the member",
        _ => "Reopened",
    };

    // ═════════════════════════════ Shared ═════════════════════════════

    private void AddMessage(SupportRequest x, ulong? author, string role, string kind, string body, System.Text.Json.JsonDocument? photos, bool isInternal, DateTime at) =>
        db.SupportMessages.Add(new SupportMessage
        {
            TenantId = x.TenantId, RequestId = x.Id, AuthorId = author, AuthorRole = role, Kind = kind,
            IsInternal = isInternal || kind == SupportMessageKinds.Note, Body = body, Photos = photos, CreatedAt = at, UpdatedAt = at,
        });

    /// <summary>The assignee hears about the member's reply; without one, the gym's support staff do.</summary>
    private async Task NotifyStaffOfMemberAsync(SupportRequest x, string title, string text)
    {
        var who = await MemberNameAsync(x.UserId);
        var recipients = x.AssigneeId is { } a ? [a] : await SupportCommon.StaffRecipientsAsync(db, x.TenantId);
        foreach (var staff in recipients)
            notifier.Add(x.TenantId, staff, title, $"{who}: {SupportCommon.Preview(text)}", SupportCommon.StaffKind, x.Id);
    }

    private async Task<string> MemberNameAsync(ulong userId)
    {
        var u = await db.Users.IgnoreQueryFilters().AsNoTracking().Where(x => x.Id == userId)
            .Select(x => new { x.FirstName, x.LastName }).FirstOrDefaultAsync();
        return SupportCommon.Name(u?.FirstName, u?.LastName);
    }

    private async Task<string> GymNameAsync(ulong tenantId) =>
        await db.Tenants.IgnoreQueryFilters().Where(t => t.Id == tenantId).Select(t => t.Name).FirstOrDefaultAsync() ?? "Your gym";

    private async Task<List<SupportRequestSummary>> MapSummariesAsync(List<SupportRequest> rows, bool staff, SupportSettings? settings = null, DateTime? now = null)
    {
        if (rows.Count == 0) return [];
        var tenantId = rows[0].TenantId;
        var ids = rows.Select(r => r.Id).ToList();
        var latest = (await db.SupportMessages.AsNoTracking()
                .Where(m => ids.Contains(m.RequestId) && m.Kind != SupportMessageKinds.Event && (staff || !m.IsInternal))
                .Select(m => new { m.RequestId, m.Body, m.CreatedAt, m.Id }).ToListAsync())
            .GroupBy(m => m.RequestId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(m => m.CreatedAt).ThenByDescending(m => m.Id).First().Body);
        var branchIds = rows.Where(r => r.BranchId != null).Select(r => r.BranchId!.Value).Distinct().ToList();
        var branches = branchIds.Count == 0 ? [] : await db.Branches.IgnoreQueryFilters()
            .Where(b => b.TenantId == tenantId && branchIds.Contains(b.Id)).ToDictionaryAsync(b => b.Id, b => b.Name);
        Dictionary<ulong, string> people = [];
        if (staff)
        {
            var userIds = rows.Select(r => r.UserId).Concat(rows.Where(r => r.AssigneeId != null).Select(r => r.AssigneeId!.Value)).Distinct().ToList();
            people = (await db.Users.IgnoreQueryFilters().Where(u => u.TenantId == tenantId && userIds.Contains(u.Id))
                    .Select(u => new { u.Id, u.FirstName, u.LastName }).ToListAsync())
                .ToDictionary(u => u.Id, u => SupportCommon.Name(u.FirstName, u.LastName));
            settings ??= await SupportSettingsStore.LoadAsync(db, tenantId);
        }
        var at = now ?? DateTime.UtcNow;
        return rows.Select(r => Fill(new SupportRequestSummary(), r, staff, latest.GetValueOrDefault(r.Id), branches, people, settings, at)).ToList();
    }

    private static T Fill<T>(T s, SupportRequest r, bool staff, string? preview, Dictionary<ulong, string> branches,
        Dictionary<ulong, string> people, SupportSettings? settings, DateTime now) where T : SupportRequestSummary
    {
        s.Id = r.Id;
        s.Category = r.Category;
        s.CategoryLabel = SupportCategories.Label(r.Category);
        s.Subject = r.Subject;
        s.Status = r.Status;
        s.Priority = r.Priority;
        s.CreatedAt = r.CreatedAt;
        s.LastMessageAt = r.LastMessageAt;
        s.LastMessageBy = r.LastMessageBy;
        s.Preview = preview is null ? null : SupportCommon.Preview(preview);
        s.BranchId = r.BranchId;
        s.BranchName = r.BranchId is { } b ? branches.GetValueOrDefault(b) : null;
        s.Rating = r.Rating;
        if (staff)
        {
            s.MemberId = r.UserId;
            s.MemberName = people.GetValueOrDefault(r.UserId) ?? "A member";
            s.AssigneeId = r.AssigneeId;
            s.AssigneeName = r.AssigneeId is { } a ? people.GetValueOrDefault(a) : null;
            if (settings is not null) s.Sla = SupportSlaDto.From(SupportSla.Evaluate(r, settings, now));
        }
        return s;
    }

    /// <summary>The request with its thread. <paramref name="staff"/> false = the member's view: internal notes and events are left out.</summary>
    private async Task<SupportRequestDetail> MapDetailAsync(SupportRequest r, bool staff)
    {
        var tenantId = r.TenantId;
        var now = DateTime.UtcNow;
        var messages = (await db.SupportMessages.AsNoTracking()
            .Where(m => m.RequestId == r.Id && (staff || !m.IsInternal))
            .ToListAsync()).OrderBy(m => m.CreatedAt).ThenBy(m => m.Id).ToList();
        var authorIds = messages.Where(m => m.AuthorId != null).Select(m => m.AuthorId!.Value)
            .Append(r.UserId).Concat(r.AssigneeId is { } a ? [a] : []).Distinct().ToList();
        var users = await db.Users.IgnoreQueryFilters().AsNoTracking().Where(u => u.TenantId == tenantId && authorIds.Contains(u.Id))
            .Select(u => new { u.Id, u.FirstName, u.LastName, u.Email, u.Phone }).ToListAsync();
        var names = users.ToDictionary(u => u.Id, u => SupportCommon.Name(u.FirstName, u.LastName, "Staff"));
        var branches = r.BranchId is { } bid
            ? await db.Branches.IgnoreQueryFilters().Where(b => b.Id == bid && b.TenantId == tenantId).ToDictionaryAsync(b => b.Id, b => b.Name)
            : [];
        var settings = staff ? await SupportSettingsStore.LoadAsync(db, tenantId) : null;
        var gym = staff ? null : await GymNameAsync(tenantId);
        var me = currentUser.UserId;

        var lastVisible = messages.LastOrDefault(m => m.Kind != SupportMessageKinds.Event && (staff || !m.IsInternal))?.Body;
        var d = Fill(new SupportRequestDetail(), r, staff, lastVisible, branches, names, settings, now);
        d.CanContact = r.CanContact;
        d.ContactMethod = r.ContactMethod;
        d.FirstResponseAt = r.FirstResponseAt;
        d.ResolvedAt = r.ResolvedAt;
        d.ClosedAt = r.ClosedAt;
        d.ReopenCount = r.ReopenCount;
        d.RatingComment = r.RatingComment;
        d.CanReply = r.Status != S.Closed && (S.IsActive(r.Status) || CanReopen(r, now));
        d.CanRate = r.Rating is null && r.Status is S.Resolved or S.Closed;
        d.CanReopen = CanReopen(r, now);
        d.ReopenUntil = r.Status == S.Resolved && r.ResolvedAt is { } ra ? ra.AddDays(SupportCommon.ReopenDays) : null;
        d.Messages = messages.Select(m => new SupportMessageDto
        {
            Id = m.Id, Kind = m.Kind, AuthorRole = m.AuthorRole, AuthorId = staff || m.AuthorRole == SupportAuthorRoles.Member ? m.AuthorId : null,
            // Members see the gym's name on staff replies, staff see who wrote what.
            AuthorName = m.AuthorRole == SupportAuthorRoles.Member
                ? (m.AuthorId is { } mid ? names.GetValueOrDefault(mid) : null)
                : staff ? (m.AuthorId is { } sid ? names.GetValueOrDefault(sid) : null) : (m.AuthorId is { } sid2 ? FirstName(names.GetValueOrDefault(sid2)) ?? gym : gym),
            IsInternal = m.IsInternal, Mine = m.AuthorId != null && m.AuthorId == me,
            Body = m.Body, Photos = SupportCommon.PhotoList(m.Photos), CreatedAt = m.CreatedAt,
        }).ToList();
        if (staff)
        {
            var member = users.FirstOrDefault(u => u.Id == r.UserId);
            d.MemberEmail = member?.Email;
            d.MemberPhone = member?.Phone;
            d.MemberOtherRequests = await db.SupportRequests.CountAsync(x => x.UserId == r.UserId && x.Id != r.Id);
        }
        return d;
    }

    private static string? FirstName(string? full) => string.IsNullOrWhiteSpace(full) ? null : full.Split(' ')[0];
}
