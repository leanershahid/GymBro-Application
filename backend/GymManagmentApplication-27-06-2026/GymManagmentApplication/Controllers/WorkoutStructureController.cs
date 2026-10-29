using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Workout;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;

namespace GymManagmentApplication.Controllers;

/// <summary>Workout contents, plan schedules, and a member's assignments.</summary>
[ApiController]
[PermissionModule("workouts")]
[Route("api")]
public class WorkoutStructureController(WorkoutStructureService service) : ControllerBase
{
    [HttpGet("workouts/{id:long}/structure")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> GetStructure(ulong id)
        => Ok(ApiResponse<object>.Ok(await service.GetStructureAsync(id)));

    [HttpPut("workouts/{id:long}/structure")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> SaveStructure(ulong id, [FromBody] WorkoutStructureDto request)
        => Ok(ApiResponse<object>.Ok(await service.SaveStructureAsync(id, request), "Workout saved."));

    [HttpGet("plans/{id:long}/schedule")]
    [PermissionModule("plans")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> GetSchedule(ulong id)
        => Ok(ApiResponse<object>.Ok(await service.GetScheduleAsync(id)));

    [HttpPut("plans/{id:long}/schedule")]
    [PermissionModule("plans")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> SaveSchedule(ulong id, [FromBody] PlanScheduleDto request)
        => Ok(ApiResponse<object>.Ok(await service.SaveScheduleAsync(id, request), "Plan schedule saved."));

    /// <summary>The signed-in member's assigned workouts and plans, with today's workout.</summary>
    [HttpGet("me/training")]
    [AuthorizeRoles(RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> MyTraining()
        => Ok(ApiResponse<object>.Ok(await service.GetMyAssignmentsAsync()));
}
