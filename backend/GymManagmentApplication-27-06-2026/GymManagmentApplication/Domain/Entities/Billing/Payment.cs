using GymManagmentApplication.Domain.Enums;
using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Billing;

public class Payment
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong InvoiceId { get; set; }
    public ulong? GatewayId { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "USD";
    public PaymentMethod Method { get; set; }
    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;
    public string? GatewayRef { get; set; }
    /// <summary>Receipt / UPI transaction / cheque number entered at the desk.</summary>
    public string? Reference { get; set; }
    public decimal RefundedAmount { get; set; }
    public string? Notes { get; set; }
    /// <summary>Staff member who recorded it (null for online payments).</summary>
    public ulong? RecordedBy { get; set; }
    public JsonDocument? GatewayResponse { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Core.Tenant Tenant { get; set; } = default!;
    public Invoice Invoice { get; set; } = default!;
    public PaymentGateway? Gateway { get; set; }
}
