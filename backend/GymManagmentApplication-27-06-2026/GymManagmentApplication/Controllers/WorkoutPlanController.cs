using System.Security.Claims;
using FluentValidation;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.WorkoutPlan.Interfaces;
using GymManagmentApplication.Application.WorkoutPlan.Requests;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;
using GymManagmentApplication.Domain.Constants;

namespace GymManagmentApplication.Controllers;

[ApiController]
[Route("api/plans")]
[RequireModule("plans")]
public class WorkoutPlanController(
    IWorkoutPlanService service,
    IValidator<CreatePlanRequest> createValidator,
    IValidator<UpdatePlanRequest> updateValidator,
    IValidator<AssignPlanRequest> assignValidator) : ControllerBase
{
    private ulong UserId => ulong.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");

    [HttpGet]
    public async Task<ActionResult<ApiResponse<object>>> List([FromQuery] PlanListRequest request)
        => Ok(ApiResponse<object>.Ok(await service.GetAllAsync(request)));

    [HttpPost]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> Create([FromBody] CreatePlanRequest request)
    {
        var v = await createValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        return Ok(ApiResponse<object>.Ok(await service.CreateAsync(UserId, request), "Plan created."));
    }

    [HttpGet("{id:long}")]
    public async Task<ActionResult<ApiResponse<object>>> GetById(ulong id)
    {
        var result = await service.GetByIdAsync(id);
        return result is null ? NotFound(ApiResponse<object>.Fail("Plan not found.")) : Ok(ApiResponse<object>.Ok(result));
    }

    [HttpPut("{id:long}")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> Update(ulong id, [FromBody] UpdatePlanRequest request)
    {
        var v = await updateValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        var result = await service.UpdateAsync(id, request);
        return result is null ? NotFound(ApiResponse<object>.Fail("Plan not found.")) : Ok(ApiResponse<object>.Ok(result, "Plan updated."));
    }

    [HttpDelete("{id:long}")]
    [AuthorizeRoles(RoleNames.Admin)]
    public async Task<ActionResult<ApiResponse<object>>> Delete(ulong id)
    {
        var ok = await service.DeleteAsync(id);
        return ok ? Ok(ApiResponse<object>.Ok((object)null!, "Plan deleted.")) : NotFound(ApiResponse<object>.Fail("Plan not found."));
    }

    [HttpGet("{id:long}/tree")]
    public async Task<ActionResult<ApiResponse<object>>> GetTree(ulong id)
    {
        var result = await service.GetTreeAsync(id);
        return result is null ? NotFound(ApiResponse<object>.Fail("Plan not found.")) : Ok(ApiResponse<object>.Ok(result));
    }

    [HttpPost("{id:long}/branch")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> AddBranch(ulong id, [FromBody] AddBranchRequest request)
    {
        await service.AddBranchAsync(id, request);
        return Ok(ApiResponse<object>.Ok((object)null!, "Branch added."));
    }

    [HttpPut("{id:long}/progression")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> UpdateProgression(ulong id, [FromBody] UpdateProgressionRequest request)
    {
        var ok = await service.UpdateProgressionAsync(id, request);
        return ok ? Ok(ApiResponse<object>.Ok((object)null!, "Progression updated.")) : NotFound(ApiResponse<object>.Fail("Plan not found."));
    }

    [HttpPost("{id:long}/assign")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> Assign(ulong id, [FromBody] AssignPlanRequest request)
    {
        var v = await assignValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        return Ok(ApiResponse<object>.Ok(await service.AssignAsync(id, request), "Plan assigned."));
    }

    [HttpGet("{id:long}/members")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> GetMembers(ulong id)
        => Ok(ApiResponse<object>.Ok(await service.GetMembersAsync(id)));

    [HttpGet("{id:long}/analytics")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> GetAnalytics(ulong id)
    {
        var result = await service.GetAnalyticsAsync(id);
        return result is null ? NotFound(ApiResponse<object>.Fail("Plan not found.")) : Ok(ApiResponse<object>.Ok(result));
    }
}
