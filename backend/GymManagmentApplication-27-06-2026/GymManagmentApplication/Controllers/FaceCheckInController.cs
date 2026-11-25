using GymManagmentApplication.Application.Attendance.Face;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Filters;
using GymManagmentApplication.Infrastructure.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace GymManagmentApplication.Controllers;

/// <summary>
/// Face check-in: the member's own reference selfie (consent + live capture), and the staff side
/// (enrol at the desk, reset / delete, failed attempts, kept selfies next to the reference photo).
/// The check-in itself is POST api/attendance/check-in/face. Front-desk check-in doesn't use any of this.
/// </summary>
[ApiController]
[PermissionModule("attendance")]
[Route("api/attendance/face")]
public class FaceCheckInController(FaceCheckInService service) : ControllerBase
{
    private string? Ip => HttpContext.Connection.RemoteIpAddress?.ToString();

    // ── Member ───────────────────────────────────────────────────────────────

    [HttpGet("me")]
    [AuthorizeRoles(RoleNames.Client, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> Mine()
        => Ok(ApiResponse<object>.Ok(await service.GetMineAsync()));

    /// <summary>
    /// Enrol / re-enrol the reference selfie (multipart: photo, consent=true when agreed on the consent
    /// screen just now, capturedAt). 422 FACE_CONSENT_REQUIRED without consent; 422 FACE_NOT_CLEAR unless
    /// exactly one clear face; 503 FACE_UNAVAILABLE when the face service is down.
    /// </summary>
    [HttpPost("me/enroll")]
    [AuthorizeRoles(RoleNames.Client, RoleNames.Trainer)]
    [EnableRateLimiting(RateLimits.Uploads)]
    [RequestSizeLimit(6 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 6 * 1024 * 1024)]
    public async Task<ActionResult<ApiResponse<object>>> EnrollMine([FromForm] FaceEnrollForm form)
        => Ok(ApiResponse<object>.Ok(await service.EnrollMineAsync(form.Photo.ToUpload(), form.Consent, form.CapturedAt, Ip),
            "Face check-in is set up."));

    /// <summary>"Remove my face data": deletes the reference photo and kept selfies and withdraws the consent.</summary>
    [HttpDelete("me")]
    [AuthorizeRoles(RoleNames.Client, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> RemoveMine()
        => Ok(ApiResponse<object>.Ok(await service.RemoveMineAsync(Ip), "Your face data was deleted."));

    // ── Staff ────────────────────────────────────────────────────────────────

    [HttpGet("members/{userId:long}")]
    [AuthorizeRoles(RoleNames.Admin)]
    [RequireModule("attendance")]
    public async Task<ActionResult<ApiResponse<object>>> Member(ulong userId)
        => Ok(ApiResponse<object>.Ok(await service.GetMemberAsync(userId)));

    /// <summary>Enrol a member at the desk (multipart: photo, consentConfirmed, capturedAt). Audit-logged.</summary>
    [HttpPost("members/{userId:long}/enroll")]
    [AuthorizeRoles(RoleNames.Admin)]
    [RequireModule("attendance")]
    [EnableRateLimiting(RateLimits.Uploads)]
    [RequestSizeLimit(6 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 6 * 1024 * 1024)]
    public async Task<ActionResult<ApiResponse<object>>> EnrollMember(ulong userId, [FromForm] FaceStaffEnrollForm form)
        => Ok(ApiResponse<object>.Ok(await service.EnrollMemberAsync(userId, form.Photo.ToUpload(), form.ConsentConfirmed, form.CapturedAt, Ip),
            "Face check-in photo saved."));

    /// <summary>Deletes the reference photo; the member enrols again at their next check-in. Audit-logged.</summary>
    [HttpPost("members/{userId:long}/reset")]
    [AuthorizeRoles(RoleNames.Admin)]
    [RequireModule("attendance")]
    public async Task<ActionResult<ApiResponse<object>>> ResetMember(ulong userId)
        => Ok(ApiResponse<object>.Ok(await service.ResetMemberAsync(userId), "Face check-in reset. The member will be asked for a new photo."));

    /// <summary>Deletes the enrolment and its photo. Audit-logged.</summary>
    [HttpDelete("members/{userId:long}")]
    [AuthorizeRoles(RoleNames.Admin)]
    [RequireModule("attendance")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteMember(ulong userId)
        => await service.DeleteMemberAsync(userId)
            ? Ok(ApiResponse<object>.Ok((object)null!, "Face check-in enrolment deleted."))
            : NotFound(ApiResponse<object>.Fail("This member hasn't enrolled for face check-in."));

    /// <summary>Face checks at self check-in (failed only unless failedOnly=false), for the attendance log.</summary>
    [HttpGet("attempts")]
    [AuthorizeRoles(RoleNames.Admin)]
    [RequireModule("attendance")]
    public async Task<ActionResult<ApiResponse<object>>> Attempts([FromQuery] DateOnly? date, [FromQuery] ulong? branchId,
        [FromQuery] bool failedOnly = true, [FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 20)
        => Ok(ApiResponse<object>.Ok(await service.GetAttemptsAsync(date, branchId, failedOnly, pageNumber, pageSize)));

    /// <summary>A kept check-in selfie next to the reference photo (signed, short-lived links).</summary>
    [HttpGet("attempts/{attemptId:long}/photos")]
    [AuthorizeRoles(RoleNames.Admin)]
    [RequireModule("attendance")]
    public async Task<ActionResult<ApiResponse<object>>> AttemptPhotos(ulong attemptId)
    {
        var result = await service.GetAttemptPhotosAsync(attemptId);
        return result is null ? NotFound(ApiResponse<object>.Fail("Face check not found.")) : Ok(ApiResponse<object>.Ok(result));
    }
}

public class FaceEnrollForm
{
    /// <summary>Live front-camera selfie, JPEG or PNG, at most 5 MB.</summary>
    public IFormFile? Photo { get; set; }
    /// <summary>The member agreed on the consent screen (records the "biometric_face" consent).</summary>
    public bool Consent { get; set; }
    public DateTime? CapturedAt { get; set; }
}

public class FaceStaffEnrollForm
{
    public IFormFile? Photo { get; set; }
    /// <summary>The member agreed in person (recorded as a desk consent with the staff member's id).</summary>
    public bool ConsentConfirmed { get; set; }
    public DateTime? CapturedAt { get; set; }
}
