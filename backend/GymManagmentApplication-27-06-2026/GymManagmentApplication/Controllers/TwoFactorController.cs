using System.Security.Claims;
using GymManagmentApplication.Application.Auth;
using GymManagmentApplication.Application.Auth.Interfaces;
using GymManagmentApplication.Application.Auth.TwoFactor;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Filters;
using GymManagmentApplication.Infrastructure.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace GymManagmentApplication.Controllers;

/// <summary>
/// Two-step sign-in (roadmap feature 10). Verify / email-code finish a sign-in that
/// POST /api/auth/login answered with requiresTwoFactor; the rest manage the caller's own
/// authenticator, recovery codes and remembered devices, the gym's policy, and admin resets.
/// Everything here is under /api/auth, so TwoFactorSetupGate lets a "setup required" token through.
/// </summary>
[ApiController]
[Route("api/auth/2fa")]
[EnableRateLimiting(RateLimits.Auth)]
public class TwoFactorController(IAuthService auth, TwoFactorService twoFactor, ICurrentUser currentUser) : ControllerBase
{
    [HttpPost("verify")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<object>>> Verify([FromBody] TwoFactorVerifyRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ChallengeToken) || string.IsNullOrWhiteSpace(request.Code))
            return BadRequest(ApiResponse<object>.Fail("Enter the code to continue."));
        var result = await auth.VerifyTwoFactorAsync(request, Session());
        if (result.Tokens is not null) return Ok(ApiResponse<object>.Ok(result.Tokens, "Login successful."));
        // 401 when the challenge is over (sign in again), 400 for a wrong code that can be retried.
        var body = ApiResponse<object>.Fail(result.Error ?? "That code is incorrect.",
            result.ChallengeEnded ? ["challenge_expired"] : [$"attempts_remaining:{result.AttemptsRemaining}"]);
        return result.ChallengeEnded ? Unauthorized(body) : BadRequest(body);
    }

    [HttpPost("email-code")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<object>>> EmailCode([FromBody] TwoFactorChallengeRequest request)
    {
        var ok = await auth.SendTwoFactorEmailCodeAsync(request.ChallengeToken ?? string.Empty);
        return ok
            ? Ok(ApiResponse<object>.Ok((object)null!, "We've emailed you a 6-digit code. It expires in 15 minutes."))
            : Unauthorized(ApiResponse<object>.Fail("This sign-in has expired. Please sign in again.", ["challenge_expired"]));
    }

    [HttpGet("status")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<object>>> Status() =>
        Ok(ApiResponse<object>.Ok(await twoFactor.GetStatusAsync(UserId())));

    [HttpPost("setup")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<object>>> Setup() =>
        Ok(ApiResponse<object>.Ok(await twoFactor.BeginSetupAsync(UserId()),
            "Add this key to your authenticator app, then enter the 6-digit code it shows."));

    [HttpPost("enable")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<object>>> Enable([FromBody] TwoFactorCodeRequest request)
    {
        var codes = await twoFactor.EnableAsync(UserId(), request.Code);
        return codes is null
            ? BadRequest(ApiResponse<object>.Fail("That code doesn't match. Check the time on your phone and try the newest code."))
            : Ok(ApiResponse<object>.Ok(codes, "Two-step sign-in is on. Save your recovery codes somewhere safe — they're shown only once."));
    }

    [HttpPost("disable")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<object>>> Disable([FromBody] TwoFactorDisableRequest request)
    {
        await twoFactor.DisableAsync(UserId(), request.Password, request.Code);
        return Ok(ApiResponse<object>.Ok((object)null!, "Two-step sign-in is off."));
    }

    [HttpPost("recovery-codes")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<object>>> RegenerateRecoveryCodes([FromBody] TwoFactorCodeRequest request)
    {
        var codes = await twoFactor.RegenerateRecoveryCodesAsync(UserId(), request.Code);
        return codes is null
            ? BadRequest(ApiResponse<object>.Fail("That code is incorrect or has already been used."))
            : Ok(ApiResponse<object>.Ok(codes, "New recovery codes created. The old ones no longer work."));
    }

    /// <summary>Forget every "remembered" device: the next sign-in on each asks for a code again.</summary>
    [HttpDelete("trusted-devices")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<object>>> ForgetDevices()
    {
        var n = await twoFactor.ForgetDevicesAsync(UserId());
        return Ok(ApiResponse<object>.Ok(new { removed = n }, "Remembered devices forgotten."));
    }

    // ── Gym policy and admin recovery ─────────────────────────────────────────

    [HttpGet("policy")]
    [AuthorizeRoles(RoleNames.Admin)]
    public async Task<ActionResult<ApiResponse<object>>> GetPolicy([FromQuery] ulong? tenantId) =>
        Ok(ApiResponse<object>.Ok(await twoFactor.GetPolicyAsync(currentUser.ResolveTenantId(tenantId))));

    [HttpPut("policy")]
    [AuthorizeRoles(RoleNames.Admin)]
    public async Task<ActionResult<ApiResponse<object>>> SavePolicy([FromBody] TwoFactorPolicySettings request, [FromQuery] ulong? tenantId) =>
        Ok(ApiResponse<object>.Ok(await twoFactor.SavePolicyAsync(currentUser.ResolveTenantId(tenantId), request),
            "Two-step sign-in policy saved."));

    public class AdminResetRequest { public string? Reason { get; set; } }

    /// <summary>Admin recovery: removes a user's 2FA (audit-logged) and signs them out everywhere.</summary>
    [HttpPost("users/{userId}/reset")]
    [AuthorizeRoles(RoleNames.Admin)]
    public async Task<ActionResult<ApiResponse<object>>> AdminReset(ulong userId,
        [FromBody(EmptyBodyBehavior = Microsoft.AspNetCore.Mvc.ModelBinding.EmptyBodyBehavior.Allow)] AdminResetRequest? request)
    {
        await twoFactor.AdminResetAsync(UserId(), currentUser.IsSuperAdmin, userId, request?.Reason,
            HttpContext.Connection.RemoteIpAddress?.ToString(), Request.Headers.UserAgent.ToString());
        return Ok(ApiResponse<object>.Ok((object)null!,
            "Two-step sign-in was reset. They've been signed out and will set it up again at their next sign-in."));
    }

    private ulong UserId() => ulong.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");

    private SessionInfo Session()
    {
        var ua = Request.Headers.UserAgent.ToString();
        var device = ua.Contains("Android", StringComparison.OrdinalIgnoreCase) ? DeviceType.Android
                   : ua.Contains("iPhone", StringComparison.OrdinalIgnoreCase) || ua.Contains("iPad", StringComparison.OrdinalIgnoreCase) ? DeviceType.Ios
                   : DeviceType.Web;
        return new SessionInfo(HttpContext.Connection.RemoteIpAddress?.ToString(), ua, device);
    }
}
