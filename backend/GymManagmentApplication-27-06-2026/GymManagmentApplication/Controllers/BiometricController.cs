using FluentValidation;
using GymManagmentApplication.Application.Biometric.Interfaces;
using GymManagmentApplication.Application.Biometric.Requests;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;
using GymManagmentApplication.Domain.Constants;

namespace GymManagmentApplication.Controllers;

[ApiController]
[Route("api/biometric")]
[AuthorizeRoles(RoleNames.Admin)]
public class BiometricController(
    IBiometricService service,
    IValidator<EnrollFaceRequest> enrollFaceValidator,
    IValidator<VerifyFaceRequest> verifyFaceValidator,
    IValidator<EnrollFingerprintRequest> enrollFpValidator,
    IValidator<VerifyFingerprintRequest> verifyFpValidator) : ControllerBase
{
    [HttpPost("face/enroll")]
    public async Task<ActionResult<ApiResponse<object>>> EnrollFace([FromBody] EnrollFaceRequest request)
    {
        var v = await enrollFaceValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        return Ok(ApiResponse<object>.Ok(await service.EnrollFaceAsync(request), "Face enrolled successfully."));
    }

    [HttpPost("face/verify")]
    public async Task<ActionResult<ApiResponse<object>>> VerifyFace([FromBody] VerifyFaceRequest request)
    {
        var v = await verifyFaceValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        var result = await service.VerifyFaceAsync(request);
        return result.Verified ? Ok(ApiResponse<object>.Ok(result, "Identity verified.")) : Unauthorized(ApiResponse<object>.Fail("Face verification failed."));
    }

    [HttpDelete("face/{userId}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteBiometric(ulong userId)
    {
        var ok = await service.DeleteBiometricAsync(userId);
        return ok ? Ok(ApiResponse<object>.Ok((object)null!, "Biometric data removed.")) : NotFound(ApiResponse<object>.Fail("No biometric data found for user."));
    }

    [HttpGet("entry/logs")]
    public async Task<ActionResult<ApiResponse<object>>> GetEntryLogs([FromQuery] ulong tenantId, [FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 20)
        => Ok(ApiResponse<object>.Ok(await service.GetEntryLogsAsync(tenantId, pageNumber, pageSize)));

    [HttpPost("fingerprint/enroll")]
    public async Task<ActionResult<ApiResponse<object>>> EnrollFingerprint([FromBody] EnrollFingerprintRequest request)
    {
        var v = await enrollFpValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        return Ok(ApiResponse<object>.Ok(await service.EnrollFingerprintAsync(request), "Fingerprint enrolled successfully."));
    }

    [HttpPost("fingerprint/verify")]
    public async Task<ActionResult<ApiResponse<object>>> VerifyFingerprint([FromBody] VerifyFingerprintRequest request)
    {
        var v = await verifyFpValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        var result = await service.VerifyFingerprintAsync(request);
        return result.Verified ? Ok(ApiResponse<object>.Ok(result, "Fingerprint verified.")) : Unauthorized(ApiResponse<object>.Fail("Fingerprint verification failed."));
    }
}
