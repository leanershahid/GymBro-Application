using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Training;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;

namespace GymManagmentApplication.Controllers;

/// <summary>The signed-in member's training: today and this week, plan calendar, skip/move, history and records.</summary>
[ApiController]
[PermissionModule("workouts")]
[Route("api/me")]
[AuthorizeRoles(RoleNames.Client)]
public class MyTrainingController(MemberTrainingService service) : ControllerBase
{
    /// <summary>Assigned workouts and plans, with today's workout, this week's strip and adherence.</summary>
    [HttpGet("training")]
    public async Task<ActionResult<ApiResponse<object>>> MyTraining()
        => Ok(ApiResponse<object>.Ok(await service.GetMyTrainingAsync()));

    [HttpGet("plans/{assignmentId:long}/calendar")]
    public async Task<ActionResult<ApiResponse<object>>> Calendar(ulong assignmentId, [FromQuery] DateOnly? from, [FromQuery] DateOnly? to)
        => Ok(ApiResponse<object>.Ok(await service.GetCalendarAsync(assignmentId, from, to)));

    [HttpPost("plans/{assignmentId:long}/days/skip")]
    public async Task<ActionResult<ApiResponse<object>>> Skip(ulong assignmentId, [FromBody] DayOverrideRequest request)
        => Ok(ApiResponse<object>.Ok(await service.SkipAsync(assignmentId, request), "Day skipped."));

    [HttpPost("plans/{assignmentId:long}/days/move")]
    public async Task<ActionResult<ApiResponse<object>>> Move(ulong assignmentId, [FromBody] DayOverrideRequest request)
        => Ok(ApiResponse<object>.Ok(await service.MoveAsync(assignmentId, request), "Day moved."));

    [HttpDelete("plans/{assignmentId:long}/days/{date}/override")]
    public async Task<ActionResult<ApiResponse<object>>> ClearOverride(ulong assignmentId, DateOnly date)
    {
        var ok = await service.ClearOverrideAsync(assignmentId, date);
        return ok ? Ok(ApiResponse<object>.Ok((object)null!, "Change undone.")) : NotFound(ApiResponse<object>.Fail("Nothing to undo on that date."));
    }

    /// <summary>Previous performance of one exercise (null data when never done).</summary>
    [HttpGet("exercises/{exerciseId:long}/last")]
    public async Task<ActionResult<ApiResponse<object>>> Last(ulong exerciseId)
        => Ok(ApiResponse<object>.Ok((await service.GetLastAsync(exerciseId))!));

    /// <summary>Previous performance of several exercises: ?ids=1,2,3 (max 50).</summary>
    [HttpGet("exercises/last")]
    public async Task<ActionResult<ApiResponse<object>>> LastMany([FromQuery] string ids)
    {
        var parsed = (ids ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(s => ulong.TryParse(s, out var v) ? v : 0).Where(v => v > 0).ToList();
        if (parsed.Count == 0) return BadRequest(ApiResponse<object>.Fail("Send ids=1,2,3."));
        return Ok(ApiResponse<object>.Ok(await service.GetLastManyAsync(parsed)));
    }

    [HttpGet("records")]
    public async Task<ActionResult<ApiResponse<object>>> Records([FromQuery] ulong? exerciseId)
        => Ok(ApiResponse<object>.Ok(await service.GetRecordsAsync(exerciseId)));

    [HttpGet("workout-history")]
    public async Task<ActionResult<ApiResponse<object>>> History([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        => Ok(ApiResponse<object>.Ok(await service.GetHistoryAsync(page, pageSize)));

    [HttpGet("workout-history/{logId:long}")]
    public async Task<ActionResult<ApiResponse<object>>> HistoryItem(ulong logId)
        => Ok(ApiResponse<object>.Ok(await service.GetHistoryItemAsync(logId)));
}
