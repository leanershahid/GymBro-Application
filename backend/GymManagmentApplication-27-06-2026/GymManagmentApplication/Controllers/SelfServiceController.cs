using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.SelfService;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;

namespace GymManagmentApplication.Controllers;

/// <summary>
/// Member self-service (roadmap feature 4): browse plans, join and pay, and ask to pause, cancel or
/// change plan. Always the signed-in member's own data; gated like the member billing screens.
/// </summary>
[ApiController]
[Route("api/me")]
[RequireModule("billing")]
[AuthorizeRoles(RoleNames.Client)]
public class MySelfServiceController(SelfServicePlansService plans, MembershipRequestService requests) : ControllerBase
{
    /// <summary>The gym's public, active plans (comparison cards) + the rules shown with them.</summary>
    [HttpGet("plans")]
    public async Task<ActionResult<ApiResponse<object>>> Plans()
        => Ok(ApiResponse<object>.Ok(await plans.GetCatalogAsync()));

    /// <summary>Server price for joining: plan + joining fee − coupon + tax, start/end dates, safety steps still open.</summary>
    [HttpPost("memberships/quote")]
    public async Task<ActionResult<ApiResponse<object>>> Quote([FromBody] JoinQuoteRequest request)
        => Ok(ApiResponse<object>.Ok(await plans.QuoteAsync(request)));

    /// <summary>
    /// Creates a Pending membership + invoice (records the terms consent) and returns the Razorpay
    /// order, or payAtDesk when the gym has no online gateway. Repeating it reuses the unpaid checkout.
    /// </summary>
    [HttpPost("memberships/checkout")]
    public async Task<ActionResult<ApiResponse<object>>> Checkout([FromBody] CheckoutRequest request)
        => Ok(ApiResponse<object>.Ok(await plans.CheckoutAsync(request, HttpContext.Connection.RemoteIpAddress?.ToString())));

    /// <summary>My membership: current plan, rules, pause days left, what cancelling means, open requests.</summary>
    [HttpGet("membership")]
    public async Task<ActionResult<ApiResponse<object>>> MyMembership()
        => Ok(ApiResponse<object>.Ok(await requests.GetMyMembershipAsync()));

    [HttpGet("membership-requests")]
    public async Task<ActionResult<ApiResponse<object>>> MyRequests()
        => Ok(ApiResponse<object>.Ok(await requests.GetMineAsync()));

    [HttpGet("membership-requests/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> MyRequest(ulong id)
        => Ok(ApiResponse<object>.Ok(await requests.GetMineAsync(id)));

    /// <summary>What a pause / cancel / plan change would do (dates, fees, plain-language summary). Saves nothing.</summary>
    [HttpPost("membership-requests/preview")]
    public async Task<ActionResult<ApiResponse<object>>> Preview([FromBody] CreateMembershipRequestRequest request)
        => Ok(ApiResponse<object>.Ok(await requests.PreviewAsync(request)));

    [HttpPost("membership-requests")]
    public async Task<ActionResult<ApiResponse<object>>> Create([FromBody] CreateMembershipRequestRequest request)
    {
        var r = await requests.CreateAsync(request);
        return Ok(ApiResponse<object>.Ok(r, r.Status == "approved" ? "Done. Your request is approved." : "Request sent. The gym will get back to you."));
    }

    [HttpPost("membership-requests/{id}/withdraw")]
    public async Task<ActionResult<ApiResponse<object>>> Withdraw(ulong id)
        => Ok(ApiResponse<object>.Ok(await requests.WithdrawAsync(id), "Request withdrawn."));
}

/// <summary>Staff queue of members' pause / cancel / plan-change requests, and the gym's membership rules.</summary>
[ApiController]
[Route("api/membership-requests")]
[AuthorizeRoles(RoleNames.Admin)]
[PermissionModule("membership-requests")]
[RequireModule("membership-requests")]
public class MembershipRequestsController(MembershipRequestService service) : ControllerBase
{
    /// <summary>status: pending (default) | decided | all | approved | rejected | withdrawn; type: freeze | cancel | change.</summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<object>>> List([FromQuery] string? status, [FromQuery] string? type,
        [FromQuery] ulong? memberId, [FromQuery] int page = 1, [FromQuery] int size = 20)
        => Ok(ApiResponse<object>.Ok(await service.ListAsync(status, type, memberId, page, size)));

    /// <summary>Badge count for the menu.</summary>
    [HttpGet("count")]
    public async Task<ActionResult<ApiResponse<object>>> Count()
        => Ok(ApiResponse<object>.Ok(new { pending = await service.CountPendingAsync() }));

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<object>>> Get(ulong id)
        => Ok(ApiResponse<object>.Ok(await service.GetAsync(id)));

    [HttpPost("{id}/approve")]
    public async Task<ActionResult<ApiResponse<object>>> Approve(ulong id, [FromBody] DecideMembershipRequestRequest? request)
        => Ok(ApiResponse<object>.Ok(await service.ApproveAsync(id, request ?? new()), "Approved."));

    [HttpPost("{id}/reject")]
    public async Task<ActionResult<ApiResponse<object>>> Reject(ulong id, [FromBody] DecideMembershipRequestRequest request)
        => Ok(ApiResponse<object>.Ok(await service.RejectAsync(id, request), "Rejected."));

    /// <summary>The gym's membership rules (TenantSettings "membership-rules").</summary>
    [HttpGet("settings")]
    public async Task<ActionResult<ApiResponse<object>>> Settings()
        => Ok(ApiResponse<object>.Ok(await service.GetRulesAsync()));

    [HttpPut("settings")]
    public async Task<ActionResult<ApiResponse<object>>> SaveSettings([FromBody] MembershipRulesSettings request)
        => Ok(ApiResponse<object>.Ok(await service.SaveRulesAsync(request), "Rules saved."));
}
