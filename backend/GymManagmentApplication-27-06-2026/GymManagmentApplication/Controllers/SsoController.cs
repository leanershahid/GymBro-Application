using FluentValidation;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.SSO.Interfaces;
using GymManagmentApplication.Application.SSO.Requests;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;
using GymManagmentApplication.Domain.Constants;

namespace GymManagmentApplication.Controllers;

[ApiController]
[Route("api/auth/sso")]
public class SsoController(
    ISsoService service,
    IValidator<SsoInitRequest> initValidator,
    IValidator<SsoCallbackRequest> callbackValidator,
    IValidator<ConfigureSsoProviderRequest> configureValidator) : ControllerBase
{
    [HttpPost("init")]
    public async Task<ActionResult<ApiResponse<object>>> Init([FromBody] SsoInitRequest request)
    {
        var v = await initValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        var result = await service.InitAsync(request);
        return Ok(ApiResponse<object>.Ok(result, "SSO authorization URL generated."));
    }

    [HttpPost("callback")]
    public async Task<ActionResult<ApiResponse<object>>> Callback([FromBody] SsoCallbackRequest request)
    {
        var v = await callbackValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        var result = await service.CallbackAsync(request);
        if (result is null) return Unauthorized(ApiResponse<object>.Fail("SSO authentication failed."));
        return Ok(ApiResponse<object>.Ok(result, "SSO login successful."));
    }

    [HttpGet("providers")]
    [AuthorizeRoles(RoleNames.Admin)]
    public async Task<ActionResult<ApiResponse<object>>> GetProviders([FromQuery] ulong tenantId)
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
