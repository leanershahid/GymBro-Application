using FluentValidation;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.SSO.Interfaces;
using GymManagmentApplication.Application.SSO.Requests;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using GymManagmentApplication.Domain.Constants;

namespace GymManagmentApplication.Controllers;

/// <summary>
/// SSO provider configuration (admin) and sign-in. Sign-in (init/callback) is not functional yet — no
/// OAuth code exchange exists (ARCH-111) — so those two public endpoints answer 404 unless
/// "Sso:Enabled" is true. The admin provider endpoints are unaffected.
/// </summary>
[ApiController]
[PermissionModule("integrations")]
[Route("api/auth/sso")]
public class SsoController(
    IConfiguration config,
    ISsoService service,
    IValidator<SsoInitRequest> initValidator,
    IValidator<SsoCallbackRequest> callbackValidator,
    IValidator<ConfigureSsoProviderRequest> configureValidator) : ControllerBase
{
    private bool SignInEnabled => config.GetValue<bool>("Sso:Enabled");

    [HttpPost("init")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<object>>> Init([FromBody] SsoInitRequest request)
    {
        if (!SignInEnabled) return NotFound(ApiResponse<object>.Fail("SSO sign-in is not available."));
        var v = await initValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        var result = await service.InitAsync(request);
        return Ok(ApiResponse<object>.Ok(result, "SSO authorization URL generated."));
    }

    [HttpPost("callback")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<object>>> Callback([FromBody] SsoCallbackRequest request)
    {
        if (!SignInEnabled) return NotFound(ApiResponse<object>.Fail("SSO sign-in is not available."));
        var v = await callbackValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        var result = await service.CallbackAsync(request);
        if (result is null) return Unauthorized(ApiResponse<object>.Fail("SSO authentication failed."));
        return Ok(ApiResponse<object>.Ok(result, "SSO login successful."));
    }

    [HttpGet("providers")]
    [AuthorizeRoles(RoleNames.Admin)]
    public async Task<ActionResult<ApiResponse<object>>> GetProviders([FromQuery] ulong tenantId = 0)
        => Ok(ApiResponse<object>.Ok(await service.GetProvidersAsync(tenantId)));

    [HttpPut("providers/{id}")]
    [AuthorizeRoles(RoleNames.Admin)]
    public async Task<ActionResult<ApiResponse<object>>> ConfigureProvider(string id, [FromBody] ConfigureSsoProviderRequest request)
    {
        var v = await configureValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        var result = await service.ConfigureProviderAsync(id, request);
        return result is null ? NotFound(ApiResponse<object>.Fail($"SSO provider {id} not found.")) : Ok(ApiResponse<object>.Ok(result));
    }

    [HttpDelete("providers/{id}")]
    [AuthorizeRoles(RoleNames.Admin)]
    public async Task<ActionResult<ApiResponse<object>>> DeleteProvider(string id)
    {
        var ok = await service.DeleteProviderAsync(id);
        return ok ? Ok(ApiResponse<object>.Ok((object)null!, "SSO provider removed.")) : NotFound(ApiResponse<object>.Fail($"SSO provider {id} not found."));
    }
}
