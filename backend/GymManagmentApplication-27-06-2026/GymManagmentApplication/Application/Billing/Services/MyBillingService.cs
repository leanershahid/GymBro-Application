using GymManagmentApplication.Application.Billing.Interfaces;
using GymManagmentApplication.Application.Billing.Requests;
using GymManagmentApplication.Application.Billing.Responses;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Billing;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Billing.Services;

/// <summary>The signed-in member's memberships, invoices and payments — always scoped to themself.</summary>
public class MyBillingService(AppDbContext db, ICurrentUser currentUser, PaymentService payments) : IMyBillingService
{
    private ulong Me => currentUser.UserId ?? throw new UnauthorizedAccessException("Please sign in again.");

    public async Task<List<SubscriptionResponse>> GetMyMembershipsAsync()
    {
        var rows = await db.GymMemberships.Include(m => m.Plan).Include(m => m.User)
            .Where(m => m.UserId == Me).OrderByDescending(m => m.StartsAt).Take(50).ToListAsync();
        return rows.Select(SubscriptionService.Map).ToList();
    }

    public async Task<List<InvoiceResponse>> GetMyInvoicesAsync()
    {
        var rows = await db.Invoices.Include(i => i.User)
            .Where(i => i.UserId == Me).OrderByDescending(i => i.CreatedAt).Take(100).ToListAsync();
        return rows.Select(InvoiceService.Map).ToList();
    }

    public async Task<List<PaymentResponse>> GetMyPaymentsAsync()
    {
        var rows = await db.Payments.Include(p => p.Invoice).ThenInclude(i => i.User)
            .Where(p => p.Invoice.UserId == Me).OrderByDescending(p => p.CreatedAt).Take(100).ToListAsync();
        return rows.Select(p => PaymentService.Map(p, p.Invoice)).ToList();
    }

    public async Task<byte[]?> GetMyInvoicePdfAsync(ulong invoiceId)
    {
        var inv = await db.Invoices.Include(i => i.Tenant).Include(i => i.User)
            .FirstOrDefaultAsync(i => i.Id == invoiceId && i.UserId == Me);
        return inv is null ? null : InvoiceService.BuildPdf(inv);
    }

    public async Task<OnlineOrderResponse> StartOnlinePaymentAsync(ulong invoiceId) =>
        await payments.CreateOrderAsync(await MyInvoiceAsync(invoiceId));

    public async Task<PaymentResponse> VerifyOnlinePaymentAsync(VerifyOnlinePaymentRequest request) =>
        await payments.RecordVerifiedAsync(await MyInvoiceAsync(request.InvoiceId), request);

    public async Task<bool> OnlinePaymentsEnabledAsync() =>
        await payments.ActiveGatewayAsync(currentUser.ResolveTenantId()) is not null;

    private async Task<Invoice> MyInvoiceAsync(ulong invoiceId) =>
        await db.Invoices.Include(i => i.User).Include(i => i.Tenant)
            .FirstOrDefaultAsync(i => i.Id == invoiceId && i.UserId == Me)
        ?? throw new KeyNotFoundException("Invoice not found.");
}
