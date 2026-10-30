using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Engagement;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;

namespace GymManagmentApplication.Controllers;

/// <summary>In-app notifications for the signed-in user.</summary>
[ApiController]
[Route("api/notifications")]
[AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
public class NotificationsController(Notifier notifier) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<object>>> Mine([FromQuery] bool unreadOnly = false)
        => Ok(ApiResponse<object>.Ok(new { items = await notifier.GetMineAsync(unreadOnly), unread = await notifier.UnreadCountAsync() }));

    [HttpPut("{id:long}/read")]
    public async Task<ActionResult<ApiResponse<object>>> Read(ulong id)
        => Ok(ApiResponse<object>.Ok(new { updated = await notifier.MarkReadAsync(id) }));

    [HttpPut("read-all")]
    public async Task<ActionResult<ApiResponse<object>>> ReadAll()
        => Ok(ApiResponse<object>.Ok(new { updated = await notifier.MarkReadAsync(null) }));
}

/// <summary>Challenge participation (join/leave/progress/leaderboard) and admin edits.</summary>
[ApiController]
[PermissionModule("gamification")]
[Route("api/challenges")]
[RequireModule("challenges")]
public class ChallengeParticipationController(EngagementService service) : ControllerBase
{
    [HttpGet("{id:long}")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> Get(ulong id)
        => Ok(ApiResponse<object>.Ok(await service.GetChallengeAsync(id)));

    [HttpPut("{id:long}")]
    [AuthorizeRoles(RoleNames.Admin)]
    public async Task<ActionResult<ApiResponse<object>>> Update(ulong id, [FromBody] UpdateChallengeRequest request)
        => Ok(ApiResponse<object>.Ok(await service.UpdateChallengeAsync(id, request), "Challenge saved."));

    [HttpPost("{id:long}/join")]
    [AuthorizeRoles(RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> Join(ulong id)
        => Ok(ApiResponse<object>.Ok(await service.JoinAsync(id), "You joined the challenge."));

    [HttpDelete("{id:long}/join")]
    [AuthorizeRoles(RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> Leave(ulong id)
        => Ok(ApiResponse<object>.Ok(await service.LeaveAsync(id), "You left the challenge."));

    [HttpPost("{id:long}/progress")]
    [AuthorizeRoles(RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> Progress(ulong id, [FromBody] ChallengeProgressRequest request)
        => Ok(ApiResponse<object>.Ok(await service.LogProgressAsync(id, request), "Progress logged."));
}

/// <summary>Body metrics over time and the progress-photo journal.</summary>
[ApiController]
[PermissionModule("stats")]
[Route("api/progress")]
[AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
public class ProgressController(EngagementService service) : ControllerBase
{
    /// <summary>Members: their own; trainers/staff pass clientId.</summary>
    [HttpGet("metrics")]
    public async Task<ActionResult<ApiResponse<object>>> Metrics([FromQuery] ulong? clientId, [FromQuery] int days = 90)
        => Ok(ApiResponse<object>.Ok(await service.GetMetricsAsync(clientId, days)));

    [HttpPost("metrics")]
    [AuthorizeRoles(RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> LogMetric([FromBody] BodyMetricRequest request)
        => Ok(ApiResponse<object>.Ok(await service.LogMetricAsync(request), "Saved."));

    [HttpGet("journal")]
    public async Task<ActionResult<ApiResponse<object>>> Journal([FromQuery] ulong? clientId)
        => Ok(ApiResponse<object>.Ok(await service.GetJournalAsync(clientId)));

    /// <summary>multipart/form-data: photo (optional image), title, content, date (YYYY-MM-DD).</summary>
    [HttpPost("journal")]
    [AuthorizeRoles(RoleNames.Client)]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<ActionResult<ApiResponse<object>>> AddJournal([FromForm] string? title, [FromForm] string? content,
        [FromForm] DateOnly? date, IFormFile? photo)
        => Ok(ApiResponse<object>.Ok(await service.AddJournalAsync(title, content, date, photo), "Saved to your journal."));

    [HttpDelete("journal/{id:long}")]
    [AuthorizeRoles(RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> DeleteJournal(ulong id)
        => await service.DeleteJournalAsync(id)
            ? Ok(ApiResponse<object>.Ok((object)null!, "Deleted."))
            : NotFound(ApiResponse<object>.Fail("Entry not found."));
}
