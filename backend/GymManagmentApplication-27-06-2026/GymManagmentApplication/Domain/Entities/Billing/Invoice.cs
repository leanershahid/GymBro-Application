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
    public string Currency { get; set; } = "USD";
    public DateOnly? DueDate { get; set; }
    public DateTime? PaidAt { get; set; }
    public string? Notes { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
    public Identity.User User { get; set; } = default!;
    public ICollection<Payment> Payments { get; set; } = [];
}
