using FluentValidation;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Roles.Interfaces;
using GymManagmentApplication.Application.Roles.Requests;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;
using GymManagmentApplication.Domain.Constants;

namespace GymManagmentApplication.Controllers;

[ApiController]
[AuthorizeRoles(RoleNames.Admin)]
public class RolesController(
    IRolesService service,
    IValidator<CreateRoleRequest> createValidator,
    IValidator<UpdateRolePermissionsRequest> permissionsValidator,
    IValidator<AssignRoleRequest> assignValidator) : ControllerBase
{
    [HttpGet("api/roles")]
    public async Task<ActionResult<ApiResponse<object>>> GetAll()
        => Ok(ApiResponse<object>.Ok(await service.GetAllRolesAsync()));

    [HttpPost("api/roles")]
    public async Task<ActionResult<ApiResponse<object>>> Create([FromBody] CreateRoleRequest request)
    {
        var v = await createValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        var result = await service.CreateRoleAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, ApiResponse<object>.Ok(result, "Role created."));
    }

    [HttpGet("api/roles/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> GetById(string id)
    {
        var result = await service.GetRoleByIdAsync(id);
        return result is null ? NotFound(ApiResponse<object>.Fail($"Role {id} not found.")) : Ok(ApiResponse<object>.Ok(result));
    }

    [HttpPut("api/roles/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> Update(string id, [FromBody] UpdateRoleRequest request)
    {
        var result = await service.UpdateRoleAsync(id, request);
        return result is null ? NotFound(ApiResponse<object>.Fail($"Role {id} not found.")) : Ok(ApiResponse<object>.Ok(result));
    }

    [HttpDelete("api/roles/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(string id)
    {
        var ok = await service.DeleteRoleAsync(id);
        return ok ? Ok(ApiResponse<object>.Ok((object)null!, "Role deleted.")) : NotFound(ApiResponse<object>.Fail($"Role {id} not found."));
    }

    [HttpGet("api/roles/{id}/permissions")]
    public async Task<ActionResult<ApiResponse<object>>> GetPermissions(string id)
        => Ok(ApiResponse<object>.Ok(await service.GetRolePermissionsAsync(id)));

    [HttpPut("api/roles/{id}/permissions")]
    public async Task<ActionResult<ApiResponse<object>>> UpdatePermissions(string id, [FromBody] UpdateRolePermissionsRequest request)
    {
        var v = await permissionsValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        var result = await service.UpdateRolePermissionsAsync(id, request);
        return result is null ? NotFound(ApiResponse<object>.Fail($"Role {id} not found.")) : Ok(ApiResponse<object>.Ok(result));
    }

    [HttpGet("api/permissions")]
    public async Task<ActionResult<ApiResponse<object>>> GetAllPermissions()
        => Ok(ApiResponse<object>.Ok(await service.GetAllPermissionsAsync()));

    [HttpGet("api/permissions/matrix")]
    public async Task<ActionResult<ApiResponse<object>>> GetMatrix()
        => Ok(ApiResponse<object>.Ok(await service.GetPermissionMatrixAsync()));

    [HttpPost("api/users/{id}/roles")]
    public async Task<ActionResult<ApiResponse<object>>> AssignRole(ulong id, [FromBody] AssignRoleRequest request)
    {
        var v = await assignValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        var ok = await service.AssignRoleToUserAsync(id, request);
        return ok ? Ok(ApiResponse<object>.Ok((object)null!, "Role assigned.")) : BadRequest(ApiResponse<object>.Fail("Role not found."));
    }

    [HttpDelete("api/users/{id}/roles/{roleId}")]
    public async Task<ActionResult<ApiResponse<object>>> RevokeRole(ulong id, string roleId)
    {
        var ok = await service.RevokeRoleFromUserAsync(id, roleId);
        return ok ? Ok(ApiResponse<object>.Ok((object)null!, "Role revoked.")) : NotFound(ApiResponse<object>.Fail("User does not have this role."));
    }
}
