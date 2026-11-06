using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Facilities;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;

namespace GymManagmentApplication.Controllers;

/// <summary>
/// The equipment register.
/// <list type="bullet">
///   <item><c>GET /api/facilities/report-options</c>, <c>/by-code/{code}</c>, <c>/out-of-service</c> — any signed-in user (report a problem, branch info).</item>
///   <item><c>/api/facilities/assets…</c>, <c>/zones</c>, <c>/settings</c> — admins and roles granted <c>admin.facilities</c> (API key <c>facilities</c>).</item>
/// </list>
/// </summary>
[ApiController]
[Route("api/facilities")]
public class FacilitiesController(FacilityAssetService service, FacilityReportService reports) : ControllerBase
{
    private const string Module = FacilitiesCommon.RegisterApi;

    // ── Members / trainers ───────────────────────────────────────────────────

    /// <summary>A branch's assets grouped by zone, problem types and whether the caller may report.</summary>
    [HttpGet("report-options")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<ReportOptionsResponse>>> ReportOptions([FromQuery] ulong branchId)
        => Ok(ApiResponse<ReportOptionsResponse>.Ok(await service.ReportOptionsAsync(branchId)));

    /// <summary>The asset a QR label names.</summary>
    [HttpGet("by-code/{code}")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<AssetPickItem>>> ByCode(string code)
        => Ok(ApiResponse<AssetPickItem>.Ok(await service.ByCodeAsync(code)));

    /// <summary>Non-key machines that are down at a branch (gym setting ShowOutOfServiceToMembers).</summary>
    [HttpGet("out-of-service")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<List<OutOfServiceItem>>>> OutOfService([FromQuery] ulong branchId)
        => Ok(ApiResponse<List<OutOfServiceItem>>.Ok(await service.OutOfServiceAsync(branchId)));

    // ── Staff ────────────────────────────────────────────────────────────────

    [HttpGet("assets")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<List<AssetDto>>>> List([FromQuery] AssetQuery query)
        => Ok(ApiResponse<List<AssetDto>>.Ok(await service.ListAsync(query)));

    [HttpGet("assets/{id}")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<AssetDetailDto>>> Get(ulong id)
        => Ok(ApiResponse<AssetDetailDto>.Ok(await service.GetAsync(id, reports.StaffItemsByIdAsync)));

    [HttpPost("assets")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<AssetDto>>> Create([FromBody] AssetRequest request)
        => Ok(ApiResponse<AssetDto>.Ok(await service.CreateAsync(request), "Asset added."));

    /// <summary>Adds up to 100 assets of one kind ("Treadmill 1…6" or a list of names).</summary>
    [HttpPost("assets/bulk")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<List<AssetDto>>>> Bulk([FromBody] BulkAssetRequest request)
    {
        var added = await service.BulkCreateAsync(request);
        return Ok(ApiResponse<List<AssetDto>>.Ok(added, $"{added.Count} assets added."));
    }

    [HttpPut("assets/{id}")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<AssetDto>>> Update(ulong id, [FromBody] AssetRequest request)
        => Ok(ApiResponse<AssetDto>.Ok(await service.UpdateAsync(id, request), "Asset saved."));

    /// <summary>Archives the asset (kept for its history).</summary>
    [HttpDelete("assets/{id}")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<object>>> Archive(ulong id)
        => await service.ArchiveAsync(id)
            ? Ok(ApiResponse<object>.Ok(null!, "Asset archived."))
            : NotFound(ApiResponse<object>.Fail("Asset not found."));

    /// <summary>In service / Limited / Out of service. A key facility's notice is posted only with PostServiceNotice = true.</summary>
    [HttpPut("assets/{id}/status")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<SetAssetStatusResponse>>> SetStatus(ulong id, [FromBody] SetAssetStatusRequest request)
        => Ok(ApiResponse<SetAssetStatusResponse>.Ok(await service.SetStatusAsync(id, request), "Status updated."));

    [HttpPost("assets/{id}/maintenance")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<MaintenanceDto>>> AddMaintenance(ulong id, [FromBody] MaintenanceRequest request)
        => Ok(ApiResponse<MaintenanceDto>.Ok(await service.AddMaintenanceAsync(id, request), "Service entry added."));

    [HttpDelete("assets/{id}/maintenance/{entryId}")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<object>>> DeleteMaintenance(ulong id, ulong entryId)
        => await service.DeleteMaintenanceAsync(id, entryId)
            ? Ok(ApiResponse<object>.Ok(null!, "Removed."))
            : NotFound(ApiResponse<object>.Fail("Entry not found."));

    [HttpGet("zones")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<List<string>>>> Zones([FromQuery] ulong? branchId)
        => Ok(ApiResponse<List<string>>.Ok(await service.ZonesAsync(branchId)));

    [HttpGet("settings")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<FacilitiesSettings>>> Settings()
        => Ok(ApiResponse<FacilitiesSettings>.Ok(await service.GetSettingsAsync()));

    [HttpPut("settings")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<FacilitiesSettings>>> UpdateSettings([FromBody] FacilitiesSettings settings)
        => Ok(ApiResponse<FacilitiesSettings>.Ok(await service.UpdateSettingsAsync(settings), "Settings saved."));
}

/// <summary>
/// Problem reports. <c>/api/facility-reports</c> (create, mine, +1, comment) — any signed-in user;
/// <c>/api/facility-reports/admin…</c> — the triage queue (<c>admin.facility-reports</c>, API key <c>facility-reports</c>).
/// A second report for an asset with an open one answers 409 <c>ALREADY_REPORTED</c> with the existing report in <c>data</c>.
/// </summary>
[ApiController]
[Route("api/facility-reports")]
public class FacilityReportsController(FacilityReportService service) : ControllerBase
{
    private const string Module = FacilitiesCommon.ReportsApi;

    [HttpPost]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<MyReportDetail>>> Create([FromBody] CreateReportRequest request)
        => Ok(ApiResponse<MyReportDetail>.Ok(await service.CreateAsync(request), "Thanks — we've got it."));

    [HttpGet("mine")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<List<MyReportDto>>>> Mine()
        => Ok(ApiResponse<List<MyReportDto>>.Ok(await service.GetMineAsync()));

    [HttpGet("mine/{id}")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<MyReportDetail>>> MineOne(ulong id)
        => Ok(ApiResponse<MyReportDetail>.Ok(await service.GetMineAsync(id)));

    /// <summary>The open report for an asset (null data when there is none).</summary>
    [HttpGet("open-for-asset/{assetId}")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<ExistingReportDto?>>> OpenForAsset(ulong assetId)
        => Ok(ApiResponse<ExistingReportDto?>.Ok(await service.OpenForAssetAsync(assetId)));

    [HttpPost("{id}/plus-one")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<MyReportDetail>>> PlusOne(ulong id, [FromBody] PlusOneRequest request)
        => Ok(ApiResponse<MyReportDetail>.Ok(await service.PlusOneAsync(id, request), "Thanks — we'll let you know when it's fixed."));

    [HttpPost("{id}/comments")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<MyReportDetail>>> Comment(ulong id, [FromBody] CommentRequest request)
        => Ok(ApiResponse<MyReportDetail>.Ok(await service.CommentMineAsync(id, request), "Comment added."));

    // ── Staff ────────────────────────────────────────────────────────────────

    [HttpGet("admin")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<PagedReports>>> List([FromQuery] ReportQuery query)
        => Ok(ApiResponse<PagedReports>.Ok(await service.ListAsync(query)));

    /// <summary>Badge: open / urgent / unassigned.</summary>
    [HttpGet("admin/counts")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<ReportCounts>>> Counts()
        => Ok(ApiResponse<ReportCounts>.Ok(await service.CountsAsync()));

    [HttpGet("admin/assignees")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<List<StaffPickItem>>>> Assignees()
        => Ok(ApiResponse<List<StaffPickItem>>.Ok(await service.AssigneesAsync()));

    [HttpGet("admin/{id}")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<StaffReportDetail>>> Get(ulong id)
        => Ok(ApiResponse<StaffReportDetail>.Ok(await service.GetAsync(id)));

    /// <summary>Assign, set status (closing tells the reporter and +1s), link an asset, flag urgent.</summary>
    [HttpPut("admin/{id}")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<StaffReportDetail>>> Update(ulong id, [FromBody] UpdateReportRequest request)
        => Ok(ApiResponse<StaffReportDetail>.Ok(await service.UpdateAsync(id, request), "Report updated."));

    [HttpPost("admin/{id}/comments")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<StaffReportDetail>>> StaffComment(ulong id, [FromBody] CommentRequest request)
        => Ok(ApiResponse<StaffReportDetail>.Ok(await service.CommentAsync(id, request), "Comment added."));

    /// <summary>One tap: the linked asset goes out of service (notice for key facilities only when PostServiceNotice).</summary>
    [HttpPost("admin/{id}/out-of-service")]
    [AuthorizeRoles(RoleNames.Admin)]
    [PermissionModule(Module)]
    [RequireModule(Module)]
    public async Task<ActionResult<ApiResponse<ReportOutOfServiceResponse>>> OutOfService(ulong id, [FromBody] ReportOutOfServiceRequest request)
        => Ok(ApiResponse<ReportOutOfServiceResponse>.Ok(await service.MarkAssetOutOfServiceAsync(id, request), "Marked out of service."));
}
