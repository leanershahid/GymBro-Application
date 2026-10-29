using System.Text.Json;
using GymManagmentApplication.Application.Billing.Interfaces;
using GymManagmentApplication.Application.Billing.Requests;
using GymManagmentApplication.Application.Billing.Responses;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Billing;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using GymManagmentApplication.Infrastructure.Email;
using GymManagmentApplication.Infrastructure.Payments;
using GymManagmentApplication.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Billing.Services;

/// <summary>
/// Payments. Desk payments (cash/UPI/card terminal/cheque) are recorded by staff against
/// invoices. Online payments go through the gym's own Razorpay account: an order is created for
/// an invoice, the app opens Razorpay Checkout, and the returned signature is verified here
/// before the payment is recorded. Nothing is ever marked paid without one of those two.
/// </summary>
public class PaymentService(
    AppDbContext db,
    ICurrentUser currentUser,
    BillingCore billing,
    RazorpayClient razorpay,
    ISecretProtector secrets,
    IEmailSender email) : IPaymentService
{
    public const string Razorpay = "razorpay";

    public async Task<PaymentResponse> ChargeAsync(ChargeRequest request)
    {
        var tenantId = currentUser.ResolveTenantId(request.TenantId);
        var method = ParseMethod(request.Method);

        Invoice invoice;
        if (request.InvoiceId is { } invoiceId)
        {
            invoice = await db.Invoices.Include(i => i.User).FirstOrDefaultAsync(i => i.Id == invoiceId && i.TenantId == tenantId)
                      ?? throw new KeyNotFoundException($"Invoice {invoiceId} not found.");
        }
        else
        {
            await db.EnsureUserAsync(request.MemberId, tenantId);
            invoice = await billing.CreateInvoiceAsync(new BillingCore.NewInvoice(tenantId, request.MemberId,
                [new InvoiceLineItem { Description = string.IsNullOrWhiteSpace(request.Description) ? "Payment" : request.Description.Trim(), UnitPrice = request.Amount, Quantity = 1 }],
                DueDate: DateOnly.FromDateTime(DateTime.UtcNow)));
        }

        var amount = request.Amount > 0 ? request.Amount : BillingCore.Balance(invoice);
        var payment = billing.ApplyPayment(invoice, amount, method, request.Reference, null, currentUser.UserId, request.Notes);
        await db.SaveChangesAsync();
        return Map(payment, invoice);
    }

    public async Task<PaymentResponse?> GetByIdAsync(ulong id)
    {
        var p = await db.Payments.Include(x => x.Invoice).ThenInclude(i => i.User).FirstOrDefaultAsync(x => x.Id == id);
        return p is null ? null : Map(p, p.Invoice);
    }

    public async Task<PaymentResponse?> RefundAsync(RefundRequest request)
    {
        var p = await db.Payments.Include(x => x.Invoice).ThenInclude(i => i.User).FirstOrDefaultAsync(x => x.Id == request.PaymentId);
        if (p is null) return null;
        var amount = request.Amount ?? p.Amount - p.RefundedAmount;

        // Online payments are refunded through the gateway; desk payments are handed back at the desk.
        if (p.GatewayRef is { Length: > 0 } gatewayPaymentId && p.GatewayId is not null)
        {
            var keys = await KeysAsync(p.TenantId) ?? throw new ArgumentException("Razorpay isn't set up for this gym, so this online payment can't be refunded here.");
            await razorpay.RefundAsync(keys, gatewayPaymentId, amount);
        }

        billing.ApplyRefund(p, amount);
        if (!string.IsNullOrWhiteSpace(request.Reason))
            p.Notes = $"{p.Notes}\n[{DateTime.UtcNow:yyyy-MM-dd}] Refunded {amount:N2}: {request.Reason.Trim()}".Trim();
        await db.SaveChangesAsync();
        return Map(p, p.Invoice);
    }

    public async Task<PagedResponse<PaymentResponse>> GetHistoryAsync(ulong tenantId, ulong? memberId, int page, int size)
    {
        tenantId = currentUser.ResolveTenantId(tenantId);
        var query = db.Payments.Include(p => p.Invoice).ThenInclude(i => i.User).Where(p => p.TenantId == tenantId);
        if (memberId.HasValue) query = query.Where(p => p.Invoice.UserId == memberId.Value);
        var total = await query.CountAsync();
        var items = await query.OrderByDescending(p => p.CreatedAt).Page(page, size).ToListAsync();
        var (p0, s0) = Paging.Clamp(page, size);
        return new PagedResponse<PaymentResponse>
        {
            Items = items.Select(p => Map(p, p.Invoice)), PageNumber = p0, PageSize = s0, TotalRecords = total,
        };
    }

    // Card storage needs a gateway's tokenised vault; members pay through Checkout each time instead.
    public Task<PaymentMethodResponse> SaveMethodAsync(SavePaymentMethodRequest request) =>
        throw new ArgumentException("Saving cards isn't supported. Members pay online through Razorpay Checkout each time.");

    public Task<List<PaymentMethodResponse>> GetMethodsAsync(ulong memberId) => Task.FromResult(new List<PaymentMethodResponse>());

    public Task<bool> RemoveMethodAsync(ulong methodId) => Task.FromResult(false);

    // ── Online (Razorpay) ───────────────────────────────────────────────────

    public async Task<OnlineOrderResponse> CreateIntentAsync(CreatePaymentIntentRequest request)
    {
        var tenantId = currentUser.ResolveTenantId(request.TenantId);
        var invoice = await db.Invoices.Include(i => i.User).Include(i => i.Tenant)
                          .FirstOrDefaultAsync(i => i.Id == request.InvoiceId && i.TenantId == tenantId)
                      ?? throw new KeyNotFoundException($"Invoice {request.InvoiceId} not found.");
        return await CreateOrderAsync(invoice, request.Amount);
    }

    /// <summary>Creates a Razorpay order for (part of) an invoice's balance.</summary>
    public async Task<OnlineOrderResponse> CreateOrderAsync(Invoice invoice, decimal amount = 0)
    {
        var (gateway, keys) = await ActiveGatewayAsync(invoice.TenantId)
                              ?? throw new ArgumentException("Online payments aren't set up for this gym yet. Please pay at the front desk.");
        var balance = BillingCore.Balance(invoice);
        if (balance <= 0) throw new ArgumentException($"Invoice {invoice.InvoiceNo} is already paid.");
        if (amount <= 0 || amount > balance) amount = balance;

        var order = await razorpay.CreateOrderAsync(keys, amount, invoice.Currency, invoice.InvoiceNo,
            new Dictionary<string, string> { ["invoiceId"] = invoice.Id.ToString(), ["tenantId"] = invoice.TenantId.ToString() });
        return new OnlineOrderResponse
        {
            KeyId = keys.KeyId, OrderId = order.Id, AmountMinor = order.AmountMinor, Currency = order.Currency,
            InvoiceId = invoice.Id, InvoiceNo = invoice.InvoiceNo, GymName = invoice.Tenant?.Name,
            MemberName = $"{invoice.User?.FirstName} {invoice.User?.LastName}".Trim(),
            MemberEmail = invoice.User?.Email, MemberPhone = invoice.User?.Phone,
        };
    }

    public async Task<PaymentResponse> VerifyOnlineAsync(VerifyOnlinePaymentRequest request)
    {
        var tenantId = currentUser.ResolveTenantId();
        var invoice = await db.Invoices.Include(i => i.User).FirstOrDefaultAsync(i => i.Id == request.InvoiceId && i.TenantId == tenantId)
                      ?? throw new KeyNotFoundException($"Invoice {request.InvoiceId} not found.");
        return await RecordVerifiedAsync(invoice, request);
    }

    /// <summary>Checks the Checkout signature and the payment itself with Razorpay, then records it once.</summary>
    public async Task<PaymentResponse> RecordVerifiedAsync(Invoice invoice, VerifyOnlinePaymentRequest request)
    {
        var (gateway, keys) = await ActiveGatewayAsync(invoice.TenantId)
                              ?? throw new ArgumentException("Online payments aren't set up for this gym.");
        if (!RazorpayClient.VerifySignature(keys, request.OrderId, request.PaymentId, request.Signature))
            throw new ArgumentException("The payment couldn't be verified. If money was taken, contact the gym with your payment id.");

        // Idempotent: the same Razorpay payment is never recorded twice.
        var existing = await db.Payments.FirstOrDefaultAsync(p => p.GatewayRef == request.PaymentId && p.TenantId == invoice.TenantId);
        if (existing is not null) return Map(existing, invoice);

        var info = await razorpay.GetPaymentAsync(keys, request.PaymentId);
        if (info.OrderId != request.OrderId || info.Status is not ("captured" or "authorized"))
            throw new ArgumentException("The payment isn't complete yet. Please try again in a moment.");

        var amount = info.AmountMinor / 100m;
        var payment = billing.ApplyPayment(invoice, Math.Min(amount, BillingCore.Balance(invoice)), MapRazorpayMethod(info.Method),
            reference: request.OrderId, gatewayRef: request.PaymentId, recordedBy: null, notes: "Paid online via Razorpay");
        payment.GatewayId = gateway.Id;
        payment.GatewayResponse = JsonSerializer.SerializeToDocument(new { info.Id, info.Status, info.Method, info.AmountMinor, info.OrderId });
        await db.SaveChangesAsync();
        return Map(payment, invoice);
    }

    // ── Gateway settings (per gym) ──────────────────────────────────────────

    public async Task<GatewayStatusResponse> GetGatewayAsync()
    {
        var tenantId = currentUser.ResolveTenantId();
        var gw = await db.Set<PaymentGateway>().FirstOrDefaultAsync(g => g.TenantId == tenantId && g.Provider == Razorpay);
        return ToStatus(gw);
    }

    public async Task<GatewayStatusResponse> SaveGatewayAsync(SaveGatewayRequest request)
    {
        var tenantId = currentUser.ResolveTenantId();
        if (string.IsNullOrWhiteSpace(request.KeyId) || !request.KeyId.Trim().StartsWith("rzp_", StringComparison.Ordinal))
            throw new ArgumentException("Enter the Razorpay Key Id (it starts with rzp_live_ or rzp_test_).");

        var gw = await db.Set<PaymentGateway>().FirstOrDefaultAsync(g => g.TenantId == tenantId && g.Provider == Razorpay);
        var secret = string.IsNullOrWhiteSpace(request.KeySecret)
            ? (gw is null ? null : ReadKeys(gw)?.KeySecret)
            : request.KeySecret.Trim();
        if (string.IsNullOrEmpty(secret)) throw new ArgumentException("Enter the Razorpay Key Secret.");

        var keys = new RazorpayKeys(request.KeyId.Trim(), secret);
        if (request.IsActive && !await razorpay.TestKeysAsync(keys))
            throw new ArgumentException("Razorpay didn't accept these keys. Check the Key Id and Secret in your Razorpay dashboard.");

        gw ??= db.Set<PaymentGateway>().Add(new PaymentGateway { TenantId = tenantId, Provider = Razorpay, IsDefault = true }).Entity;
        gw.ConfigEnc = JsonSerializer.SerializeToDocument(new { keyId = keys.KeyId, keySecret = secrets.Protect(keys.KeySecret) });
        gw.IsActive = request.IsActive;
        await db.SaveChangesAsync();
        return ToStatus(gw);
    }

    public async Task<bool> RemoveGatewayAsync()
    {
        var tenantId = currentUser.ResolveTenantId();
        var gw = await db.Set<PaymentGateway>().FirstOrDefaultAsync(g => g.TenantId == tenantId && g.Provider == Razorpay);
        if (gw is null) return false;
        // Past payments keep pointing at it, so it is switched off rather than deleted.
        gw.IsActive = false;
        gw.ConfigEnc = JsonSerializer.SerializeToDocument(new { });
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<(PaymentGateway Gateway, RazorpayKeys Keys)?> ActiveGatewayAsync(ulong tenantId)
    {
        var gw = await db.Set<PaymentGateway>().IgnoreQueryFilters()
            .FirstOrDefaultAsync(g => g.TenantId == tenantId && g.Provider == Razorpay && g.IsActive);
        var keys = gw is null ? null : ReadKeys(gw);
        return gw is null || keys is null ? null : (gw, keys);
    }

    private async Task<RazorpayKeys?> KeysAsync(ulong tenantId) => (await ActiveGatewayAsync(tenantId))?.Keys;

    private RazorpayKeys? ReadKeys(PaymentGateway gw)
    {
        var root = gw.ConfigEnc?.RootElement;
        if (root is null || !root.Value.TryGetProperty("keyId", out var id) || !root.Value.TryGetProperty("keySecret", out var enc)) return null;
        var secret = secrets.Unprotect(enc.GetString());
        return secret is null ? null : new RazorpayKeys(id.GetString()!, secret);
    }

    private GatewayStatusResponse ToStatus(PaymentGateway? gw)
    {
        var keys = gw is null ? null : ReadKeys(gw);
        return new GatewayStatusResponse { Configured = keys is not null, IsActive = gw?.IsActive == true && keys is not null, KeyId = keys?.KeyId };
    }

    // ── Reminders ───────────────────────────────────────────────────────────

    public async Task<bool> SendReminderAsync(PaymentReminderRequest request)
    {
        var tenantId = currentUser.ResolveTenantId();
        var member = await db.Users.FirstOrDefaultAsync(u => u.Id == request.MemberId && u.TenantId == tenantId && u.DeletedAt == null)
                     ?? throw new KeyNotFoundException($"Member {request.MemberId} not found.");
        var due = await db.Invoices
            .Where(i => i.UserId == member.Id && (i.Status == InvoiceStatus.Sent || i.Status == InvoiceStatus.Overdue) && i.Total > i.AmountPaid)
            .OrderBy(i => i.DueDate).ToListAsync();
        if (due.Count == 0) throw new ArgumentException("This member has nothing due.");
        if (string.IsNullOrEmpty(member.Email)) throw new ArgumentException("This member has no email address.");

        var gym = await db.Tenants.Where(t => t.Id == tenantId).Select(t => t.Name).FirstOrDefaultAsync();
        var rows = string.Join("", due.Select(i =>
            $"<tr><td style=\"padding:4px 12px 4px 0\">{i.InvoiceNo}</td><td style=\"padding:4px 12px 4px 0\">{(i.DueDate?.ToString("dd MMM yyyy") ?? "-")}</td><td style=\"padding:4px 0\"><b>{BillingCore.Balance(i):N2} {i.Currency}</b></td></tr>"));
        var note = string.IsNullOrWhiteSpace(request.Message) ? "" : $"<p>{System.Net.WebUtility.HtmlEncode(request.Message.Trim())}</p>";
        var html = EmailTemplates.Wrap("Payment reminder", $"""
            <p>Hi {System.Net.WebUtility.HtmlEncode(member.FirstName ?? "there")},</p>
            <p>This is a reminder from {System.Net.WebUtility.HtmlEncode(gym ?? "your gym")} about the following unpaid invoice(s):</p>
            <table>{rows}</table>{note}
            <p>You can pay at the front desk or from the GymBro app.</p>
            """);
        var sent = await email.SendAsync(member.Email, $"Payment reminder from {gym}", html);
        if (!sent) throw new InvalidOperationException("The reminder email couldn't be sent. Check the email settings.");
        return true;
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    public static PaymentMethod ParseMethod(string? method) => (method ?? "cash").Trim().ToLowerInvariant() switch
    {
        "cash" => PaymentMethod.Cash,
        "upi" => PaymentMethod.Upi,
        "card" => PaymentMethod.Card,
        "netbanking" or "bank" or "bank-transfer" => PaymentMethod.Netbanking,
        "cheque" or "check" => PaymentMethod.Cheque,
        "wallet" => PaymentMethod.Wallet,
        _ => throw new ArgumentException("Payment method must be cash, upi, card, netbanking, cheque or wallet."),
    };

    private static PaymentMethod MapRazorpayMethod(string method) => method switch
    {
        "upi" => PaymentMethod.Upi,
        "netbanking" => PaymentMethod.Netbanking,
        "wallet" => PaymentMethod.Wallet,
        _ => PaymentMethod.Card,
    };

    public static PaymentResponse Map(Payment p, Invoice? i) => new()
    {
        Id = p.Id, TenantId = p.TenantId, MemberId = i?.UserId ?? 0,
        Amount = p.Amount, Currency = p.Currency, Status = p.Status.ToString(),
        Description = i is null ? null : $"Invoice {i.InvoiceNo}",
        GatewayRef = p.GatewayRef, PaidAt = p.CreatedAt,
        InvoiceId = p.InvoiceId, InvoiceNo = i?.InvoiceNo,
        Method = p.Method.ToString(), Reference = p.Reference, RefundedAmount = p.RefundedAmount,
        MemberName = i?.User is null ? null : $"{i.User.FirstName} {i.User.LastName}".Trim(),
    };
}
