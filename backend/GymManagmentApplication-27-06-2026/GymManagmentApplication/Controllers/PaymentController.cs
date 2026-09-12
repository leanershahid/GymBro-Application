using GymManagmentApplication.Application.Billing.Interfaces;
using GymManagmentApplication.Application.Billing.Requests;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;
using GymManagmentApplication.Domain.Constants;

namespace GymManagmentApplication.Controllers;

[ApiController]
[Route("api/payments")]
[AuthorizeRoles(RoleNames.Admin)]
public class PaymentController(IPaymentService service) : ControllerBase
{
    [HttpPost("charge")]
    public async Task<ActionResult<ApiResponse<object>>> Charge([FromBody] ChargeRequest request)
        => Ok(ApiResponse<object>.Ok(await service.ChargeAsync(request), "Payment processed."));

    [HttpGet("{id:long}")]
    public async Task<ActionResult<ApiResponse<object>>> GetById(ulong id)
    {
        var result = await service.GetByIdAsync(id);
        return result is null ? NotFound(ApiResponse<object>.Fail($"Payment {id} not found."))
            : Ok(ApiResponse<object>.Ok(result));
    }

    [HttpPost("refund")]
    public async Task<ActionResult<ApiResponse<object>>> Refund([FromBody] RefundRequest request)
    {
        var result = await service.RefundAsync(request);
        return result is null ? NotFound(ApiResponse<object>.Fail("Payment not found."))
            : Ok(ApiResponse<object>.Ok(result, "Refund processed."));
    }

    [HttpGet("history")]
    public async Task<ActionResult<ApiResponse<object>>> GetHistory(
        [FromQuery] ulong tenantId,
        [FromQuery] ulong? memberId,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 20)
        => Ok(ApiResponse<object>.Ok(
            await service.GetHistoryAsync(tenantId, memberId, pageNumber, pageSize)));

    [HttpPost("methods")]
    public async Task<ActionResult<ApiResponse<object>>> SaveMethod(
        [FromBody] SavePaymentMethodRequest request)
        => Ok(ApiResponse<object>.Ok(await service.SaveMethodAsync(request), "Payment method saved."));

    [HttpGet("methods")]
    public async Task<ActionResult<ApiResponse<object>>> GetMethods([FromQuery] ulong memberId)
        => Ok(ApiResponse<object>.Ok(await service.GetMethodsAsync(memberId)));

    [HttpDelete("methods/{methodId:long}")]
    public async Task<ActionResult<ApiResponse<object>>> RemoveMethod(ulong methodId)
    {
        var ok = await service.RemoveMethodAsync(methodId);
        return ok ? Ok(ApiResponse<object>.Ok((object)null!, "Payment method removed."))
            : NotFound(ApiResponse<object>.Fail("Payment method not found."));
    }

    [HttpPost("intent")]
    public async Task<ActionResult<ApiResponse<object>>> CreateIntent(
        [FromBody] CreatePaymentIntentRequest request)
        => Ok(ApiResponse<object>.Ok(await service.CreateIntentAsync(request)));

    [HttpPost("reminders")]
    public async Task<ActionResult<ApiResponse<object>>> SendReminder(
        [FromBody] PaymentReminderRequest request)
    {
        await service.SendReminderAsync(request);
        return Ok(ApiResponse<object>.Ok((object)null!, "Payment reminder sent."));
    }
}
