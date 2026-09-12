using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.WorkoutBuilder.Interfaces;
using GymManagmentApplication.Application.WorkoutBuilder.Requests;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;
using GymManagmentApplication.Domain.Constants;

namespace GymManagmentApplication.Controllers;

[ApiController]
[Route("api/workouts")]
[AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
public class WorkoutBuilderController(IWorkoutBuilderService service) : ControllerBase
{
    [HttpPost("{id:long}/circuits")]
    public async Task<ActionResult<ApiResponse<object>>> AddCircuit(ulong id, [FromBody] AddCircuitRequest request)
        => Ok(ApiResponse<object>.Ok(await service.AddCircuitAsync(id, request), "Circuit added."));

    [HttpPut("{id:long}/circuits/{cid:long}")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateCircuit(ulong id, ulong cid, [FromBody] UpdateCircuitRequest request)
    {
        var result = await service.UpdateCircuitAsync(id, cid, request);
        return result is null ? NotFound(ApiResponse<object>.Fail("Circuit not found.")) : Ok(ApiResponse<object>.Ok(result, "Circuit updated."));
    }

    [HttpPost("{id:long}/supersets")]
    public async Task<ActionResult<ApiResponse<object>>> AddSuperset(ulong id, [FromBody] AddSupersetRequest request)
        => Ok(ApiResponse<object>.Ok(await service.AddSupersetAsync(id, request), "Superset added."));

    [HttpPost("{id:long}/dropsets")]
    public async Task<ActionResult<ApiResponse<object>>> AddDropset(ulong id, [FromBody] AddDropsetRequest request)
        => Ok(ApiResponse<object>.Ok(await service.AddDropsetAsync(id, request), "Dropset added."));

    [HttpPost("{id:long}/pyramids")]
    public async Task<ActionResult<ApiResponse<object>>> AddPyramid(ulong id, [FromBody] AddPyramidRequest request)
        => Ok(ApiResponse<object>.Ok(await service.AddPyramidAsync(id, request), "Pyramid added."));

    [HttpPut("{id:long}/tempo")]
    public async Task<ActionResult<ApiResponse<object>>> SetTempo(ulong id, [FromBody] SetTempoRequest request)
        => Ok(ApiResponse<object>.Ok(await service.SetTempoAsync(id, request), "Tempo configured."));

    [HttpPut("{id:long}/rest-intervals")]
    public async Task<ActionResult<ApiResponse<object>>> SetRestIntervals(ulong id, [FromBody] SetRestIntervalsRequest request)
        => Ok(ApiResponse<object>.Ok(await service.SetRestIntervalsAsync(id, request), "Rest intervals configured."));

    [HttpPost("{id:long}/timer")]
    public async Task<ActionResult<ApiResponse<object>>> ConfigureTimer(ulong id, [FromBody] ConfigureTimerRequest request)
        => Ok(ApiResponse<object>.Ok(await service.ConfigureTimerAsync(id, request), "Timer configured."));

    [HttpPut("{id:long}/difficulty")]
    public async Task<ActionResult<ApiResponse<object>>> SetDifficulty(ulong id, [FromBody] SetDifficultyRequest request)
        => Ok(ApiResponse<object>.Ok(await service.SetDifficultyAsync(id, request), "Difficulty configured."));
}
