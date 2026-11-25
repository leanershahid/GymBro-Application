using GymManagmentApplication.Application.Attendance;
using GymManagmentApplication.Application.Attendance.Face;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Filters;
using GymManagmentApplication.Infrastructure.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

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

    /// <summary>
    /// Self check-in with face verification (gyms with face check-in on): the location fields plus a live
    /// selfie, as multipart/form-data. 422 FACE_ENROLL_REQUIRED / FACE_MISMATCH / FACE_NOT_CLEAR / FACE_LOCKED,
    /// 503 FACE_UNAVAILABLE (fail closed). Out of range is still 200 with CheckedIn = false.
    /// </summary>
    [HttpPost("check-in/face")]
    [AuthorizeRoles(RoleNames.Client, RoleNames.Trainer)]
    [EnableRateLimiting(RateLimits.Uploads)]
    [RequestSizeLimit(6 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 6 * 1024 * 1024)]
    public async Task<ActionResult<ApiResponse<object>>> CheckInWithFace([FromForm] FaceCheckInForm form)
    {
        var request = new LocationCheckRequest { Lat = form.Lat, Lng = form.Lng, AccuracyM = form.AccuracyM, BranchId = form.BranchId };
        var result = await service.CheckInByLocationAsync(request, new FaceSelfie(form.Selfie.ToUpload(), form.CapturedAt));
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

    // ── Front desk ─────────────────────────────────────────────────────────

    [HttpPost("members/{userId:long}/check-in")]
    [AuthorizeRoles(RoleNames.Admin)]
    [RequireModule("attendance")]
    public async Task<ActionResult<ApiResponse<object>>> CheckInMember(ulong userId,
        [FromQuery] bool overrideSafety = false, [FromQuery] string? overrideReason = null)
    {
        // A missing waiver / health check answers 200 with Success = false, SafetyBlocked = true and
        // SafetyMissing; the desk can then retry with ?overrideSafety=true (recorded with who overrode).
        var result = await service.CheckInMemberAsync(userId, overrideSafety, overrideReason);
        return Ok(new ApiResponse<object> { Success = result.CheckedIn, Message = result.Message, Data = result });
    }

    [HttpPost("members/{userId:long}/check-out")]
    [AuthorizeRoles(RoleNames.Admin)]
    [RequireModule("attendance")]
    public async Task<ActionResult<ApiResponse<object>>> CheckOutMember(ulong userId)
    {
        var result = await service.CheckOutMemberAsync(userId);
        return result is null
            ? NotFound(ApiResponse<object>.Fail("This member isn't checked in."))
            : Ok(ApiResponse<object>.Ok(result, "Checked out."));
    }

    [HttpGet("me")]
    [AuthorizeRoles(RoleNames.Client, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> MyHistory([FromQuery] int days = 30)
        => Ok(ApiResponse<object>.Ok(await service.GetMyHistoryAsync(days)));
}

/// <summary>Multipart body of POST api/attendance/check-in/face.</summary>
public class FaceCheckInForm
{
    public double Lat { get; set; }
    public double Lng { get; set; }
    public double? AccuracyM { get; set; }
    public ulong? BranchId { get; set; }
    /// <summary>When the app captured the selfie (ISO 8601, UTC).</summary>
    public DateTime? CapturedAt { get; set; }
    /// <summary>Live front-camera selfie, JPEG or PNG, at most 5 MB.</summary>
    public IFormFile? Selfie { get; set; }
}
