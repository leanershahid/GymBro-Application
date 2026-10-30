using GymManagmentApplication.Application.Attendance;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;

namespace GymManagmentApplication.Controllers;

[ApiController]
[PermissionModule("attendance")]
[Route("api/attendance")]
public class AttendanceController(IAttendanceService service) : ControllerBase
{
    // ── Admin: settings & branch geofences ───────────────────────────────────

    [HttpGet("settings")]
    [AuthorizeRoles(RoleNames.Admin)]
    [RequireModule("attendance")]
    public async Task<ActionResult<ApiResponse<object>>> GetSettings()
        => Ok(ApiResponse<object>.Ok(await service.GetSettingsAsync()));

    [HttpPut("settings")]
    [AuthorizeRoles(RoleNames.Admin)]
    [RequireModule("attendance")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateSettings([FromBody] AttendanceSettings settings)
        => Ok(ApiResponse<object>.Ok(await service.UpdateSettingsAsync(settings), "Attendance settings saved."));

    [HttpPut("branches/{branchId:long}/geofence")]
    [AuthorizeRoles(RoleNames.Admin)]
    [RequireModule("attendance")]
    public async Task<ActionResult<ApiResponse<object>>> SetGeofence(ulong branchId, [FromBody] SetBranchGeofenceRequest request)
    {
        var result = await service.SetBranchGeofenceAsync(branchId, request);
        return result is null
            ? NotFound(ApiResponse<object>.Fail($"Branch {branchId} not found."))
            : Ok(ApiResponse<object>.Ok(result, "Check-in location saved."));
    }

    [HttpDelete("branches/{branchId:long}/geofence")]
    [AuthorizeRoles(RoleNames.Admin)]
    [RequireModule("attendance")]
    public async Task<ActionResult<ApiResponse<object>>> ClearGeofence(ulong branchId)
        => await service.ClearBranchGeofenceAsync(branchId)
            ? Ok(ApiResponse<object>.Ok((object)null!, "Check-in location removed."))
            : NotFound(ApiResponse<object>.Fail($"Branch {branchId} not found."));

    /// <summary>Attendance log for the gym (optionally one day / one branch).</summary>
    [HttpGet]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> GetAll(
        [FromQuery] DateOnly? date, [FromQuery] ulong? branchId, [FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 20,
        [FromQuery] ulong? userId = null)
        => Ok(ApiResponse<object>.Ok(await service.GetAllAsync(date, branchId, pageNumber, pageSize, userId)));

    // ── Member / trainer: location check-in ──────────────────────────────────

    [HttpGet("me/status")]
    [AuthorizeRoles(RoleNames.Client, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> MyStatus()
        => Ok(ApiResponse<object>.Ok(await service.GetMyStatusAsync()));

    [HttpPost("check-in")]
    [AuthorizeRoles(RoleNames.Client, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> CheckIn([FromBody] LocationCheckRequest request)
    {
        var result = await service.CheckInByLocationAsync(request);
        // Out of range is a normal outcome, not an error: 200 with CheckedIn = false and the distance.
        return Ok(new ApiResponse<object> { Success = result.CheckedIn, Message = result.Message, Data = result });
    }

    [HttpPost("check-out")]
    [AuthorizeRoles(RoleNames.Client, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> CheckOut([FromBody] LocationCheckRequest? request)
    {
        var result = await service.CheckOutAsync(request);
        return result is null
            ? NotFound(ApiResponse<object>.Fail("You're not checked in."))
            : Ok(ApiResponse<object>.Ok(result, "Checked out."));
    }

    [HttpGet("me")]
    [AuthorizeRoles(RoleNames.Client, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> MyHistory([FromQuery] int days = 30)
        => Ok(ApiResponse<object>.Ok(await service.GetMyHistoryAsync(days)));
}
