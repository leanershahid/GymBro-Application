using System.Text.Json;
using GymManagmentApplication.Application.Billing.Requests;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Billing;
using GymManagmentApplication.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Billing.Services;

/// <summary>
/// Shared billing rules: creating invoices (numbered per gym, in the gym's currency) and
/// applying payments/refunds to them. Used by memberships, invoices and payments alike.
/// </summary>
public class BillingCore(IAppDbContext db, GymManagmentApplication.Application.Engagement.Notifier notifier)
{
    public record NewInvoice(
        ulong TenantId, ulong UserId, IReadOnlyList<InvoiceLineItem> Items,
        decimal TaxPercent = 0, decimal Discount = 0, DateOnly? DueDate = null,
        string? Notes = null, ulong? MembershipId = null);

    public async Task<Invoice> CreateInvoiceAsync(NewInvoice spec)
    {
        if (spec.Items.Count == 0) throw new ArgumentException("Add at least one line item.");
        if (spec.Items.Any(i => i.Quantity <= 0 || i.UnitPrice < 0))
            throw new ArgumentException("Line items need a quantity of 1 or more and a price of 0 or more.");
        if (spec.TaxPercent is < 0 or > 100) throw new ArgumentException("Tax must be between 0 and 100%.");

        var subtotal = Round(spec.Items.Sum(i => i.UnitPrice * i.Quantity));
        var discount = Math.Clamp(Round(spec.Discount), 0, subtotal);
        var tax = Round((subtotal - discount) * spec.TaxPercent / 100m);
        var currency = await db.Tenants.IgnoreQueryFilters()
            .Where(t => t.Id == spec.TenantId).Select(t => t.Currency).FirstOrDefaultAsync() ?? "INR";

        var invoice = new Invoice
        {
            TenantId = spec.TenantId,
            UserId = spec.UserId,
            MembershipId = spec.MembershipId,
            InvoiceNo = await NextInvoiceNoAsync(spec.TenantId),
            Items = JsonSerializer.SerializeToDocument(spec.Items.Select(i => new { i.Description, i.UnitPrice, i.Quantity })),
            Subtotal = subtotal, Discount = discount, Tax = tax,
            Total = subtotal - discount + tax,
            Currency = currency,
            Status = InvoiceStatus.Sent,
            DueDate = spec.DueDate,
            Notes = spec.Notes,
        };
        if (invoice.Total == 0) { invoice.Status = InvoiceStatus.Paid; invoice.PaidAt = DateTime.UtcNow; }
        db.Invoices.Add(invoice);
        if (invoice.Total > 0)
            notifier.Add(spec.TenantId, spec.UserId, $"New invoice {invoice.InvoiceNo}",
                $"{invoice.Total:N2} {invoice.Currency}{(spec.DueDate is { } d ? $" due {d:dd MMM}" : "")}.", "billing", null);
        return invoice;
    }

    /// <summary>Records a completed payment against an invoice and settles it when fully paid.</summary>
    public Payment ApplyPayment(Invoice invoice, decimal amount, PaymentMethod method, string? reference,
        string? gatewayRef, ulong? recordedBy, string? notes)
    {
        if (invoice.Status is InvoiceStatus.Void or InvoiceStatus.Refunded)
            throw new ArgumentException($"Invoice {invoice.InvoiceNo} is {invoice.Status.ToString().ToLower()} and can't take payments.");
        amount = Round(amount);
        var balance = Balance(invoice);
        if (amount <= 0) throw new ArgumentException("Enter an amount greater than zero.");
        if (balance <= 0) throw new ArgumentException($"Invoice {invoice.InvoiceNo} is already paid.");
        if (amount > balance) throw new ArgumentException($"That's more than the {balance:N2} {invoice.Currency} still due.");

        var payment = new Payment
        {
            TenantId = invoice.TenantId, Invoice = invoice, InvoiceId = invoice.Id,
            Amount = amount, Currency = invoice.Currency, Method = method,
            Status = PaymentStatus.Completed, Reference = reference?.Trim(), GatewayRef = gatewayRef,
            RecordedBy = recordedBy, Notes = notes?.Trim(), CreatedAt = DateTime.UtcNow,
        };
        db.Payments.Add(payment);

        invoice.AddPaidAmount(amount, DateTime.UtcNow);
        return payment;
    }

    /// <summary>
    /// Self-service (feature 4): once a membership's invoice is fully paid, a Pending membership
    /// becomes Active. Idempotent — only a Pending membership changes, so a duplicate webhook or a
    /// second verify does nothing. If the chosen start date has passed while it waited for payment,
    /// the period starts today instead (same length). Call inside the payment's unit of work.
    /// </summary>
    public async Task<Domain.Entities.Membership.GymMembership?> ActivatePaidMembershipAsync(Invoice invoice)
    {
        if (invoice.MembershipId is not { } membershipId || invoice.Status != InvoiceStatus.Paid) return null;
        var m = await db.GymMemberships.IgnoreQueryFilters().Include(x => x.Plan)
            .FirstOrDefaultAsync(x => x.Id == membershipId && x.TenantId == invoice.TenantId);
        if (m is null || m.Status != MembershipStatus.Pending) return null;

        var today = (await TenantClock.ForAsync(db, m.TenantId)).Today;
        if (m.StartsAt < today)
        {
            var length = m.EndsAt is { } end ? end.DayNumber - m.StartsAt.DayNumber : SubscriptionService.CycleToDays(m.Plan?.BillingCycle);
            m.StartsAt = today;
            m.EndsAt = today.AddDays(length);
        }
        m.Status = MembershipStatus.Active;
        m.UpdatedAt = DateTime.UtcNow;
        notifier.Add(m.TenantId, m.UserId, "Your membership is active",
            $"{m.Plan?.Name ?? "Your plan"} starts {(m.StartsAt == today ? "today" : m.StartsAt.ToString("dd MMM yyyy"))}. Book your first class!",
            "billing", m.Id, category: "billing");
        return m;
    }

    /// <summary>Takes a refund off a payment and its invoice (full or partial).</summary>
    public void ApplyRefund(Payment payment, decimal amount)
    {
        if (payment.Status != PaymentStatus.Completed)
            throw new ArgumentException("Only completed payments can be refunded.");
        amount = Round(amount);
        var refundable = payment.Amount - payment.RefundedAmount;
        if (amount <= 0 || amount > refundable)
            throw new ArgumentException($"You can refund up to {refundable:N2} {payment.Currency} on this payment.");

        payment.RefundedAmount += amount;
        if (payment.RefundedAmount >= payment.Amount) payment.Status = PaymentStatus.Refunded;

        payment.Invoice.SubtractRefundedAmount(amount);
    }

    /// <summary>Kept for existing callers; the rule lives on <see cref="Invoice.BalanceDue"/> (ARCH-084).</summary>
    public static decimal Balance(Invoice i) => i.BalanceDue();

    public static decimal Round(decimal v) => Money.Round(v);

    /// <summary>
    /// INV-2026-00042: per gym and year, drawn from the gym's TenantCounters row with one atomic
    /// upsert (ARCH-006) so concurrent invoices never collide; the unique (TenantId, InvoiceNo)
    /// index stays as a backstop. The first call of a year continues from existing invoices.
    /// </summary>
    private async Task<string> NextInvoiceNoAsync(ulong tenantId)
    {
        var year = DateTime.UtcNow.Year;
        var prefix = $"INV-{year}-";
        var key = $"invoice:{year}";
        long floor = 1;
        if (!await db.TenantCounters.IgnoreQueryFilters().AnyAsync(c => c.TenantId == tenantId && c.Key == key))
        {
            var numbers = await db.Invoices.IgnoreQueryFilters()
                .Where(i => i.TenantId == tenantId && i.InvoiceNo.StartsWith(prefix))
                .Select(i => i.InvoiceNo).ToListAsync();
            floor = numbers.Select(no => long.TryParse(no[prefix.Length..], out var x) ? x : 0).DefaultIfEmpty(0).Max() + 1;
        }
        var n = await TenantCounters.NextAsync(db, tenantId, key, floor);
        return $"{prefix}{n:D5}";
    }
}
