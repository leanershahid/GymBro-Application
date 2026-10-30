using GymManagmentApplication.Application.Billing.Interfaces;
using GymManagmentApplication.Application.Billing.Requests;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;

namespace GymManagmentApplication.Controllers;

/// <summary>Member app: the signed-in member's own memberships, invoices and payments.</summary>
[ApiController]
[Route("api/me/billing")]
[RequireModule("billing")]
[AuthorizeRoles(RoleNames.Client)]
public class MyBillingController(IMyBillingService service) : ControllerBase
{
    [HttpGet("memberships")]
    public async Task<ActionResult<ApiResponse<object>>> Memberships()
        => Ok(ApiResponse<object>.Ok(await service.GetMyMembershipsAsync()));

    [HttpGet("invoices")]
    public async Task<ActionResult<ApiResponse<object>>> Invoices()
        => Ok(ApiResponse<object>.Ok(await service.GetMyInvoicesAsync()));

    [HttpGet("payments")]
    public async Task<ActionResult<ApiResponse<object>>> Payments()
        => Ok(ApiResponse<object>.Ok(await service.GetMyPaymentsAsync()));

    [HttpGet("invoices/{id:long}/pdf")]
    public async Task<IActionResult> InvoicePdf(ulong id)
    {
        var pdf = await service.GetMyInvoicePdfAsync(id);
        return pdf is null ? NotFound(ApiResponse<object>.Fail("Invoice not found.")) : File(pdf, "application/pdf", $"invoice-{id}.pdf");
    }

    [HttpGet("online-payments")]
    public async Task<ActionResult<ApiResponse<object>>> OnlinePayments()
        => Ok(ApiResponse<object>.Ok(new { enabled = await service.OnlinePaymentsEnabledAsync() }));

    /// <summary>Starts paying an invoice online: returns the Razorpay order for Checkout.</summary>
    [HttpPost("invoices/{id:long}/pay")]
    public async Task<ActionResult<ApiResponse<object>>> Pay(ulong id)
        => Ok(ApiResponse<object>.Ok(await service.StartOnlinePaymentAsync(id)));

    [HttpPost("payments/verify")]
    public async Task<ActionResult<ApiResponse<object>>> Verify([FromBody] VerifyOnlinePaymentRequest request)
        => Ok(ApiResponse<object>.Ok(await service.VerifyOnlinePaymentAsync(request), "Payment received. Thank you!"));
}
