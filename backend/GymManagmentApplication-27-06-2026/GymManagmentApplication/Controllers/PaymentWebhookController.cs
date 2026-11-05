using GymManagmentApplication.Application.Billing.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GymManagmentApplication.Controllers;

/// <summary>
/// Razorpay webhooks (ARCH-011). Each gym points its own Razorpay account at
/// POST /api/payments/webhooks/razorpay/{tenantId} and saves the webhook secret in the payment
/// settings; deliveries are authenticated by the X-Razorpay-Signature HMAC, not by a login.
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/payments/webhooks")]
public class PaymentWebhookController(IPaymentService service) : ControllerBase
{
    [HttpPost("razorpay/{tenantId:long}")]
    [RequestSizeLimit(256 * 1024)]
    public async Task<IActionResult> Razorpay(ulong tenantId, [FromHeader(Name = "X-Razorpay-Signature")] string? signature)
    {
        using var reader = new StreamReader(Request.Body);
        var body = await reader.ReadToEndAsync();
        return await service.HandleRazorpayWebhookAsync(tenantId, body, signature) ? Ok() : Unauthorized();
    }
}
