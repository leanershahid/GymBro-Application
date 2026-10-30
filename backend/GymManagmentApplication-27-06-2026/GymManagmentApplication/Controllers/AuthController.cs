using System.Security.Claims;
using FluentValidation;
using GymManagmentApplication.Application.Auth.Interfaces;
using GymManagmentApplication.Application.Auth.Requests;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using GymManagmentApplication.Application.Auth;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Http;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using GymManagmentApplication.Domain.Constants;

namespace GymManagmentApplication.Controllers;

[ApiController]
[Route("api/auth")]
[EnableRateLimiting(RateLimits.Auth)] // brute-force protection for every auth endpoint
public class AuthController(
    IAuthService service,
    IValidator<LoginRequest> loginValidator,
    IValidator<RegisterRequest> registerValidator,
    IValidator<ForgotPasswordRequest> forgotValidator,
    IValidator<ResetPasswordRequest> resetValidator,
    IValidator<ChangePasswordRequest> changeValidator,
    IValidator<VerifyEmailRequest> verifyValidator,
    IValidator<ResendOtpRequest> resendValidator) : ControllerBase
{
    [HttpPost("register")]
    public async Task<ActionResult<ApiResponse<object>>> Register([FromBody] RegisterRequest request)
    {
        var v = await registerValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        var result = await service.RegisterAsync(request);
        if (result is null) return Conflict(ApiResponse<object>.Fail("Email already registered."));
        return Ok(ApiResponse<object>.Ok(result, "Account created. Enter the code we emailed you to verify it."));
    }

    [HttpPost("login")]
    public async Task<ActionResult<ApiResponse<object>>> Login([FromBody] LoginRequest request)
    {
        var v = await loginValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        var result = await service.LoginAsync(request, Session());
        if (result is null) return Unauthorized(ApiResponse<object>.Fail("Invalid email or password."));
        return Ok(ApiResponse<object>.Ok(result, "Login successful."));
    }

    [HttpPost("logout")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<object>>> Logout([FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] LogoutRequest? request)
    {
        var userId = ulong.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
        await service.LogoutAsync(userId, request?.RefreshToken);
        return Ok(ApiResponse<object>.Ok((object)null!, "Logged out successfully."));
    }

    [HttpPost("refresh-token")]
    public async Task<ActionResult<ApiResponse<object>>> Refresh([FromBody] RefreshTokenRequest request)
    {
        var result = await service.RefreshAsync(request.RefreshToken, Session());
        if (result is null) return Unauthorized(ApiResponse<object>.Fail("Invalid or expired refresh token."));
        return Ok(ApiResponse<object>.Ok(result, "Token refreshed."));
    }

    [HttpPost("forgot-password")]
    public async Task<ActionResult<ApiResponse<object>>> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        var v = await forgotValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        await service.ForgotPasswordAsync(request);
        return Ok(ApiResponse<object>.Ok((object)null!, "Password reset email sent if account exists."));
    }

    [HttpPost("reset-password")]
    public async Task<ActionResult<ApiResponse<object>>> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        var v = await resetValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        var ok = await service.ResetPasswordAsync(request);
        return ok ? Ok(ApiResponse<object>.Ok((object)null!, "Password reset successful.")) : BadRequest(ApiResponse<object>.Fail("That code is wrong or has expired. Request a new one."));
    }

    [HttpPut("change-password")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<object>>> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var v = await changeValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        var userId = ulong.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
        var ok = await service.ChangePasswordAsync(userId, request);
        return ok ? Ok(ApiResponse<object>.Ok((object)null!, "Password changed successfully.")) : BadRequest(ApiResponse<object>.Fail("Current password is incorrect."));
    }

    [HttpGet("me")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<object>>> Me()
    {
        var userId = ulong.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
        var result = await service.GetMeAsync(userId);
        return result is null ? NotFound(ApiResponse<object>.Fail("User not found.")) : Ok(ApiResponse<object>.Ok(result));
    }

    [HttpPost("verify-email")]
    public async Task<ActionResult<ApiResponse<object>>> VerifyEmail([FromBody] VerifyEmailRequest request)
    {
        var v = await verifyValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        var ok = await service.VerifyEmailAsync(request);
        return ok ? Ok(ApiResponse<object>.Ok((object)null!, "Email verified successfully.")) : BadRequest(ApiResponse<object>.Fail("That code is wrong or has expired. Request a new one."));
    }

    [HttpPost("resend-otp")]
    public async Task<ActionResult<ApiResponse<object>>> ResendOtp([FromBody] ResendOtpRequest request)
    {
        var v = await resendValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        await service.ResendOtpAsync(request);
        return Ok(ApiResponse<object>.Ok((object)null!, "If that email needs verifying, a new code is on its way."));
    }

    private SessionInfo Session()
    {
        var ua = Request.Headers.UserAgent.ToString();
        var device = ua.Contains("Android", StringComparison.OrdinalIgnoreCase) ? DeviceType.Android
                   : ua.Contains("iPhone", StringComparison.OrdinalIgnoreCase) || ua.Contains("iPad", StringComparison.OrdinalIgnoreCase) ? DeviceType.Ios
                   : DeviceType.Web;
        return new SessionInfo(HttpContext.Connection.RemoteIpAddress?.ToString(), ua, device);
    }
}
