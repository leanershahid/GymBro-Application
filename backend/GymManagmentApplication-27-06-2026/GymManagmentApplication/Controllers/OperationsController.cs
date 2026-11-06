using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Operations;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;

namespace GymManagmentApplication.Controllers;

/// <summary>
/// Branch opening hours and member-facing branch info.
/// <list type="bullet">
///   <item><c>GET /api/branches/{id}/hours</c>, <c>/info</c>, <c>/api/branches/mine/info</c>, <c>/api/branches/directory</c> — any signed-in user of the gym.</item>
///   <item><c>/api/branches/{id}/hours/config|weekly|exceptions</c>, <c>/profile</c> — admins and roles granted <c>branch-hours</c>.</item>
///   <item><c>/api/operations/settings</c> — gym setting "block self check-in outside hours" (<c>branch-hours</c>).</item>
/// </list>
/// </summary>
[ApiController]
public class BranchHoursController(OpeningHoursService service) : ControllerBase
{
    private const string Module = "branch-hours";

    // ── Members ──────────────────────────────────────────────────────────────

    /// <summary>Today's status ("Open · closes 10pm") and the next 7 days, in the branch's time zone.</summary>
    [HttpGet("api/branches/{branchId}/hours")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<BranchHoursResponse>>> Hours(ulong branchId)
        => Ok(ApiResponse<BranchHoursResponse>.Ok(await service.GetHoursAsync(branchId)));

    /// <summary>Address + maps link, phone, hours, current service status, amenities and accessibility.</summary>
    [HttpGet("api/branches/{branchId}/info")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<BranchInfoResponse>>> Info(ulong branchId)
        => Ok(ApiResponse<BranchInfoResponse>.Ok(await service.GetBranchInfoAsync(branchId)));

    /// <summary>The caller's home branch (or the gym's first active branch).</summary>
    [HttpGet("api/branches/mine/info")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<BranchInfoResponse>>> MyInfo()
        => Ok(ApiResponse<BranchInfoResponse>.Ok(await service.GetMyBranchInfoAsync()));

    /// <summary>Active branches with today's open/closed status, for a branch switcher.</summary>
    [HttpGet("api/branches/directory")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<List<BranchDirectoryItem>>>> Directory()
        => Ok(ApiResponse<List<BranchDirectoryItem>>.Ok(await service.GetDirectoryAsync()));

    // ── Admin ────────────────────────────────────────────────────────────────

    [HttpGet("api/branches/{branchId}/hours/config")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<BranchHoursConfigResponse>>> Config(ulong branchId)
        => Ok(ApiResponse<BranchHoursConfigResponse>.Ok(await service.GetConfigAsync(branchId)));

    /// <summary>Replaces the regular week (days left out are closed).</summary>
    [HttpPut("api/branches/{branchId}/hours/weekly")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<BranchHoursConfigResponse>>> SetWeekly(ulong branchId, [FromBody] SetWeeklyHoursRequest request)
        => Ok(ApiResponse<BranchHoursConfigResponse>.Ok(await service.SetWeeklyAsync(branchId, request), "Opening hours saved."));

    /// <summary>Adds or replaces the exception for a date (holiday closure / special hours).</summary>
    [HttpPost("api/branches/{branchId}/hours/exceptions")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<HoursExceptionDto>>> UpsertException(ulong branchId, [FromBody] UpsertHoursExceptionRequest request)
        => Ok(ApiResponse<HoursExceptionDto>.Ok(await service.UpsertExceptionAsync(branchId, request), "Saved."));

    [HttpDelete("api/branches/{branchId}/hours/exceptions/{exceptionId}")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<object>>> DeleteException(ulong branchId, ulong exceptionId)
        => await service.DeleteExceptionAsync(branchId, exceptionId)
            ? Ok(ApiResponse<object>.Ok(null!, "Removed."))
            : NotFound(ApiResponse<object>.Fail("Exception not found."));

    /// <summary>Amenities and accessibility notes shown on the member branch screen.</summary>
    [HttpPut("api/branches/{branchId}/profile")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<BranchHoursConfigResponse>>> SetProfile(ulong branchId, [FromBody] BranchProfileRequest request)
        => Ok(ApiResponse<BranchHoursConfigResponse>.Ok(await service.SetProfileAsync(branchId, request), "Branch info saved."));

    [HttpGet("api/operations/settings")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<OperationsSettings>>> Settings()
        => Ok(ApiResponse<OperationsSettings>.Ok(await service.GetSettingsAsync()));

    [HttpPut("api/operations/settings")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<OperationsSettings>>> UpdateSettings([FromBody] OperationsSettings settings)
        => Ok(ApiResponse<OperationsSettings>.Ok(await service.UpdateSettingsAsync(settings), "Settings saved."));
}

/// <summary>
/// Service status notices. <c>GET /api/service-status</c> = what members see now (their branch +
/// gym-wide); <c>/api/service-status/admin</c> = manage (<c>service-status</c> module).
/// </summary>
[ApiController]
[Route("api/service-status")]
public class ServiceStatusController(ServiceStatusService service, OpeningHoursService hours) : ControllerBase
{
    private const string Module = "service-status";

    /// <param name="branchId">Defaults to the caller's home branch; "all" notices when they have none.</param>
    [HttpGet]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<List<ServiceStatusDto>>>> Active([FromQuery] ulong? branchId)
        => Ok(ApiResponse<List<ServiceStatusDto>>.Ok(await service.GetActiveAsync(branchId ?? await hours.MyBranchIdAsync())));

    [HttpGet("admin")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<List<ServiceStatusDto>>>> List([FromQuery] bool includeEnded = false)
        => Ok(ApiResponse<List<ServiceStatusDto>>.Ok(await service.ListAsync(includeEnded)));

    [HttpPost("admin")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<ServiceStatusDto>>> Create([FromBody] ServiceStatusRequest request)
        => Ok(ApiResponse<ServiceStatusDto>.Ok(await service.CreateAsync(request), "Status posted."));

    [HttpPut("admin/{id}")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<ServiceStatusDto>>> Update(ulong id, [FromBody] ServiceStatusRequest request)
        => Ok(ApiResponse<ServiceStatusDto>.Ok(await service.UpdateAsync(id, request), "Status updated."));

    /// <summary>Ends the notice now (kept in the history).</summary>
    [HttpPost("admin/{id}/end")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<ServiceStatusDto>>> End(ulong id)
        => Ok(ApiResponse<ServiceStatusDto>.Ok(await service.EndAsync(id), "Status ended."));

    [HttpDelete("admin/{id}")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<object>>> Delete(ulong id)
        => await service.DeleteAsync(id)
            ? Ok(ApiResponse<object>.Ok(null!, "Deleted."))
            : NotFound(ApiResponse<object>.Fail("Status not found."));
}

/// <summary>
/// Announcements. <c>/api/announcements</c> (any signed-in user) = my feed: only announcements
/// delivered to the caller. <c>/api/announcements/admin</c> = compose, schedule, publish, reach
/// (<c>announcements</c> module).
/// </summary>
[ApiController]
[Route("api/announcements")]
public class AnnouncementsController(AnnouncementService service) : ControllerBase
{
    private const string Module = "announcements";

    // ── Me ───────────────────────────────────────────────────────────────────

    [HttpGet]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<AnnouncementFeedResponse>>> Feed([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 20)
        => Ok(ApiResponse<AnnouncementFeedResponse>.Ok(await service.GetFeedAsync(pageNumber, pageSize)));

    [HttpGet("unread-count")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<object>>> UnreadCount()
        => Ok(ApiResponse<object>.Ok(new { count = await service.UnreadCountAsync() }));

    /// <summary>The newest unread announcement for the Home card (data null when everything is read).</summary>
    [HttpGet("latest-unread")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<AnnouncementFeedItem?>>> LatestUnread()
        => Ok(ApiResponse<AnnouncementFeedItem?>.Ok(await service.LatestUnreadAsync()));

    /// <summary>One of my announcements; marks it read.</summary>
    [HttpGet("{id}")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<AnnouncementFeedItem>>> Get(ulong id)
        => Ok(ApiResponse<AnnouncementFeedItem>.Ok(await service.GetMineAsync(id)));

    [HttpPost("{id}/read")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<object>>> MarkRead(ulong id)
        => Ok(ApiResponse<object>.Ok(new { updated = await service.MarkReadAsync(id) }));

    [HttpPost("read-all")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<object>>> MarkAllRead()
        => Ok(ApiResponse<object>.Ok(new { updated = await service.MarkReadAsync(null) }));

    // ── Admin ────────────────────────────────────────────────────────────────

    /// <param name="status">Optional: Draft, Scheduled, Publishing, Published.</param>
    [HttpGet("admin")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<List<AnnouncementAdminDto>>>> AdminList([FromQuery] string? status)
        => Ok(ApiResponse<List<AnnouncementAdminDto>>.Ok(await service.ListAsync(status)));

    [HttpGet("admin/{id}")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<AnnouncementAdminDto>>> AdminGet(ulong id)
        => Ok(ApiResponse<AnnouncementAdminDto>.Ok(await service.GetAdminAsync(id)));

    /// <summary>Create; <c>action</c> = "draft", "schedule" (at publishAt) or "publish" (send now).</summary>
    [HttpPost("admin")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<AnnouncementAdminDto>>> Create([FromBody] AnnouncementRequest request)
    {
        var result = await service.CreateAsync(request);
        return Ok(ApiResponse<AnnouncementAdminDto>.Ok(result, MessageFor(result)));
    }

    [HttpPut("admin/{id}")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<AnnouncementAdminDto>>> Update(ulong id, [FromBody] AnnouncementRequest request)
    {
        var result = await service.UpdateAsync(id, request);
        return Ok(ApiResponse<AnnouncementAdminDto>.Ok(result, MessageFor(result)));
    }

    [HttpPost("admin/{id}/publish")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<AnnouncementAdminDto>>> Publish(ulong id)
    {
        var result = await service.PublishNowAsync(id);
        return Ok(ApiResponse<AnnouncementAdminDto>.Ok(result, MessageFor(result)));
    }

    [HttpPost("admin/{id}/unschedule")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<AnnouncementAdminDto>>> Unschedule(ulong id)
        => Ok(ApiResponse<AnnouncementAdminDto>.Ok(await service.UnscheduleAsync(id), "Moved back to drafts."));

    /// <summary>Drafts/scheduled are deleted; a published announcement is taken down (reach kept).</summary>
    [HttpDelete("admin/{id}")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<object>>> Delete(ulong id)
        => await service.DeleteAsync(id)
            ? Ok(ApiResponse<object>.Ok(null!, "Done."))
            : NotFound(ApiResponse<object>.Fail("Announcement not found."));

    /// <summary>Branches, active plans and member tags for the audience picker.</summary>
    [HttpGet("admin/audience-options")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<AudienceOptionsResponse>>> AudienceOptions()
        => Ok(ApiResponse<AudienceOptionsResponse>.Ok(await service.AudienceOptionsAsync()));

    /// <summary>How many people an audience reaches right now, e.g. ?audience=Branches&amp;audienceIds=1&amp;audienceIds=2.</summary>
    [HttpGet("admin/audience-count")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<object>>> AudienceCount([FromQuery] string audience = "AllMembers", [FromQuery] List<ulong>? audienceIds = null)
        => Ok(ApiResponse<object>.Ok(new { count = await service.AudienceCountAsync(new AudiencePreviewRequest { Audience = audience, AudienceIds = audienceIds ?? [] }) }));

    private static string MessageFor(AnnouncementAdminDto a) => a.Status switch
    {
        "Published" => $"Sent to {a.RecipientCount:N0} {(a.RecipientCount == 1 ? "person" : "people")}.",
        "Publishing" => "Sending…",
        "Scheduled" => "Scheduled.",
        _ => "Draft saved.",
    };
}
