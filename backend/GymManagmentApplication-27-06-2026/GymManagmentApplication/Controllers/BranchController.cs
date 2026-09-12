using FluentValidation;
using GymManagmentApplication.Application.Branch.Interfaces;
using GymManagmentApplication.Application.Branch.Requests;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;
using GymManagmentApplication.Domain.Constants;

namespace GymManagmentApplication.Controllers;

[ApiController]
[Route("api/branches")]
[AuthorizeRoles(RoleNames.Admin)]
public class BranchController(IBranchService service, IValidator<CreateBranchRequest> validator) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<object>>> GetAll()
        => Ok(ApiResponse<object>.Ok(await service.GetAllAsync()));

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<object>>> GetById(ulong id)
    {
        var result = await service.GetByIdAsync(id);
        return result is null ? NotFound(ApiResponse<object>.Fail($"Branch {id} not found.")) : Ok(ApiResponse<object>.Ok(result));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<object>>> Create([FromBody] CreateBranchRequest request)
    {
        var v = await validator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        var result = await service.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, ApiResponse<object>.Ok(result, "Branch created."));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse<object>>> Update(ulong id, [FromBody] UpdateBranchRequest request)
    {
        var result = await service.UpdateAsync(id, request);
        return result is null ? NotFound(ApiResponse<object>.Fail($"Branch {id} not found.")) : Ok(ApiResponse<object>.Ok(result));
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(ulong id)
    {
        var deleted = await service.DeleteAsync(id);
        return deleted ? Ok(ApiResponse<object>.Ok((object)null!, "Branch deleted.")) : NotFound(ApiResponse<object>.Fail($"Branch {id} not found."));
    }
}
