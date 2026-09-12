using GymManagmentApplication.Application.Billing.Interfaces;
using GymManagmentApplication.Application.Billing.Requests;
using GymManagmentApplication.Application.Billing.Responses;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Billing;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Billing.Services;

public class PaymentService(AppDbContext db) : IPaymentService
{
    // In-memory payment method store until a dedicated table is added
    private static readonly List<(ulong MemberId, PaymentMethodResponse Method)> _methods = [];
    private static ulong _methodId = 1;

    public async Task<PaymentResponse> ChargeAsync(ChargeRequest request)
    {
        // Create draft invoice then payment
        var invoiceId = (await db.Invoices.MaxAsync(i => (ulong?)i.Id) ?? 0) + 1;
        var invoice = new Invoice
        {
            Id = invoiceId, TenantId = request.TenantId,
            UserId = request.MemberId, InvoiceNo = $"INV-{invoiceId:D6}",
            Subtotal = request.Amount, Tax = 0, Discount = 0,
            Total = request.Amount, Currency = request.Currency,
            Status = InvoiceStatus.Paid, PaidAt = DateTime.UtcNow
        };
        db.Invoices.Add(invoice);

        var paymentId = (await db.Payments.MaxAsync(p => (ulong?)p.Id) ?? 0) + 1;
        var payment = new Payment
        {
            Id = paymentId, TenantId = request.TenantId,
            InvoiceId = invoiceId, Amount = request.Amount,
            Currency = request.Currency,
            Method = PaymentMethod.Card,
            Status = PaymentStatus.Completed,
            GatewayRef = $"MOCK-{Guid.NewGuid():N}",
            CreatedAt = DateTime.UtcNow
        };
        db.Payments.Add(payment);
        await db.SaveChangesAsync();
        return MapPayment(payment, request.MemberId);
    }

    public async Task<PaymentResponse?> GetByIdAsync(ulong id)
    {
        var p = await db.Payments.Include(x => x.Invoice).FirstOrDefaultAsync(x => x.Id == id);
        return p is null ? null : MapPayment(p, p.Invoice.UserId);
    }

    public async Task<PaymentResponse?> RefundAsync(RefundRequest request)
    {
        var p = await db.Payments.FindAsync(request.PaymentId);
        if (p is null) return null;
        p.Status = PaymentStatus.Refunded;
        await db.SaveChangesAsync();
        return MapPayment(p, 0);
    }

    public async Task<PagedResponse<PaymentResponse>> GetHistoryAsync(ulong tenantId, ulong? memberId, int page, int size)
    {
        var query = db.Payments.Include(p => p.Invoice)
            .Where(p => p.TenantId == tenantId);
        if (memberId.HasValue)
            query = query.Where(p => p.Invoice.UserId == memberId.Value);
        var total = await query.CountAsync();
        var items = await query.OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * size).Take(size).ToListAsync();
        return new PagedResponse<PaymentResponse>
        {
            Items = items.Select(p => MapPayment(p, p.Invoice?.UserId ?? 0)),
            PageNumber = page, PageSize = size, TotalRecords = total
        };
    }

    public Task<PaymentMethodResponse> SaveMethodAsync(SavePaymentMethodRequest request)
    {
        var method = new PaymentMethodResponse
        {
            Id = _methodId++, Type = request.Type, Provider = request.Provider,
            Last4 = "4242", Brand = "Visa", IsDefault = request.SetAsDefault,
            AddedAt = DateTime.UtcNow
        };
        _methods.Add((request.MemberId, method));
        return Task.FromResult(method);
    }

    public Task<List<PaymentMethodResponse>> GetMethodsAsync(ulong memberId) =>
        Task.FromResult(_methods.Where(m => m.MemberId == memberId).Select(m => m.Method).ToList());

    public Task<bool> RemoveMethodAsync(ulong methodId)
    {
        var idx = _methods.FindIndex(m => m.Method.Id == methodId);
        if (idx < 0) return Task.FromResult(false);
        _methods.RemoveAt(idx);
        return Task.FromResult(true);
    }

    public Task<PaymentIntentResponse> CreateIntentAsync(CreatePaymentIntentRequest request) =>
        Task.FromResult(new PaymentIntentResponse
        {
            ClientSecret = $"pi_{Guid.NewGuid():N}_secret_{Guid.NewGuid():N}",
            IntentId = $"pi_{Guid.NewGuid():N}",
            Amount = request.Amount, Currency = request.Currency,
            Provider = request.Provider
        });

    public Task<bool> SendReminderAsync(PaymentReminderRequest request) =>
        Task.FromResult(true);

    private static PaymentResponse MapPayment(Payment p, ulong memberId) => new()
    {
        Id = p.Id, TenantId = p.TenantId, MemberId = memberId,
        Amount = p.Amount, Currency = p.Currency,
        Status = p.Status.ToString(),
        GatewayRef = p.GatewayRef,
        PaidAt = p.CreatedAt
    };
}
