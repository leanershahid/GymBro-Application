using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.Billing;

public class Invoice : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong UserId { get; set; }
    public ulong? MembershipId { get; set; }
    public string InvoiceNo { get; set; } = default!;
    public InvoiceStatus Status { get; set; } = InvoiceStatus.Draft;
    public decimal Subtotal { get; set; }
    public decimal Tax { get; set; }
    public decimal Discount { get; set; }
    public decimal Total { get; set; }
    /// <summary>Sum of completed payments minus refunds.</summary>
    public decimal AmountPaid { get; set; }
    /// <summary>Line items: [{ description, unitPrice, quantity }].</summary>
    public System.Text.Json.JsonDocument? Items { get; set; }
    public string Currency { get; set; } = "USD";
    public DateOnly? DueDate { get; set; }
    public DateTime? PaidAt { get; set; }
    public string? Notes { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
    public Identity.User User { get; set; } = default!;
    public ICollection<Payment> Payments { get; set; } = [];

    // ── Invariants (ARCH-084). Methods, not properties, so the EF model is unchanged. ──

    /// <summary>What is still owed (never negative).</summary>
    public decimal BalanceDue() => Math.Max(0, Total - AmountPaid);

    /// <summary>Adds a completed payment's amount; settles the invoice once it is fully paid.</summary>
    public void AddPaidAmount(decimal amount, DateTime paidAtUtc)
    {
        AmountPaid += amount;
        if (AmountPaid >= Total)
        {
            Status = InvoiceStatus.Paid;
            PaidAt = paidAtUtc;
        }
    }

    /// <summary>Takes a refund off the paid amount: fully refunded → Refunded, partly → back to Sent.</summary>
    public void SubtractRefundedAmount(decimal amount)
    {
        AmountPaid = Math.Max(0, AmountPaid - amount);
        if (AmountPaid == 0) { Status = InvoiceStatus.Refunded; PaidAt = null; }
        else if (AmountPaid < Total) { Status = InvoiceStatus.Sent; PaidAt = null; }
    }
}
