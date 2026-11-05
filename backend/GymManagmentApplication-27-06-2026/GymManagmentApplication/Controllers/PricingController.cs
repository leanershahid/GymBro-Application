using GymManagmentApplication.Application.Billing.Interfaces;
using GymManagmentApplication.Application.Billing.Requests;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;
using GymManagmentApplication.Domain.Constants;

namespace GymManagmentApplication.Controllers;

[ApiController]
[PermissionModule("billing")]
[Route("api/pricing")]
[RequireModule("billing")]
[AuthorizeRoles(RoleNames.Admin)]
public class PricingController(IPricingService service) : ControllerBase
{
    [HttpGet("rules")]
    public async Task<ActionResult<ApiResponse<object>>> GetRules([FromQuery] ulong tenantId = 0)
        => Ok(ApiResponse<object>.Ok(await service.GetRulesAsync(tenantId)));

    [HttpGet("rules/{id:long}")]
    public async Task<ActionResult<ApiResponse<object>>> GetRule(ulong id)
    {
        var result = await service.GetRuleAsync(id);
        return result is null ? NotFound(ApiResponse<object>.Fail("Rule not found.")) : Ok(ApiResponse<object>.Ok(result));
    }

    /// <summary>201 Created + Location (ARCH-101).</summary>
    [HttpPost("rules")]
    public async Task<ActionResult<ApiResponse<object>>> CreateRule(
        [FromBody] CreatePricingRuleRequest request)
    {
        var rule = await service.CreateRuleAsync(request);
        return CreatedAtAction(nameof(GetRule), new { id = rule.Id }, ApiResponse<object>.Ok(rule, "Pricing rule created."));
    }

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
    public async Task<ActionResult<ApiResponse<object>>> GetDiscounts([FromQuery] ulong tenantId = 0)
        => Ok(ApiResponse<object>.Ok(await service.GetDiscountsAsync(tenantId)));

    [HttpGet("discounts/{id:long}")]
    public async Task<ActionResult<ApiResponse<object>>> GetDiscount(ulong id)
    {
        var result = await service.GetDiscountAsync(id);
        return result is null ? NotFound(ApiResponse<object>.Fail("Discount code not found.")) : Ok(ApiResponse<object>.Ok(result));
    }

    /// <summary>201 Created + Location (ARCH-101).</summary>
    [HttpPost("discounts")]
    public async Task<ActionResult<ApiResponse<object>>> CreateDiscount(
        [FromBody] CreateDiscountRequest request)
    {
        var discount = await service.CreateDiscountAsync(request);
        return CreatedAtAction(nameof(GetDiscount), new { id = discount.Id }, ApiResponse<object>.Ok(discount, "Discount code created."));
    }

    [HttpPost("discounts/validate")]
    public async Task<ActionResult<ApiResponse<object>>> ValidateDiscount(
        [FromBody] ValidateDiscountRequest request)
        => Ok(ApiResponse<object>.Ok(await service.ValidateDiscountAsync(request)));
}
