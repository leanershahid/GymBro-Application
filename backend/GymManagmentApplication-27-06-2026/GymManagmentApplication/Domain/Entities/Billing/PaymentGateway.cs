using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Billing;

public class PaymentGateway
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public string Provider { get; set; } = default!;
    public JsonDocument ConfigEnc { get; set; } = default!;
    public bool IsActive { get; set; } = true;
    public bool IsDefault { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
    public ICollection<Payment> Payments { get; set; } = [];
}
