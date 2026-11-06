using System.Security.Claims;
using FluentValidation;
using GymManagmentApplication.Application.Challenges.Interfaces;
using GymManagmentApplication.Application.Challenges.Requests;
using GymManagmentApplication.Application.Challenges.Services;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;
using GymManagmentApplication.Domain.Constants;

namespace GymManagmentApplication.Controllers;

[ApiController]
[PermissionModule("challenges")] // same key as RequireModule (admin.challenges grants both "challenges" and "gamification")
[Route("api/challenges")]
[RequireModule("challenges")]
/// <summary>
/// Every api/challenges endpoint (ARCH-077: the participation endpoints used to be a second
/// controller on the same prefix): listing/creation/status via <see cref="IChallengesService"/>,
/// detail/join/leave/progress and admin edits via <see cref="ChallengeParticipationService"/>.
/// </summary>
public class ChallengesController(
    IChallengesService service,
    ChallengeParticipationService participation,
    IValidator<CreateChallengeRequest> createValidator) : ControllerBase
{
    private ulong UserId => ulong.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");

    [HttpGet("active")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> GetActive()
        => Ok(ApiResponse<object>.Ok(await service.GetActiveAsync(UserId)));

    /// <summary>All challenges regardless of status, for the admin management view.</summary>
    [HttpGet]
    [AuthorizeRoles(RoleNames.Admin)]
    public async Task<ActionResult<ApiResponse<object>>> GetAll()
        => Ok(ApiResponse<object>.Ok(await service.GetAllAsync()));

    [HttpPost]
    [AuthorizeRoles(RoleNames.Admin)]
    public async Task<ActionResult<ApiResponse<object>>> Create([FromBody] CreateChallengeRequest request)
    {
        var v = await createValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));

        var result = await service.CreateAsync(request);
        return Ok(ApiResponse<object>.Ok(result, "Challenge created."));
    }

    [HttpPut("{id}/status")]
    [AuthorizeRoles(RoleNames.Admin)]
    public async Task<ActionResult<ApiResponse<object>>> SetStatus(ulong id, [FromBody] UpdateChallengeStatusRequest request)
    {
        var result = await service.SetStatusAsync(id, request);
        return result is null
            ? NotFound(ApiResponse<object>.Fail($"Challenge {id} not found."))
            : Ok(ApiResponse<object>.Ok(result, "Challenge status updated."));
    }

    // ── Participation (detail, join/leave, progress) and admin edits ──────

    [HttpGet("{id:long}")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> Get(ulong id)
        => Ok(ApiResponse<object>.Ok(await participation.GetChallengeAsync(id)));

    [HttpPut("{id:long}")]
    [AuthorizeRoles(RoleNames.Admin)]
    public async Task<ActionResult<ApiResponse<object>>> Update(ulong id, [FromBody] UpdateChallengeRequest request)
        => Ok(ApiResponse<object>.Ok(await participation.UpdateChallengeAsync(id, request), "Challenge saved."));

    [HttpPost("{id:long}/join")]
    [AuthorizeRoles(RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> Join(ulong id)
        => Ok(ApiResponse<object>.Ok(await participation.JoinAsync(id), "You joined the challenge."));

    [HttpDelete("{id:long}/join")]
    [AuthorizeRoles(RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> Leave(ulong id)
        => Ok(ApiResponse<object>.Ok(await participation.LeaveAsync(id), "You left the challenge."));

    [HttpPost("{id:long}/progress")]
    [AuthorizeRoles(RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> Progress(ulong id, [FromBody] ChallengeProgressRequest request)
        => Ok(ApiResponse<object>.Ok(await participation.LogProgressAsync(id, request), "Progress logged."));
}
