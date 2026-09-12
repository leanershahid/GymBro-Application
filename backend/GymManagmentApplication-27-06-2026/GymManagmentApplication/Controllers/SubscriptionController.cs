using GymManagmentApplication.Application.Billing.Interfaces;
using GymManagmentApplication.Application.Billing.Requests;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;
using GymManagmentApplication.Domain.Constants;

namespace GymManagmentApplication.Controllers;

[ApiController]
[Route("api/subscriptions")]
[AuthorizeRoles(RoleNames.Admin)]
public class SubscriptionController(ISubscriptionService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<object>>> GetAll(
        [FromQuery] ulong tenantId,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 20)
        => Ok(ApiResponse<object>.Ok(await service.GetAllAsync(tenantId, pageNumber, pageSize)));

    [HttpPost]
    public async Task<ActionResult<ApiResponse<object>>> Create(
        [FromBody] CreateSubscriptionRequest request)
    {
        var result = await service.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = result.Id },
            ApiResponse<object>.Ok(result, "Subscription created."));
    }

    [HttpGet("{id:long}")]
    public async Task<ActionResult<ApiResponse<object>>> GetById(ulong id)
    {
        var result = await service.GetByIdAsync(id);
        return result is null ? NotFound(ApiResponse<object>.Fail($"Subscription {id} not found."))
            : Ok(ApiResponse<object>.Ok(result));
    }

    [HttpPut("{id:long}/renew")]
    public async Task<ActionResult<ApiResponse<object>>> Renew(ulong id)
    {
        var result = await service.RenewAsync(id);
        return result is null ? NotFound(ApiResponse<object>.Fail($"Subscription {id} not found."))
            : Ok(ApiResponse<object>.Ok(result, "Subscription renewed."));
    }

    [HttpPost("{id:long}/upgrade")]
    public async Task<ActionResult<ApiResponse<object>>> Upgrade(ulong id,
        [FromBody] UpgradeDowngradeRequest request)
    {
        var result = await service.UpgradeAsync(id, request);
        return result is null ? NotFound(ApiResponse<object>.Fail($"Subscription {id} not found."))
            : Ok(ApiResponse<object>.Ok(result, "Subscription upgraded."));
    }

    [HttpPost("{id:long}/downgrade")]
    public async Task<ActionResult<ApiResponse<object>>> Downgrade(ulong id,
        [FromBody] UpgradeDowngradeRequest request)
    {
        var result = await service.DowngradeAsync(id, request);
        return result is null ? NotFound(ApiResponse<object>.Fail($"Subscription {id} not found."))
            : Ok(ApiResponse<object>.Ok(result, "Subscription downgraded."));
    }

    [HttpPost("{id:long}/freeze")]
    public async Task<ActionResult<ApiResponse<object>>> Freeze(ulong id,
        [FromBody] FreezeSubscriptionRequest request)
    {
        var result = await service.FreezeAsync(id, request);
        return result is null ? NotFound(ApiResponse<object>.Fail($"Subscription {id} not found."))
            : Ok(ApiResponse<object>.Ok(result, "Subscription frozen."));
    }

    [HttpPost("{id:long}/unfreeze")]
    public async Task<ActionResult<ApiResponse<object>>> Unfreeze(ulong id)
    {
        var result = await service.UnfreezeAsync(id);
        return result is null ? NotFound(ApiResponse<object>.Fail($"Subscription {id} not found."))
            : Ok(ApiResponse<object>.Ok(result, "Subscription reactivated."));
    }

    [HttpDelete("{id:long}/cancel")]
    public async Task<ActionResult<ApiResponse<object>>> Cancel(ulong id)
    {
        var ok = await service.CancelAsync(id);
        return ok ? Ok(ApiResponse<object>.Ok((object)null!, "Subscription cancelled."))
            : NotFound(ApiResponse<object>.Fail($"Subscription {id} not found."));
    }

    [HttpGet("{id:long}/usage")]
    public async Task<ActionResult<ApiResponse<object>>> GetUsage(ulong id)
    {
        var result = await service.GetUsageAsync(id);
        return result is null ? NotFound(ApiResponse<object>.Fail($"Subscription {id} not found."))
            : Ok(ApiResponse<object>.Ok(result));
    }
}
