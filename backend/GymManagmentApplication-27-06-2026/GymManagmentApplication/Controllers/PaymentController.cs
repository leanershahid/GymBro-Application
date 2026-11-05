using GymManagmentApplication.Application.Billing.Interfaces;
using GymManagmentApplication.Application.Billing.Requests;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;
using GymManagmentApplication.Domain.Constants;

namespace GymManagmentApplication.Controllers;

[ApiController]
[PermissionModule("payments")]
[Route("api/payments")]
[RequireModule("payments")]
[AuthorizeRoles(RoleNames.Admin)]
public class PaymentController(IPaymentService service) : ControllerBase
{
    /// <summary>Desk payment. Send an Idempotency-Key header (or body field) to make retries safe.</summary>
    [HttpPost("charge")]
    public async Task<ActionResult<ApiResponse<object>>> Charge([FromBody] ChargeRequest request,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey = null)
    {
        if (string.IsNullOrWhiteSpace(request.IdempotencyKey)) request.IdempotencyKey = idempotencyKey;
        return Ok(ApiResponse<object>.Ok(await service.ChargeAsync(request), "Payment recorded."));
    }

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
        [FromQuery] int? pageNumber = null,
        [FromQuery] int? pageSize = null,
        [FromQuery] int? page = null,
        [FromQuery] int? size = null)
        // ARCH-102: "page"/"size" are accepted as aliases of "pageNumber"/"pageSize".
        => Ok(ApiResponse<object>.Ok(
            await service.GetHistoryAsync(tenantId, memberId, pageNumber ?? page ?? 1, pageSize ?? size ?? 20)));

    /// <summary>Not implemented (ARCH-078): cards aren't stored; members pay through Razorpay Checkout.</summary>
    [HttpPost("methods")]
    public ActionResult<ApiResponse<object>> SaveMethod([FromBody] SavePaymentMethodRequest request)
        => StatusCode(StatusCodes.Status501NotImplemented,
            ApiResponse<object>.Fail(GymManagmentApplication.Application.Billing.Services.PaymentService.SavedMethodsNotSupported));

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

    [HttpPost("verify")]
    public async Task<ActionResult<ApiResponse<object>>> Verify([FromBody] VerifyOnlinePaymentRequest request)
        => Ok(ApiResponse<object>.Ok(await service.VerifyOnlineAsync(request), "Payment verified."));

    /// <summary>This gym's Razorpay connection (the secret is never returned).</summary>
    [HttpGet("gateway")]
    public async Task<ActionResult<ApiResponse<object>>> GetGateway()
        => Ok(ApiResponse<object>.Ok(await service.GetGatewayAsync()));

    [HttpPut("gateway")]
    public async Task<ActionResult<ApiResponse<object>>> SaveGateway([FromBody] SaveGatewayRequest request)
        => Ok(ApiResponse<object>.Ok(await service.SaveGatewayAsync(request), "Online payments settings saved."));

    [HttpDelete("gateway")]
    public async Task<ActionResult<ApiResponse<object>>> RemoveGateway()
        => Ok(ApiResponse<object>.Ok(await service.RemoveGatewayAsync(), "Online payments turned off."));

    [HttpPost("reminders")]
    public async Task<ActionResult<ApiResponse<object>>> SendReminder(
        [FromBody] PaymentReminderRequest request)
    {
        await service.SendReminderAsync(request);
        return Ok(ApiResponse<object>.Ok((object)null!, "Payment reminder sent."));
    }
}
