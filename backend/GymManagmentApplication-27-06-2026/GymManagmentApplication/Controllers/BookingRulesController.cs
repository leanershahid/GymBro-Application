using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Safety;
using GymManagmentApplication.Application.Scheduling;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;

namespace GymManagmentApplication.Controllers;

/// <summary>
/// Cancellation and no-show rules (classes + PT). Staff endpoints belong to the <c>classes</c>
/// module (settings / waive / lift need edit). The member's own endpoints (policy, standing) only
/// return the caller's data and the gym's public rules, so they aren't module-gated: a member with
/// only the PT tab still sees them.
/// </summary>
[ApiController]
[PermissionModule("classes")]
[Route("api/booking-rules")]
public class BookingRulesController(BookingRulesService service) : ControllerBase
{
    private RequestMeta Meta => new(HttpContext.Connection.RemoteIpAddress?.ToString(), Request.Headers.UserAgent.ToString());

    // ── Members (and anyone signed in) ───────────────────────────────────────

    /// <summary>Cut-offs and consequences to show before booking / cancelling.</summary>
    [HttpGet("policy")]
    [AuthorizeRoles]
    public async Task<ActionResult<ApiResponse<object>>> Policy()
        => Ok(ApiResponse<object>.Ok(await service.GetPolicyAsync()));

    /// <summary>My strikes in the window, active block and recent penalties.</summary>
    [HttpGet("me")]
    [AuthorizeRoles(RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> Mine()
        => Ok(ApiResponse<object>.Ok(await service.GetMyStandingAsync()));

    // ── Staff ───────────────────────────────────────────────────────────────

    [HttpGet("settings")]
    [AuthorizeRoles(RoleNames.Admin)]
    [RequireModule("classes")]
    public async Task<ActionResult<ApiResponse<object>>> Settings()
        => Ok(ApiResponse<object>.Ok(await service.GetSettingsAsync()));

    [HttpPut("settings")]
    [AuthorizeRoles(RoleNames.Admin)]
    [RequireModule("classes")]
    public async Task<ActionResult<ApiResponse<object>>> SaveSettings([FromBody] BookingRulesSettings request)
        => Ok(ApiResponse<object>.Ok(await service.SaveSettingsAsync(request, Meta), "Booking rules saved."));

    /// <summary>Penalties for a class roster, a PT session or a member (one filter required).</summary>
    [HttpGet("penalties")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    [RequireModule("classes")]
    public async Task<ActionResult<ApiResponse<object>>> Penalties([FromQuery] ulong? classId, [FromQuery] ulong? ptSessionId, [FromQuery] ulong? memberId)
        => Ok(ApiResponse<object>.Ok(await service.GetPenaltiesAsync(classId, ptSessionId, memberId)));

    /// <summary>Member detail: strikes, active block, recent penalties.</summary>
    [HttpGet("members/{memberId:long}")]
    [AuthorizeRoles(RoleNames.Admin)]
    [RequireModule("classes")]
    public async Task<ActionResult<ApiResponse<object>>> Member(ulong memberId)
        => Ok(ApiResponse<object>.Ok(await service.GetMemberStandingAsync(memberId)));

    /// <summary>Waive (reason required, audit-logged); voids the fee invoice when it is unpaid.</summary>
    [HttpPut("penalties/{id:long}/waive")]
    [AuthorizeRoles(RoleNames.Admin)]
    [RequireModule("classes")]
    public async Task<ActionResult<ApiResponse<object>>> Waive(ulong id, [FromBody] WaivePenaltyRequest request)
    {
        var result = await service.WaiveAsync(id, request, Meta);
        return Ok(ApiResponse<object>.Ok(result, result.FeeVoided ? "Penalty waived; the fee invoice was voided." : "Penalty waived."));
    }

    [HttpPut("blocks/{id:long}/lift")]
    [AuthorizeRoles(RoleNames.Admin)]
    [RequireModule("classes")]
    public async Task<ActionResult<ApiResponse<object>>> Lift(ulong id, [FromBody] LiftBlockRequest request)
        => Ok(ApiResponse<object>.Ok(await service.LiftBlockAsync(id, request, Meta), "Booking block lifted."));
}
