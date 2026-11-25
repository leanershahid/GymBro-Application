using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Training;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;

namespace GymManagmentApplication.Controllers;

/// <summary>
/// Weekly plan builder (trainer + admin): weeks × days, each day with its own workout; day and week
/// copy, duplicate, members' copies, and staff skip/move on a member's plan. Plan CRUD, assign and
/// members are in <see cref="WorkoutPlanController"/>.
/// </summary>
[ApiController]
[PermissionModule("plans")]
[RequireModule("plans")]
[Route("api/plans")]
[AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
public class PlanBuilderController(PlanBuilderService builder, MemberTrainingService training) : ControllerBase
{
    /// <summary>The whole plan for the builder (members: read-only, own plans only).</summary>
    [HttpGet("{id:long}/builder")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> Builder(ulong id)
        => Ok(ApiResponse<object>.Ok(await builder.GetBuilderAsync(id)));

    [HttpPut("{id:long}/weeks/{week:int}/days/{day:int}")]
    public async Task<ActionResult<ApiResponse<object>>> UpsertDay(ulong id, byte week, byte day, [FromBody] UpsertPlanDayRequest request)
        => Ok(ApiResponse<object>.Ok(await builder.UpsertDayAsync(id, week, day, request), "Day saved."));

    [HttpPost("{id:long}/days/{dayId:long}/copy")]
    public async Task<ActionResult<ApiResponse<object>>> CopyDay(ulong id, ulong dayId, [FromBody] CopyDayRequest request)
        => Ok(ApiResponse<object>.Ok(await builder.CopyDayAsync(id, dayId, request), "Day copied."));

    [HttpPost("{id:long}/days/{dayId:long}/from-library")]
    public async Task<ActionResult<ApiResponse<object>>> FromLibrary(ulong id, ulong dayId, [FromBody] FromLibraryRequest request)
        => Ok(ApiResponse<object>.Ok(await builder.FromLibraryAsync(id, dayId, request), "Workout added to the day."));

    [HttpDelete("{id:long}/days/{dayId:long}/content")]
    public async Task<ActionResult<ApiResponse<object>>> ClearDay(ulong id, ulong dayId)
        => Ok(ApiResponse<object>.Ok(await builder.ClearDayAsync(id, dayId), "Day cleared."));

    [HttpPost("{id:long}/weeks")]
    public async Task<ActionResult<ApiResponse<object>>> AddWeek(ulong id, [FromBody] AddWeekRequest? request)
        => Ok(ApiResponse<object>.Ok(await builder.AddWeekAsync(id, request ?? new AddWeekRequest()), "Week added."));

    [HttpPost("{id:long}/weeks/{week:int}/copy")]
    public async Task<ActionResult<ApiResponse<object>>> CopyWeek(ulong id, byte week, [FromBody] CopyWeekRequest request)
        => Ok(ApiResponse<object>.Ok(await builder.CopyWeekAsync(id, week, request), "Week copied."));

    [HttpDelete("{id:long}/weeks/{week:int}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteWeek(ulong id, byte week)
        => Ok(ApiResponse<object>.Ok(await builder.DeleteWeekAsync(id, week), "Week deleted."));

    [HttpPost("{id:long}/duplicate")]
    public async Task<ActionResult<ApiResponse<object>>> Duplicate(ulong id, [FromBody] DuplicatePlanRequest? request)
        => Ok(ApiResponse<object>.Ok(await builder.DuplicateAsync(id, request ?? new DuplicatePlanRequest()), "Plan duplicated."));

    // ── A member's own copy, by assignment ─────────────────────────────────

    [HttpGet("assignments/{assignmentId:long}/builder")]
    public async Task<ActionResult<ApiResponse<object>>> ClientCopy(ulong assignmentId)
        => Ok(ApiResponse<object>.Ok(await builder.GetClientCopyAsync(assignmentId)));

    [HttpGet("assignments/{assignmentId:long}/calendar")]
    public async Task<ActionResult<ApiResponse<object>>> Calendar(ulong assignmentId, [FromQuery] DateOnly? from, [FromQuery] DateOnly? to)
        => Ok(ApiResponse<object>.Ok(await training.GetCalendarAsync(assignmentId, from, to)));

    [HttpPost("assignments/{assignmentId:long}/days/skip")]
    public async Task<ActionResult<ApiResponse<object>>> Skip(ulong assignmentId, [FromBody] DayOverrideRequest request)
        => Ok(ApiResponse<object>.Ok(await training.SkipAsync(assignmentId, request), "Day skipped."));

    [HttpPost("assignments/{assignmentId:long}/days/move")]
    public async Task<ActionResult<ApiResponse<object>>> Move(ulong assignmentId, [FromBody] DayOverrideRequest request)
        => Ok(ApiResponse<object>.Ok(await training.MoveAsync(assignmentId, request), "Day moved."));

    [HttpDelete("assignments/{assignmentId:long}/days/{date}/override")]
    public async Task<ActionResult<ApiResponse<object>>> ClearOverride(ulong assignmentId, DateOnly date)
    {
        var ok = await training.ClearOverrideAsync(assignmentId, date);
        return ok ? Ok(ApiResponse<object>.Ok((object)null!, "Change undone.")) : NotFound(ApiResponse<object>.Fail("Nothing to undo on that date."));
    }
}
