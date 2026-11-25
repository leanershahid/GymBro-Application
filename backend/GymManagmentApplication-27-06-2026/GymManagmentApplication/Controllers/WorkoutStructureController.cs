using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Training;
using GymManagmentApplication.Application.Workout;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;

namespace GymManagmentApplication.Controllers;

/// <summary>Workout contents and the old plan schedule endpoints (now on the plan builder model).</summary>
[ApiController]
[PermissionModule("workouts")]
// Absolute sub-routes under api/ (workouts/{id}/structure, …) — kept as-is for existing clients (ARCH-100).
[Route("api")]
public class WorkoutStructureController(WorkoutStructureService service, PlanBuilderService plans) : ControllerBase
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
        => Ok(ApiResponse<object>.Ok(await plans.GetScheduleAsync(id)));

    [HttpPut("plans/{id:long}/schedule")]
    [PermissionModule("plans")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> SaveSchedule(ulong id, [FromBody] PlanScheduleDto request)
        => Ok(ApiResponse<object>.Ok(await plans.SaveScheduleAsync(id, request), "Plan schedule saved."));
}
