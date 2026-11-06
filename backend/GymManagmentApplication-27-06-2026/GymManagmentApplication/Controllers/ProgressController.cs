using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Health.Requests;
using GymManagmentApplication.Application.Health.Services;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;

namespace GymManagmentApplication.Controllers;

/// <summary>Body metrics over time and the progress-photo journal.</summary>
[ApiController]
[PermissionModule("stats")]
[Route("api/progress")]
[AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
public class ProgressController(ProgressService service) : ControllerBase
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
        => Ok(ApiResponse<object>.Ok(await service.AddJournalAsync(title, content, date, photo.ToUploadOrNull()), "Saved to your journal."));

    [HttpDelete("journal/{id:long}")]
    [AuthorizeRoles(RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> DeleteJournal(ulong id)
        => await service.DeleteJournalAsync(id)
            ? Ok(ApiResponse<object>.Ok((object)null!, "Deleted."))
            : NotFound(ApiResponse<object>.Fail("Entry not found."));
}
