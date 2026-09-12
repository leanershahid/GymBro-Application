using System.Security.Claims;
using FluentValidation;
using GymManagmentApplication.Application.Auth.Interfaces;
using GymManagmentApplication.Application.Auth.Requests;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;
using GymManagmentApplication.Domain.Constants;

namespace GymManagmentApplication.Controllers;

[ApiController]
[Route("api/auth")]
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
        return Ok(ApiResponse<object>.Ok(result, "Registration successful."));
    }

    [HttpPost("login")]
    public async Task<ActionResult<ApiResponse<object>>> Login([FromBody] LoginRequest request)
    {
        var v = await loginValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        var result = await service.LoginAsync(request);
        if (result is null) return Unauthorized(ApiResponse<object>.Fail("Invalid email or password."));
        return Ok(ApiResponse<object>.Ok(result, "Login successful."));
    }

    [HttpPost("logout")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> Logout()
    {
        var userId = ulong.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
        await service.LogoutAsync(userId);
        return Ok(ApiResponse<object>.Ok((object)null!, "Logged out successfully."));
    }

    [HttpPost("refresh-token")]
    public async Task<ActionResult<ApiResponse<object>>> Refresh([FromBody] RefreshTokenRequest request)
    {
        var result = await service.RefreshAsync(request.RefreshToken);
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
        return ok ? Ok(ApiResponse<object>.Ok((object)null!, "Password reset successful.")) : BadRequest(ApiResponse<object>.Fail("Invalid or expired token."));
    }

    [HttpPut("change-password")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var v = await changeValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        var userId = ulong.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
        var ok = await service.ChangePasswordAsync(userId, request);
        return ok ? Ok(ApiResponse<object>.Ok((object)null!, "Password changed successfully.")) : BadRequest(ApiResponse<object>.Fail("Current password is incorrect."));
    }

    [HttpGet("me")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
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
        return ok ? Ok(ApiResponse<object>.Ok((object)null!, "Email verified successfully.")) : BadRequest(ApiResponse<object>.Fail("Invalid or expired OTP."));
    }

    [HttpPost("resend-otp")]
    public async Task<ActionResult<ApiResponse<object>>> ResendOtp([FromBody] ResendOtpRequest request)
    {
        var v = await resendValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        var ok = await service.ResendOtpAsync(request);
        return ok ? Ok(ApiResponse<object>.Ok((object)null!, "OTP sent successfully.")) : BadRequest(ApiResponse<object>.Fail("Email not found."));
    }
}
