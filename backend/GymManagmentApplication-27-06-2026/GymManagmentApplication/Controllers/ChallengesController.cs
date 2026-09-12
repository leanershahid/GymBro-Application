using System.Security.Claims;
using FluentValidation;
using GymManagmentApplication.Application.Challenges.Interfaces;
using GymManagmentApplication.Application.Challenges.Requests;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;
using GymManagmentApplication.Domain.Constants;

namespace GymManagmentApplication.Controllers;

[ApiController]
[Route("api/challenges")]
[RequireModule("challenges")]
public class ChallengesController(
    IChallengesService service,
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
}
