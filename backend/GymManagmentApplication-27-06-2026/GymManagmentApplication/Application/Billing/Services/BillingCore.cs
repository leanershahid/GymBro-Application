using System.Text.Json;
using GymManagmentApplication.Application.Billing.Requests;
using GymManagmentApplication.Domain.Entities.Billing;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Billing.Services;

/// <summary>
/// Shared billing rules: creating invoices (numbered per gym, in the gym's currency) and
/// applying payments/refunds to them. Used by memberships, invoices and payments alike.
/// </summary>
public class BillingCore(AppDbContext db, GymManagmentApplication.Application.Engagement.Notifier notifier)
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

        invoice.AmountPaid += amount;
        if (invoice.AmountPaid >= invoice.Total)
        {
            invoice.Status = InvoiceStatus.Paid;
            invoice.PaidAt = DateTime.UtcNow;
        }
        return payment;
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

        var invoice = payment.Invoice;
        invoice.AmountPaid = Math.Max(0, invoice.AmountPaid - amount);
        if (invoice.AmountPaid == 0) { invoice.Status = InvoiceStatus.Refunded; invoice.PaidAt = null; }
        else if (invoice.AmountPaid < invoice.Total) { invoice.Status = InvoiceStatus.Sent; invoice.PaidAt = null; }
    }

    public static decimal Balance(Invoice i) => Math.Max(0, i.Total - i.AmountPaid);

    public static decimal Round(decimal v) => Math.Round(v, 2, MidpointRounding.AwayFromZero);

    /// <summary>INV-2026-00042: per gym and year; the unique (TenantId, InvoiceNo) index backs it up.</summary>
    private async Task<string> NextInvoiceNoAsync(ulong tenantId)
    {
        var year = DateTime.UtcNow.Year;
        var prefix = $"INV-{year}-";
        var last = await db.Invoices.IgnoreQueryFilters()
            .Where(i => i.TenantId == tenantId && i.InvoiceNo.StartsWith(prefix))
            .OrderByDescending(i => i.InvoiceNo).Select(i => i.InvoiceNo).FirstOrDefaultAsync();
        var n = last is not null && int.TryParse(last[prefix.Length..], out var x) ? x + 1 : 1;
        // Invoices created earlier in this same unit of work aren't in the database yet.
        n += db.ChangeTracker.Entries<Invoice>().Count(e => e.State == EntityState.Added && e.Entity.TenantId == tenantId);
        return $"{prefix}{n:D5}";
    }
}
