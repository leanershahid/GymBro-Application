using FluentValidation;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.ModuleAccess.Interfaces;
using GymManagmentApplication.Application.ModuleAccess.Requests;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;
using GymManagmentApplication.Domain.Constants;

namespace GymManagmentApplication.Controllers;

[ApiController]
[Route("api/module-access")]
[AuthorizeRoles(RoleNames.Admin)]
public class ModuleAccessController(
    IModuleAccessService service,
    IValidator<SetModuleAccessRequest> setValidator,
    IValidator<BulkSetModuleAccessRequest> bulkValidator,
    IValidator<CheckModuleAccessRequest> checkValidator) : ControllerBase
{
    // ── GET api/module-access/modules ─────────────────────────────────────
    /// <summary>List all platform module keys available for access configuration.</summary>
    [HttpGet("modules")]
    public ActionResult<ApiResponse<object>> GetModules()
        => Ok(ApiResponse<object>.Ok(service.GetAvailableModules(), "Available modules."));

    // ── GET api/module-access?tenantId=1&roleId=2 ─────────────────────────
    /// <summary>Get all module access entries for a specific role in a tenant.</summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<object>>> GetByRole(
        [FromQuery] ulong tenantId,
        [FromQuery] ulong roleId)
    {
        if (tenantId == 0 || roleId == 0)
            return BadRequest(ApiResponse<object>.Fail("tenantId and roleId are required."));

        var result = await service.GetByRoleAsync(tenantId, roleId);
        return Ok(ApiResponse<object>.Ok(result));
    }

    // ── GET api/module-access/matrix?tenantId=1 ───────────────────────────
    /// <summary>Get the full module access matrix for all roles in a tenant.</summary>
    [HttpGet("matrix")]
    public async Task<ActionResult<ApiResponse<object>>> GetMatrix([FromQuery] ulong tenantId)
    {
        if (tenantId == 0)
            return BadRequest(ApiResponse<object>.Fail("tenantId is required."));

        var result = await service.GetMatrixAsync(tenantId);
        return Ok(ApiResponse<object>.Ok(result));
    }

    // ── POST api/module-access ────────────────────────────────────────────
    /// <summary>Set (upsert) access for a single module + role combination.</summary>
    [HttpPost]
    public async Task<ActionResult<ApiResponse<object>>> Set([FromBody] SetModuleAccessRequest request)
    {
        var v = await setValidator.ValidateAsync(request);
        if (!v.IsValid)
            return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));

        var result = await service.SetAsync(request);
        return Ok(ApiResponse<object>.Ok(result, "Module access updated."));
    }

    // ── POST api/module-access/bulk ───────────────────────────────────────
    /// <summary>Bulk upsert access for multiple modules for a role in one call.</summary>
    [HttpPost("bulk")]
    public async Task<ActionResult<ApiResponse<object>>> BulkSet([FromBody] BulkSetModuleAccessRequest request)
    {
        var v = await bulkValidator.ValidateAsync(request);
        if (!v.IsValid)
            return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));

        var result = await service.BulkSetAsync(request);
        return Ok(ApiResponse<object>.Ok(result, $"{result.Count} module access entries updated."));
    }

    // ── POST api/module-access/check ──────────────────────────────────────
    /// <summary>Check whether a role has a specific action on a module.</summary>
    [HttpPost("check")]
    public async Task<ActionResult<ApiResponse<object>>> Check(
        [FromQuery] ulong tenantId,
        [FromBody] CheckModuleAccessRequest request)
    {
        if (tenantId == 0)
            return BadRequest(ApiResponse<object>.Fail("tenantId is required."));

        var v = await checkValidator.ValidateAsync(request);
        if (!v.IsValid)
            return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));

        var result = await service.CheckAsync(tenantId, request);
        return Ok(ApiResponse<object>.Ok(result));
    }

    // ── DELETE api/module-access?tenantId=1&roleId=2&module=members ───────
    /// <summary>Revoke access for a role on a specific module.</summary>
    [HttpDelete]
    public async Task<ActionResult<ApiResponse<object>>> Revoke(
        [FromQuery] ulong tenantId,
        [FromQuery] ulong roleId,
        [FromQuery] string module)
    {
        if (tenantId == 0 || roleId == 0 || string.IsNullOrWhiteSpace(module))
            return BadRequest(ApiResponse<object>.Fail("tenantId, roleId and module are required."));

        var ok = await service.RevokeAsync(tenantId, roleId, module);
        return ok
            ? Ok(ApiResponse<object>.Ok((object)null!, "Module access revoked."))
            : NotFound(ApiResponse<object>.Fail($"No access entry found for role {roleId} on module '{module}'."));
    }

    // ── DELETE api/module-access/role?tenantId=1&roleId=2 ─────────────────
    /// <summary>Revoke ALL module access for a role (e.g. before deleting the role).</summary>
    [HttpDelete("role")]
    public async Task<ActionResult<ApiResponse<object>>> RevokeAllForRole(
        [FromQuery] ulong tenantId,
        [FromQuery] ulong roleId)
    {
        if (tenantId == 0 || roleId == 0)
            return BadRequest(ApiResponse<object>.Fail("tenantId and roleId are required."));

        var ok = await service.RevokeAllForRoleAsync(tenantId, roleId);
        return ok
            ? Ok(ApiResponse<object>.Ok((object)null!, "All module access for role revoked."))
            : NotFound(ApiResponse<object>.Fail($"No module access entries found for role {roleId}."));
    }
}
