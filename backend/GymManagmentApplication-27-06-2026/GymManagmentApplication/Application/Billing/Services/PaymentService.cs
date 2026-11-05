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
    IEmailOutbox outbox,
    ILogger<PaymentService> logger) : IPaymentService
{
    public const string Razorpay = "razorpay";

    public async Task<PaymentResponse> ChargeAsync(ChargeRequest request)
    {
        var tenantId = currentUser.ResolveTenantId(request.TenantId);
        var method = ParseMethod(request.Method);
        var key = NormalizeIdempotencyKey(request.IdempotencyKey);

        // ARCH-011: the same key never records a second payment (a retried or double-clicked request).
        if (key is not null && await FindByIdempotencyKeyAsync(tenantId, key) is { } earlier) return earlier;

        try
        {
            return await db.InTransactionAsync(async () =>
            {
                Invoice invoice;
                if (request.InvoiceId is { } invoiceId)
                {
                    // ARCH-016: lock the invoice so two payments can't both read the old AmountPaid.
                    await db.LockRowAsync<Invoice>(invoiceId);
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
                payment.IdempotencyKey = key;
                await db.SaveChangesAsync();
                return Map(payment, invoice);
            });
        }
        catch (DbUpdateException ex) when (key is not null && IsUniqueViolation(ex, "IdempotencyKey"))
        {
            // A concurrent request with the same key won the race; answer with its payment.
            db.ChangeTracker.Clear();
            return await FindByIdempotencyKeyAsync(tenantId, key) ?? throw new ArgumentException("A payment with this idempotency key is being recorded. Please try again.");
        }
    }

    private async Task<PaymentResponse?> FindByIdempotencyKeyAsync(ulong tenantId, string key)
    {
        var p = await db.Payments.Include(x => x.Invoice).ThenInclude(i => i.User)
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.IdempotencyKey == key);
        return p is null ? null : Map(p, p.Invoice);
    }

    private static string? NormalizeIdempotencyKey(string? key)
    {
        if (string.IsNullOrWhiteSpace(key)) return null;
        key = key.Trim();
        return key.Length <= 100 ? key : throw new ArgumentException("Idempotency key must be at most 100 characters.");
    }

    private static bool IsUniqueViolation(DbUpdateException ex, string constraintHint) =>
        ex.InnerException is Npgsql.PostgresException { SqlState: "23505" } pg
        && (pg.ConstraintName?.Contains(constraintHint, StringComparison.OrdinalIgnoreCase) ?? false);

    public async Task<PaymentResponse?> GetByIdAsync(ulong id)
    {
        var p = await db.Payments.Include(x => x.Invoice).ThenInclude(i => i.User).FirstOrDefaultAsync(x => x.Id == id);
        return p is null ? null : Map(p, p.Invoice);
    }

    /// <summary>
    /// ARCH-012: the refund is validated and recorded first (inside a transaction holding the
    /// payment's row lock, so two refunds can't both pass the "refundable" check), then the gateway
    /// is called outside the transaction. If the gateway refuses, the recorded refund is reversed.
    /// </summary>
    public async Task<PaymentResponse?> RefundAsync(RefundRequest request)
    {
        var found = await db.Payments.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.PaymentId);
        if (found is null) return null;

        // Online payments are refunded through the gateway; desk payments are handed back at the desk.
        var online = found.GatewayRef is { Length: > 0 } && found.GatewayId is not null;
        RazorpayKeys? keys = null;
        if (online)
            keys = await KeysAsync(found.TenantId) ?? throw new ArgumentException("Razorpay isn't set up for this gym, so this online payment can't be refunded here.");

        Payment p = default!;
        decimal amount = 0;
        RefundSnapshot before = default!;
        await db.InTransactionAsync(async () =>
        {
            await db.LockRowAsync<Payment>(found.Id);
            p = await db.Payments.Include(x => x.Invoice).ThenInclude(i => i.User).FirstAsync(x => x.Id == found.Id);
            amount = BillingCore.Round(request.Amount ?? p.Amount - p.RefundedAmount);
            before = RefundSnapshot.Of(p);
            billing.ApplyRefund(p, amount); // validates status and amount before anything is sent
            var reason = string.IsNullOrWhiteSpace(request.Reason) ? "" : $": {request.Reason.Trim()}";
            p.Notes = $"{p.Notes}\n[{DateTime.UtcNow:yyyy-MM-dd}] Refunded {amount:N2}{reason}{(online ? " (sent to Razorpay)" : "")}".Trim();
            await db.SaveChangesAsync();
        });

        if (online)
        {
            try
            {
                var refundId = await razorpay.RefundAsync(keys!, p.GatewayRef!, amount, receipt: $"payment-{p.Id}-{p.RefundedAmount:0.00}");
                p.Notes = $"{p.Notes} Razorpay refund {refundId}.";
                await db.SaveChangesAsync();
            }
            catch (Exception gatewayError)
            {
                logger.LogWarning(gatewayError, "Razorpay refund failed for payment {PaymentId}; reversing the recorded refund.", p.Id);
                await db.InTransactionAsync(async () =>
                {
                    await db.LockRowAsync<Payment>(p.Id);
                    await db.Entry(p).ReloadAsync();
                    await db.Entry(p.Invoice).ReloadAsync();
                    before.Restore(p, amount);
                    p.Notes = $"{p.Notes}\n[{DateTime.UtcNow:yyyy-MM-dd}] Refund of {amount:N2} failed at Razorpay and was reversed.".Trim();
                    await db.SaveChangesAsync();
                });
                throw;
            }
        }
        return Map(p, p.Invoice);
    }

    private sealed record RefundSnapshot(PaymentStatus Status, InvoiceStatus InvoiceStatus, DateTime? PaidAt)
    {
        public static RefundSnapshot Of(Payment p) => new(p.Status, p.Invoice.Status, p.Invoice.PaidAt);

        /// <summary>Undoes one ApplyRefund of <paramref name="amount"/> (on freshly reloaded rows).</summary>
        public void Restore(Payment p, decimal amount)
        {
            p.RefundedAmount = Math.Max(0, p.RefundedAmount - amount);
            p.Status = Status;
            p.Invoice.AmountPaid += amount;
            p.Invoice.Status = InvoiceStatus;
            p.Invoice.PaidAt = PaidAt;
        }
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

    public const string SavedMethodsNotSupported = "Saving cards isn't supported. Members pay online through Razorpay Checkout each time.";

    // Card storage needs a gateway's tokenised vault; members pay through Checkout each time instead.
    // The controller answers 501 Not Implemented for these endpoints (ARCH-078).
    public Task<PaymentMethodResponse> SaveMethodAsync(SavePaymentMethodRequest request) =>
        throw new NotSupportedException(SavedMethodsNotSupported);

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

        if (await FindByGatewayRefAsync(invoice.TenantId, request.PaymentId) is { } existing) return existing;

        var info = await razorpay.GetPaymentAsync(keys, request.PaymentId);
        if (info.OrderId != request.OrderId)
            throw new ArgumentException("The payment couldn't be verified. If money was taken, contact the gym with your payment id.");
        return await RecordGatewayPaymentAsync(invoice.Id, invoice.TenantId, gateway, keys, info);
    }

    /// <summary>
    /// ARCH-011: records a Razorpay payment exactly once. An "authorized" payment is captured first
    /// (never treated as paid while uncaptured); the invoice row is locked while the payment is
    /// applied, and the unique (TenantId, GatewayRef) index turns a concurrent duplicate (Checkout
    /// verify racing the webhook) into "already recorded".
    /// </summary>
    private async Task<PaymentResponse> RecordGatewayPaymentAsync(ulong invoiceId, ulong tenantId, PaymentGateway gateway,
        RazorpayKeys keys, RazorpayClient.PaymentInfo info)
    {
        if (info.Status == "authorized")
        {
            var currency = await db.Invoices.IgnoreQueryFilters().Where(i => i.Id == invoiceId).Select(i => i.Currency).FirstAsync();
            info = await razorpay.CaptureAsync(keys, info.Id, info.AmountMinor, currency);
        }
        if (info.Status != "captured")
            throw new ArgumentException("The payment isn't complete yet. Please try again in a moment.");

        try
        {
            return await db.InTransactionAsync(async () =>
            {
                await db.LockRowAsync<Invoice>(invoiceId);
                var invoice = await db.Invoices.IgnoreQueryFilters().Include(i => i.User)
                                  .FirstOrDefaultAsync(i => i.Id == invoiceId && i.TenantId == tenantId)
                              ?? throw new KeyNotFoundException($"Invoice {invoiceId} not found.");
                if (await FindByGatewayRefAsync(tenantId, info.Id) is { } already) return already;

                var amount = info.AmountMinor / 100m;
                var payment = billing.ApplyPayment(invoice, Math.Min(amount, BillingCore.Balance(invoice)), MapRazorpayMethod(info.Method),
                    reference: info.OrderId, gatewayRef: info.Id, recordedBy: null, notes: "Paid online via Razorpay");
                payment.GatewayId = gateway.Id;
                payment.GatewayResponse = JsonSerializer.SerializeToDocument(new { info.Id, info.Status, info.Method, info.AmountMinor, info.OrderId });
                await db.SaveChangesAsync();
                return Map(payment, invoice);
            });
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex, "GatewayRef"))
        {
            db.ChangeTracker.Clear();
            return await FindByGatewayRefAsync(tenantId, info.Id) ?? throw new ArgumentException("This online payment is already being recorded. Please refresh in a moment.");
        }
    }

    private async Task<PaymentResponse?> FindByGatewayRefAsync(ulong tenantId, string gatewayRef)
    {
        var p = await db.Payments.IgnoreQueryFilters().Include(x => x.Invoice).ThenInclude(i => i.User)
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.GatewayRef == gatewayRef);
        return p is null ? null : Map(p, p.Invoice);
    }

    // ── Webhook (ARCH-011) ──────────────────────────────────────────────────

    /// <summary>
    /// Razorpay webhook for one gym (payment.captured / payment.authorized / order.paid). Records the
    /// payment if Checkout never reported back (app closed after paying). Duplicate deliveries are
    /// harmless: a payment is recorded once per GatewayRef.
    /// </summary>
    public async Task<bool> HandleRazorpayWebhookAsync(ulong tenantId, string rawBody, string? signature)
    {
        var active = await ActiveGatewayAsync(tenantId);
        if (active is not { } a || ReadWebhookSecret(a.Gateway) is not { } secret
            || !RazorpayClient.VerifyWebhookSignature(secret, rawBody, signature))
            return false;

        using var doc = JsonDocument.Parse(rawBody);
        var root = doc.RootElement;
        var evt = root.TryGetProperty("event", out var e) ? e.GetString() : null;
        if (evt is not ("payment.captured" or "payment.authorized" or "order.paid")) return true; // acknowledged, nothing to do
        if (!root.TryGetProperty("payload", out var payload)
            || !payload.TryGetProperty("payment", out var pay) || !pay.TryGetProperty("entity", out var entity))
            return true;

        var info = RazorpayClient.ReadPayment(entity);
        if (await FindByGatewayRefAsync(tenantId, info.Id) is not null) return true;

        // The invoice id travels in the order's notes (set in CreateOrderAsync).
        IReadOnlyDictionary<string, string> notes = payload.TryGetProperty("order", out var ord) && ord.TryGetProperty("entity", out var orderEntity)
            ? RazorpayClient.ReadNotes(orderEntity)
            : RazorpayClient.ReadNotes(entity);
        if (!notes.ContainsKey("invoiceId") && info.OrderId is { } orderId)
            notes = await razorpay.GetOrderNotesAsync(a.Keys, orderId);
        if (!notes.TryGetValue("invoiceId", out var rawInvoiceId) || !ulong.TryParse(rawInvoiceId, out var invoiceId))
        {
            logger.LogWarning("Razorpay webhook {Event} for payment {PaymentId} has no invoiceId; ignored.", evt, info.Id);
            return true;
        }
        if (notes.TryGetValue("tenantId", out var rawTenant) && rawTenant != tenantId.ToString())
        {
            logger.LogWarning("Razorpay webhook for payment {PaymentId} names tenant {Tenant}, not {Expected}; ignored.", info.Id, rawTenant, tenantId);
            return true;
        }

        try
        {
            await RecordGatewayPaymentAsync(invoiceId, tenantId, a.Gateway, a.Keys, info);
        }
        catch (ArgumentException ex)
        {
            // Not capturable / invoice already settled: nothing to retry, so acknowledge.
            logger.LogWarning("Razorpay webhook for payment {PaymentId} not recorded: {Reason}", info.Id, ex.Message);
        }
        return true;
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
        var webhookSecret = string.IsNullOrWhiteSpace(request.WebhookSecret)
            ? (gw is null ? null : ReadWebhookSecret(gw))
            : request.WebhookSecret.Trim();
        if (request.IsActive && !await razorpay.TestKeysAsync(keys))
            throw new ArgumentException("Razorpay didn't accept these keys. Check the Key Id and Secret in your Razorpay dashboard.");

        gw ??= db.Set<PaymentGateway>().Add(new PaymentGateway { TenantId = tenantId, Provider = Razorpay, IsDefault = true }).Entity;
        gw.ConfigEnc = webhookSecret is null
            ? JsonSerializer.SerializeToDocument(new { keyId = keys.KeyId, keySecret = secrets.Protect(keys.KeySecret) })
            : JsonSerializer.SerializeToDocument(new { keyId = keys.KeyId, keySecret = secrets.Protect(keys.KeySecret), webhookSecret = secrets.Protect(webhookSecret) });
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

    private string? ReadWebhookSecret(PaymentGateway gw)
    {
        var root = gw.ConfigEnc?.RootElement;
        if (root is null || !root.Value.TryGetProperty("webhookSecret", out var enc)) return null;
        return secrets.Unprotect(enc.GetString());
    }

    private GatewayStatusResponse ToStatus(PaymentGateway? gw)
    {
        var keys = gw is null ? null : ReadKeys(gw);
        return new GatewayStatusResponse
        {
            Configured = keys is not null, IsActive = gw?.IsActive == true && keys is not null, KeyId = keys?.KeyId,
            WebhookConfigured = gw is not null && ReadWebhookSecret(gw) is not null,
        };
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
        // Queued in the outbox and delivered in the background (ARCH-046), not on this request.
        outbox.Enqueue(tenantId, member.Id, member.Email, $"Payment reminder from {gym}", html);
        await db.SaveChangesAsync();
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
