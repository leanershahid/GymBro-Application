using FluentValidation;
using GymManagmentApplication.Application.Branch.Interfaces;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Tenant.Interfaces;
using GymManagmentApplication.Application.Tenant.Requests;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;
using GymManagmentApplication.Domain.Constants;

namespace GymManagmentApplication.Controllers;

[ApiController]
[Route("api/tenants")]
[AuthorizeRoles(RoleNames.Admin)]
public class TenantController(
    ITenantService service,
    IBranchService branchService,
    IValidator<CreateTenantRequest> validator) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<object>>> GetAll()
        => Ok(ApiResponse<object>.Ok(await service.GetAllAsync()));

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<object>>> GetById(ulong id)
    {
        var result = await service.GetByIdAsync(id);
        return result is null
            ? NotFound(ApiResponse<object>.Fail($"Tenant {id} not found."))
            : Ok(ApiResponse<object>.Ok(result));

    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<object>>> Create([FromBody] CreateTenantRequest request)
    {
        var v = await validator.ValidateAsync(request);
        if (!v.IsValid)
            return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        var result = await service.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, ApiResponse<object>.Ok(result, "Tenant created."));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse<object>>> Update(ulong id, [FromBody] UpdateTenantRequest request)
    {
        var result = await service.UpdateAsync(id, request);
        return result is null
            ? NotFound(ApiResponse<object>.Fail($"Tenant {id} not found."))
            : Ok(ApiResponse<object>.Ok(result));
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(ulong id)
    {
        var deleted = await service.DeleteAsync(id);
        return deleted
            ? Ok(ApiResponse<object>.Ok((object)null!, "Tenant deleted."))
            : NotFound(ApiResponse<object>.Fail($"Tenant {id} not found."));
    }

    // Nested: GET api/tenants/{tenantId}/branches
    [HttpGet("{tenantId}/branches")]
    public async Task<ActionResult<ApiResponse<object>>> GetBranches(ulong tenantId)
        => Ok(ApiResponse<object>.Ok(await branchService.GetByTenantAsync(tenantId)));
}
