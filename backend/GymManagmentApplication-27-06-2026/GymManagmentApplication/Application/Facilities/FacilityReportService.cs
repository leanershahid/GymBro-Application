using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Engagement;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Domain.Entities.Facilities;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Facilities;

/// <summary>
/// "Report a problem" (members, trainers, staff) and the staff triage queue.
/// <list type="bullet">
/// <item>Duplicate guard: one open report per asset. A second report for it is refused with 409
/// <c>ALREADY_REPORTED</c> (the existing report in <c>data</c>); the app offers "+1 / add a comment"
/// instead, which makes the caller a follower who hears when it's fixed.</item>
/// <item>Unsafe reports are urgent: staff get an urgent push (skips quiet hours) suggesting to mark
/// the asset out of service.</item>
/// <item>Closing (Fixed / Can't reproduce) tells the reporter and every follower.</item>
/// </list>
/// </summary>
public class FacilityReportService(IAppDbContext db, ICurrentUser currentUser, Notifier notifier, FacilityAssetService assets)
{
    private ulong Me => currentUser.UserId ?? throw new UnauthorizedAccessException("Please sign in again.");
    private ulong TenantId => currentUser.ResolveTenantId();

    // ═════════════════════════════ Reporters ═════════════════════════════

    public async Task<MyReportDetail> CreateAsync(CreateReportRequest r)
    {
        var me = Me;
        var tenantId = TenantId;
        var settings = await FacilitiesCommon.LoadSettingsAsync(db, tenantId);
        if (!assets.CanReport(settings)) throw new UnauthorizedAccessException("Your gym doesn't take problem reports in the app. Please tell the front desk.");

        var type = (r.ProblemType ?? "").Trim().ToLowerInvariant();
        if (!ProblemTypes.All.Contains(type)) throw new ArgumentException("Pick what's wrong.");
        var branch = await db.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == r.BranchId) ?? throw new ArgumentException("Pick your branch.");
        var description = FacilitiesCommon.Clean(r.Description, 2000, "The description");
        var photos = FacilitiesCommon.JoinUrls(r.PhotoUrls, FacilitiesCommon.MaxPhotos, "photos");

        FacilityAsset? asset = null;
        string? other = null;
        if (r.AssetId is { } assetId)
        {
            asset = await db.FacilityAssets.AsNoTracking().FirstOrDefaultAsync(a => a.Id == assetId && a.BranchId == branch.Id && a.ArchivedAt == null)
                    ?? throw new ArgumentException("That machine isn't in this branch.");
        }
        else
        {
            other = FacilitiesCommon.Clean(r.OtherLocation, 200, "Where it is") ?? throw new ArgumentException("Say where the problem is.");
            if (description is null && type == ProblemTypes.Other) throw new ArgumentException("Tell us a little about the problem.");
        }

        var since = DateTime.UtcNow.AddDays(-1);
        if (await db.FacilityReports.CountAsync(x => x.ReporterUserId == me && x.CreatedAt > since) >= FacilitiesCommon.MaxReportsPerDay)
            throw new RuleException("You've sent a lot of reports today. Please tell the front desk about anything else.", 429) { Code = "REPORT_RATE_LIMITED" };

        var report = await db.InTransactionAsync(async () =>
        {
            if (asset is not null)
            {
                // Serialise reports of the same machine so two people can't both open one.
                await db.LockRowAsync<FacilityAsset>(asset.Id);
                var existing = await OpenReportForAsync(asset.Id);
                if (existing is not null)
                    throw new RuleException("Already reported — we're on it.", RuleException.ConflictStatus)
                    {
                        Code = "ALREADY_REPORTED", Payload = await ExistingDtoAsync(existing, asset.Name, me),
                    };
            }

            var now = DateTime.UtcNow;
            var row = new FacilityReport
            {
                TenantId = tenantId, BranchId = branch.Id, AssetId = asset?.Id, OtherLocation = other, ProblemType = type,
                Description = description, PhotoUrls = photos, ReporterUserId = me, IsUrgent = type == ProblemTypes.Unsafe,
                LastActivityAt = now,
            };
            db.FacilityReports.Add(row);
            await db.SaveChangesAsync();

            if (row.IsUrgent || settings.NotifyStaffOnEveryReport)
                await NotifyStaffAsync(row, asset?.Name ?? other!, branch.Name, escalated: false);
            await db.SaveChangesAsync();
            return row;
        });
        return await MemberDetailAsync(report, me);
    }

    /// <summary>The open report for an asset, if any (the app checks before showing the form).</summary>
    public async Task<ExistingReportDto?> OpenForAssetAsync(ulong assetId)
    {
        var asset = await db.FacilityAssets.AsNoTracking().FirstOrDefaultAsync(a => a.Id == assetId) ?? throw new KeyNotFoundException("Asset not found.");
        var open = await OpenReportForAsync(assetId);
        return open is null ? null : await ExistingDtoAsync(open, asset.Name, Me);
    }

    /// <summary>"Me too": follows the report (hears when it's fixed), optionally with a comment; "unsafe" escalates it.</summary>
    public async Task<MyReportDetail> PlusOneAsync(ulong id, PlusOneRequest r)
    {
        var me = Me;
        var row = await db.FacilityReports.FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Report not found.");
        if (!FacilitiesCommon.IsOpen(row.Status)) throw RuleException.Conflict("This report is already closed. Send a new one if the problem is back.");
        var comment = FacilitiesCommon.Clean(r.Comment, 1000, "The comment");
        var now = DateTime.UtcNow;

        if (row.ReporterUserId != me && !await db.FacilityReportFollowers.AnyAsync(f => f.ReportId == id && f.UserId == me))
        {
            db.FacilityReportFollowers.Add(new FacilityReportFollower { ReportId = id, UserId = me, TenantId = row.TenantId, CreatedAt = now });
            row.PlusOneCount++;
        }
        if (comment is not null)
            db.FacilityReportComments.Add(new FacilityReportComment { TenantId = row.TenantId, ReportId = id, UserId = me, Body = comment, CreatedAt = now });
        row.LastActivityAt = now;

        if (r.Unsafe && !row.IsUrgent)
        {
            row.IsUrgent = true;
            var subject = await SubjectAsync(row);
            var branch = await db.Branches.Where(b => b.Id == row.BranchId).Select(b => b.Name).FirstOrDefaultAsync() ?? "";
            await NotifyStaffAsync(row, subject, branch, escalated: true);
        }
        await db.SaveChangesAsync();
        return await MemberDetailAsync(row, me);
    }

    public async Task<List<MyReportDto>> GetMineAsync()
    {
        var me = Me;
        var followed = db.FacilityReportFollowers.Where(f => f.UserId == me).Select(f => f.ReportId);
        var rows = await db.FacilityReports.AsNoTracking()
            .Where(r => r.ReporterUserId == me || followed.Contains(r.Id))
            .OrderByDescending(r => r.CreatedAt).Take(100).ToListAsync();
        var ctx = await ContextAsync(rows);
        return rows.Select(r => { var d = new MyReportDto(); FillBase(d, r, ctx, me); return d; }).ToList();
    }

    public async Task<MyReportDetail> GetMineAsync(ulong id)
    {
        var me = Me;
        var row = await db.FacilityReports.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id) ?? throw new KeyNotFoundException("Report not found.");
        if (row.ReporterUserId != me && !await db.FacilityReportFollowers.AnyAsync(f => f.ReportId == id && f.UserId == me))
            throw new KeyNotFoundException("Report not found.");
        return await MemberDetailAsync(row, me);
    }

    public async Task<MyReportDetail> CommentMineAsync(ulong id, CommentRequest r)
    {
        var me = Me;
        var row = await db.FacilityReports.FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Report not found.");
        if (row.ReporterUserId != me && !await db.FacilityReportFollowers.AnyAsync(f => f.ReportId == id && f.UserId == me))
            throw new KeyNotFoundException("Report not found.");
        var body = FacilitiesCommon.Clean(r.Body, 1000, "The comment") ?? throw new ArgumentException("Write a comment.");
        db.FacilityReportComments.Add(new FacilityReportComment { TenantId = row.TenantId, ReportId = id, UserId = me, Body = body });
        row.LastActivityAt = DateTime.UtcNow;
        if (row.AssignedToUserId is { } assignee)
            notifier.Add(row.TenantId, assignee, $"New comment: {await SubjectAsync(row)}", body.Length > 120 ? body[..120] + "…" : body,
                FacilitiesCommon.KindReportStaff, row.Id, category: NotificationCategories.General);
        await db.SaveChangesAsync();
        return await MemberDetailAsync(row, me);
    }

    // ═════════════════════════════ Staff ═════════════════════════════

    public async Task<PagedReports> ListAsync(ReportQuery q)
    {
        var query = db.FacilityReports.AsNoTracking().AsQueryable();
        var status = (q.Status ?? "open").Trim().ToLowerInvariant();
        query = status switch
        {
            "open" => query.Where(r => r.Status == ReportStatus.Received || r.Status == ReportStatus.InProgress),
            "closed" => query.Where(r => r.Status == ReportStatus.Fixed || r.Status == ReportStatus.CantReproduce),
            "all" => query,
            _ => Enum.TryParse<ReportStatus>(q.Status, true, out var st) ? query.Where(r => r.Status == st) : throw new ArgumentException("Unknown status."),
        };
        if (q.BranchId is { } b) query = query.Where(r => r.BranchId == b);
        if (q.AssetId is { } a) query = query.Where(r => r.AssetId == a);
        if (q.Urgent is { } u) query = query.Where(r => r.IsUrgent == u);
        if (q.Mine) { var me = Me; query = query.Where(r => r.AssignedToUserId == me); }

        var total = await query.CountAsync();
        var rows = await query.OrderByDescending(r => r.IsUrgent).ThenByDescending(r => r.LastActivityAt).Page(q.Page, q.Size).ToListAsync();
        return new PagedReports { Items = await StaffItemsAsync(rows), Total = total };
    }

    public async Task<List<StaffReportListItem>> StaffItemsByIdAsync(List<ulong> ids)
    {
        var rows = await db.FacilityReports.AsNoTracking().Where(r => ids.Contains(r.Id)).ToListAsync();
        var items = await StaffItemsAsync(rows);
        return ids.Select(id => items.FirstOrDefault(i => i.Id == id)).Where(i => i is not null).ToList()!;
    }

    public async Task<ReportCounts> CountsAsync()
    {
        var open = db.FacilityReports.Where(r => r.Status == ReportStatus.Received || r.Status == ReportStatus.InProgress);
        return new ReportCounts
        {
            Open = await open.CountAsync(),
            Urgent = await open.CountAsync(r => r.IsUrgent),
            Unassigned = await open.CountAsync(r => r.AssignedToUserId == null),
        };
    }

    public async Task<StaffReportDetail> GetAsync(ulong id)
    {
        var row = await db.FacilityReports.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id) ?? throw new KeyNotFoundException("Report not found.");
        return await StaffDetailAsync(row);
    }

    public async Task<StaffReportDetail> UpdateAsync(ulong id, UpdateReportRequest r)
    {
        var row = await db.FacilityReports.FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Report not found.");
        var now = DateTime.UtcNow;
        var note = FacilitiesCommon.Clean(r.ResolutionNote, 1000, "The resolution note");

        if (r.AssetId is { } assetId)
        {
            if (assetId == 0) row.AssetId = null;
            else
            {
                var asset = await db.FacilityAssets.AsNoTracking().FirstOrDefaultAsync(a => a.Id == assetId) ?? throw new ArgumentException("Asset not found.");
                if (asset.BranchId != row.BranchId) throw new ArgumentException("That asset is in another branch.");
                row.AssetId = asset.Id;
            }
        }
        if (r.AssignedToUserId is { } assignee)
        {
            if (assignee == 0) row.AssignedToUserId = null;
            else
            {
                var staff = await (from u in db.Users join role in db.Roles on u.RoleId equals role.Id
                                   where u.Id == assignee && u.DeletedAt == null && role.Slug != RoleNames.Client
                                   select u.Id).AnyAsync();
                if (!staff) throw new ArgumentException("Assign it to a staff member.");
                if (row.AssignedToUserId != assignee)
                    notifier.Add(row.TenantId, assignee, $"Assigned to you: {await SubjectAsync(row)}", ProblemTypes.Label(row.ProblemType),
                        FacilitiesCommon.KindReportStaff, row.Id, urgent: row.IsUrgent, category: NotificationCategories.General);
                row.AssignedToUserId = assignee;
            }
        }
        if (r.IsUrgent is { } urgent) row.IsUrgent = urgent;

        if (r.Status is not null)
        {
            if (!Enum.TryParse<ReportStatus>(r.Status, true, out var status)) throw new ArgumentException("Unknown status.");
            if (status != row.Status)
            {
                var closing = !FacilitiesCommon.IsOpen(status);
                if (status == ReportStatus.CantReproduce && note is null && row.ResolutionNote is null)
                    throw new ArgumentException("Add a short note for the reporter.");
                row.Status = status;
                if (closing)
                {
                    row.ResolvedAt = now;
                    row.ResolvedByUserId = currentUser.UserId;
                    if (note is not null) row.ResolutionNote = note;
                    await FacilitiesCommon.NotifyClosedAsync(db, notifier, row, await SubjectAsync(row));
                }
                else { row.ResolvedAt = null; row.ResolvedByUserId = null; }
            }
            else if (note is not null) row.ResolutionNote = note;
        }
        else if (note is not null) row.ResolutionNote = note;

        if (row.AssignedToUserId is not null && row.Status == ReportStatus.Received && r.Status is null) row.Status = ReportStatus.InProgress;
        row.LastActivityAt = now;
        await db.SaveChangesAsync();
        return await StaffDetailAsync(row);
    }

    public async Task<StaffReportDetail> CommentAsync(ulong id, CommentRequest r)
    {
        var row = await db.FacilityReports.FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Report not found.");
        var body = FacilitiesCommon.Clean(r.Body, 1000, "The comment") ?? throw new ArgumentException("Write a comment.");
        db.FacilityReportComments.Add(new FacilityReportComment
        {
            TenantId = row.TenantId, ReportId = id, UserId = Me, Body = body, IsStaff = true, IsInternal = r.Internal,
        });
        row.LastActivityAt = DateTime.UtcNow;
        if (!r.Internal)
            notifier.Add(row.TenantId, row.ReporterUserId, $"Update on your report: {await SubjectAsync(row)}",
                body.Length > 120 ? body[..120] + "…" : body, FacilitiesCommon.KindReport, row.Id, category: NotificationCategories.General);
        await db.SaveChangesAsync();
        return await StaffDetailAsync(row);
    }

    /// <summary>One tap from the queue: marks the linked asset out of service (or limited) and moves the report to In progress.</summary>
    public async Task<ReportOutOfServiceResponse> MarkAssetOutOfServiceAsync(ulong id, ReportOutOfServiceRequest r)
    {
        var row = await db.FacilityReports.FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Report not found.");
        if (row.AssetId is not { } assetId) throw RuleException.Unprocessable("Link the report to an asset first.");
        var status = string.Equals(r.Status, "Limited", StringComparison.OrdinalIgnoreCase) ? "Limited" : "OutOfService";
        var reason = FacilitiesCommon.Clean(r.Reason, 500, "The reason") ?? ProblemTypes.Label(row.ProblemType);
        var asset = await assets.SetStatusAsync(assetId, new SetAssetStatusRequest
        {
            Status = status, Reason = reason, ExpectedBackOn = r.ExpectedBackOn, PostServiceNotice = r.PostServiceNotice,
        });
        if (row.Status == ReportStatus.Received) row.Status = ReportStatus.InProgress;
        row.AssignedToUserId ??= currentUser.UserId;
        row.LastActivityAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return new ReportOutOfServiceResponse { Report = await StaffDetailAsync(row), Asset = asset };
    }

    /// <summary>Staff who can be assigned a report (everyone but members).</summary>
    public async Task<List<StaffPickItem>> AssigneesAsync() =>
        await (from u in db.Users.AsNoTracking()
               join role in db.Roles on u.RoleId equals role.Id
               where u.DeletedAt == null && role.Slug != RoleNames.Client && role.Slug != RoleNames.SuperAdmin
               orderby u.FirstName, u.LastName
               select new StaffPickItem { Id = u.Id, Name = (u.FirstName + " " + u.LastName).Trim(), Role = role.Name })
            .Take(300).ToListAsync();

    // ═════════════════════════════ Helpers ═════════════════════════════

    private Task<FacilityReport?> OpenReportForAsync(ulong assetId) =>
        db.FacilityReports.Where(r => r.AssetId == assetId && (r.Status == ReportStatus.Received || r.Status == ReportStatus.InProgress))
            .OrderBy(r => r.CreatedAt).FirstOrDefaultAsync();

    private async Task<ExistingReportDto> ExistingDtoAsync(FacilityReport r, string assetName, ulong me) => new()
    {
        ReportId = r.Id, AssetName = assetName, Status = r.Status.ToString(), ProblemType = r.ProblemType, PlusOneCount = r.PlusOneCount,
        ReportedAt = r.CreatedAt, IsMine = r.ReporterUserId == me,
        AlreadyFollowing = r.ReporterUserId == me || await db.FacilityReportFollowers.AnyAsync(f => f.ReportId == r.Id && f.UserId == me),
    };

    private async Task NotifyStaffAsync(FacilityReport row, string subject, string branchName, bool escalated)
    {
        var unsafeReport = row.IsUrgent;
        var title = unsafeReport ? $"Unsafe: {subject}" : $"Problem reported: {subject}";
        var body = unsafeReport
            ? $"{branchName} · {(escalated ? "A member flagged an open report as unsafe." : ProblemTypes.Label(row.ProblemType))} Consider marking it out of service."
            : $"{branchName} · {ProblemTypes.Label(row.ProblemType)}{(row.Description is { } d ? ": " + (d.Length > 100 ? d[..100] + "…" : d) : "")}";
        foreach (var staff in await FacilitiesCommon.StaffRecipientsAsync(db, row.TenantId, FacilitiesCommon.ReportsModuleKey))
            notifier.Add(row.TenantId, staff, title, body, FacilitiesCommon.KindReportStaff, row.Id, urgent: unsafeReport,
                category: NotificationCategories.General, dedupeKey: $"facility-report:{row.Id}:{(unsafeReport ? "urgent" : "new")}:{staff}");
    }

    private async Task<string> SubjectAsync(FacilityReport r) =>
        r.AssetId is { } a ? await db.FacilityAssets.Where(x => x.Id == a).Select(x => x.Name).FirstOrDefaultAsync() ?? "Equipment" : r.OtherLocation ?? "Gym";

    private sealed record Ctx(Dictionary<ulong, FacilityAsset> Assets, Dictionary<ulong, string> Branches, Dictionary<ulong, string> Users);

    private async Task<Ctx> ContextAsync(IReadOnlyCollection<FacilityReport> rows, IEnumerable<ulong?>? extraUsers = null)
    {
        var assetIds = rows.Where(r => r.AssetId != null).Select(r => r.AssetId!.Value).Distinct().ToList();
        var assetRows = assetIds.Count == 0 ? [] : await db.FacilityAssets.AsNoTracking().Where(a => assetIds.Contains(a.Id)).ToDictionaryAsync(a => a.Id);
        var branches = await FacilitiesCommon.BranchNamesAsync(db, rows.Select(r => r.BranchId));
        var users = await FacilitiesCommon.NamesAsync(db, rows.SelectMany(r => new ulong?[] { r.ReporterUserId, r.AssignedToUserId }).Concat(extraUsers ?? []));
        return new Ctx(assetRows, branches, users);
    }

    private static void FillBase(MyReportDto d, FacilityReport r, Ctx c, ulong me)
    {
        var asset = r.AssetId is { } a ? c.Assets.GetValueOrDefault(a) : null;
        d.Id = r.Id; d.BranchId = r.BranchId; d.BranchName = c.Branches.GetValueOrDefault(r.BranchId); d.AssetId = r.AssetId;
        d.Subject = asset?.Name ?? r.OtherLocation ?? "Gym"; d.Zone = asset?.Zone; d.ProblemType = r.ProblemType;
        d.ProblemLabel = ProblemTypes.Label(r.ProblemType); d.Status = r.Status.ToString(); d.IsMine = r.ReporterUserId == me;
        d.PlusOneCount = r.PlusOneCount; d.CreatedAt = r.CreatedAt; d.ResolvedAt = r.ResolvedAt;
    }

    private async Task<MyReportDetail> MemberDetailAsync(FacilityReport r, ulong me)
    {
        var comments = await db.FacilityReportComments.AsNoTracking().Where(c => c.ReportId == r.Id && !c.IsInternal)
            .OrderBy(c => c.CreatedAt).ToListAsync();
        var ctx = await ContextAsync([r]);
        var d = new MyReportDetail();
        FillBase(d, r, ctx, me);
        var mine = r.ReporterUserId == me;
        d.Description = mine ? r.Description : null;
        d.PhotoUrls = mine ? FacilitiesCommon.SplitUrls(r.PhotoUrls) : [];
        d.ResolutionNote = r.ResolutionNote;
        d.CanComment = true;
        // Members only see staff replies and their own comments (never other members' words or names).
        d.Comments = comments.Where(c => c.IsStaff || c.UserId == me).Select(c => new ReportCommentDto
        {
            Id = c.Id, Body = c.Body, IsStaff = c.IsStaff, IsMine = c.UserId == me, CreatedAt = c.CreatedAt,
            AuthorName = c.UserId == me ? "You" : "Gym team",
        }).ToList();
        return d;
    }

    private async Task<List<StaffReportListItem>> StaffItemsAsync(List<FacilityReport> rows)
    {
        var ctx = await ContextAsync(rows);
        var me = currentUser.UserId ?? 0;
        return rows.Select(r => { var d = new StaffReportListItem(); FillStaff(d, r, ctx, me); return d; }).ToList();
    }

    private static void FillStaff(StaffReportListItem d, FacilityReport r, Ctx c, ulong me)
    {
        FillBase(d, r, c, me);
        d.IsUrgent = r.IsUrgent;
        d.ReporterName = c.Users.GetValueOrDefault(r.ReporterUserId) is { Length: > 0 } n ? n : "Someone";
        d.AssignedToUserId = r.AssignedToUserId;
        d.AssigneeName = r.AssignedToUserId is { } a ? c.Users.GetValueOrDefault(a) : null;
        d.AssetStatus = r.AssetId is { } id && c.Assets.TryGetValue(id, out var asset) ? asset.Status.ToString() : null;
        d.PhotoCount = FacilitiesCommon.SplitUrls(r.PhotoUrls).Count;
        d.LastActivityAt = r.LastActivityAt;
    }

    private async Task<StaffReportDetail> StaffDetailAsync(FacilityReport r)
    {
        var comments = await db.FacilityReportComments.AsNoTracking().Where(c => c.ReportId == r.Id).OrderBy(c => c.CreatedAt).ToListAsync();
        var ctx = await ContextAsync([r], comments.Select(c => (ulong?)c.UserId));
        var me = currentUser.UserId ?? 0;
        var d = new StaffReportDetail();
        FillStaff(d, r, ctx, me);
        var asset = r.AssetId is { } a ? ctx.Assets.GetValueOrDefault(a) : null;
        d.Description = r.Description;
        d.PhotoUrls = FacilitiesCommon.SplitUrls(r.PhotoUrls);
        d.ResolutionNote = r.ResolutionNote;
        d.ReporterUserId = r.ReporterUserId;
        d.ReporterRole = await (from u in db.Users.IgnoreQueryFilters() join role in db.Roles.IgnoreQueryFilters() on u.RoleId equals role.Id
                                where u.Id == r.ReporterUserId select role.Name).FirstOrDefaultAsync();
        d.AssetIsKeyFacility = asset?.IsKeyFacility ?? false;
        d.SuggestOutOfService = (r.IsUrgent || r.ProblemType == ProblemTypes.Unsafe) && FacilitiesCommon.IsOpen(r.Status)
                                && asset is { Status: AssetStatus.InService };
        d.Comments = comments.Select(c => new ReportCommentDto
        {
            Id = c.Id, Body = c.Body, IsStaff = c.IsStaff, IsInternal = c.IsInternal, IsMine = c.UserId == me, CreatedAt = c.CreatedAt,
            AuthorName = ctx.Users.GetValueOrDefault(c.UserId) is { Length: > 0 } n ? n : (c.IsStaff ? "Staff" : "Member"),
        }).ToList();
        return d;
    }
}

public class PagedReports
{
    public List<StaffReportListItem> Items { get; set; } = [];
    public int Total { get; set; }
}
