using System.Security.Claims;
using FluentValidation;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Workout.Interfaces;
using GymManagmentApplication.Application.Workout.Requests;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;
using GymManagmentApplication.Domain.Constants;

namespace GymManagmentApplication.Controllers;

[ApiController]
[Route("api/workouts")]
[RequireModule("workouts")]
public class WorkoutController(
    IWorkoutService service,
    IValidator<CreateWorkoutRequest> createValidator,
    IValidator<UpdateWorkoutRequest> updateValidator,
    IValidator<AssignWorkoutRequest> assignValidator,
    IValidator<CompleteWorkoutRequest> completeValidator) : ControllerBase
{
    private ulong UserId => ulong.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");

    [HttpGet]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> List([FromQuery] WorkoutListRequest request)
        => Ok(ApiResponse<object>.Ok(await service.GetAllAsync(request)));

    [HttpPost]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> Create([FromBody] CreateWorkoutRequest request)
    {
        var v = await createValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        return Ok(ApiResponse<object>.Ok(await service.CreateAsync(UserId, request), "Workout created."));
    }

    [HttpGet("{id:long}")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> GetById(ulong id)
    {
        var result = await service.GetByIdAsync(id);
        return result is null ? NotFound(ApiResponse<object>.Fail("Workout not found.")) : Ok(ApiResponse<object>.Ok(result));
    }

    [HttpPut("{id:long}")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> Update(ulong id, [FromBody] UpdateWorkoutRequest request)
    {
        var v = await updateValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        var result = await service.UpdateAsync(id, request);
        return result is null ? NotFound(ApiResponse<object>.Fail("Workout not found.")) : Ok(ApiResponse<object>.Ok(result, "Workout updated."));
    }

    [HttpDelete("{id:long}")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> Delete(ulong id)
    {
        var ok = await service.DeleteAsync(id);
        return ok ? Ok(ApiResponse<object>.Ok((object)null!, "Workout deleted.")) : NotFound(ApiResponse<object>.Fail("Workout not found."));
    }

    [HttpPost("{id:long}/clone")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> Clone(ulong id)
    {
        var result = await service.CloneAsync(id, UserId);
        return result is null ? NotFound(ApiResponse<object>.Fail("Workout not found.")) : Ok(ApiResponse<object>.Ok(result, "Workout cloned."));
    }

    [HttpPost("assign")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> Assign([FromBody] AssignWorkoutRequest request)
    {
        var v = await assignValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        return Ok(ApiResponse<object>.Ok(await service.AssignAsync(request), "Workout assigned."));
    }

    [HttpGet("{id:long}/progress")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> GetProgress(ulong id, [FromQuery] ulong clientId)
    {
        var result = await service.GetProgressAsync(id, clientId);
        return result is null ? NotFound(ApiResponse<object>.Fail("No progress data found.")) : Ok(ApiResponse<object>.Ok(result));
    }

    [HttpPost("{id:long}/complete")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> Complete(ulong id, [FromBody] CompleteWorkoutRequest request)
    {
        var v = await completeValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        return Ok(ApiResponse<object>.Ok(await service.CompleteAsync(id, request), "Workout completed."));
    }

    [HttpGet("{id:long}/score")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> GetScore(ulong id, [FromQuery] ulong clientId)
    {
        var result = await service.GetScoreAsync(id, clientId);
        return result is null ? NotFound(ApiResponse<object>.Fail("No score found.")) : Ok(ApiResponse<object>.Ok(result));
    }

    [HttpPost("{id:long}/share")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> Share(ulong id)
    {
        await service.ShareAsync(id, UserId);
        return Ok(ApiResponse<object>.Ok((object)null!, "Workout shared."));
    }

    [HttpPost("{id:long}/bookmark")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> Bookmark(ulong id)
    {
        await service.BookmarkAsync(id, UserId);
        return Ok(ApiResponse<object>.Ok((object)null!, "Bookmark toggled."));
    }
}
