using GymManagmentApplication.Application.Billing.Interfaces;
using GymManagmentApplication.Application.Billing.Requests;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;
using GymManagmentApplication.Domain.Constants;

namespace GymManagmentApplication.Controllers;

[ApiController]
[Route("api/pricing")]
[AuthorizeRoles(RoleNames.Admin)]
public class PricingController(IPricingService service) : ControllerBase
{
    [HttpGet("rules")]
    public async Task<ActionResult<ApiResponse<object>>> GetRules([FromQuery] ulong tenantId)
        => Ok(ApiResponse<object>.Ok(await service.GetRulesAsync(tenantId)));

    [HttpPost("rules")]
    public async Task<ActionResult<ApiResponse<object>>> CreateRule(
        [FromBody] CreatePricingRuleRequest request)
        => Ok(ApiResponse<object>.Ok(await service.CreateRuleAsync(request), "Pricing rule created."));

    [HttpPut("rules/{id:long}")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateRule(ulong id,
        [FromBody] UpdatePricingRuleRequest request)
    {
        var result = await service.UpdateRuleAsync(id, request);
        return result is null ? NotFound(ApiResponse<object>.Fail("Rule not found."))
            : Ok(ApiResponse<object>.Ok(result, "Rule updated."));
    }

    [HttpDelete("rules/{id:long}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteRule(ulong id)
    {
        var ok = await service.DeleteRuleAsync(id);
        return ok ? Ok(ApiResponse<object>.Ok((object)null!, "Rule deleted."))
            : NotFound(ApiResponse<object>.Fail("Rule not found."));
    }

    [HttpGet("calculate")]
    public async Task<ActionResult<ApiResponse<object>>> Calculate(
        [FromQuery] ulong tenantId,
        [FromQuery] ulong planId,
        [FromQuery] ulong? memberId,
        [FromQuery] string? discountCode)
        => Ok(ApiResponse<object>.Ok(await service.CalculateAsync(new CalculatePriceRequest
        {
            TenantId = tenantId, PlanId = planId,
            MemberId = memberId, DiscountCode = discountCode
        })));

    [HttpGet("discounts")]
    public async Task<ActionResult<ApiResponse<object>>> GetDiscounts([FromQuery] ulong tenantId)
        => Ok(ApiResponse<object>.Ok(await service.GetDiscountsAsync(tenantId)));

    [HttpPost("discounts")]
    public async Task<ActionResult<ApiResponse<object>>> CreateDiscount(
        [FromBody] CreateDiscountRequest request)
        => Ok(ApiResponse<object>.Ok(await service.CreateDiscountAsync(request), "Discount code created."));

    [HttpPost("discounts/validate")]
    public async Task<ActionResult<ApiResponse<object>>> ValidateDiscount(
        [FromBody] ValidateDiscountRequest request)
        => Ok(ApiResponse<object>.Ok(await service.ValidateDiscountAsync(request)));
}
