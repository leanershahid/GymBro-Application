using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Communication;

public class Webhook
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public string Url { get; set; } = default!;
    public string? SecretHash { get; set; }
    public JsonDocument Events { get; set; } = default!;
    public bool IsActive { get; set; } = true;
    public byte FailureCount { get; set; }
    public DateTime? LastFiredAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Core.Tenant Tenant { get; set; } = default!;
    public ICollection<WebhookDelivery> Deliveries { get; set; } = [];
}
