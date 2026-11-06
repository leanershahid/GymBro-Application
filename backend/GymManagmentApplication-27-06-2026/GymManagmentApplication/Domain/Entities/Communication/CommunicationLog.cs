using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.Communication;

public class CommunicationLog
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong? UserId { get; set; }
    public CommunicationChannel Channel { get; set; }
    public CommunicationDirection Direction { get; set; } = CommunicationDirection.Outbound;
    public string Recipient { get; set; } = default!;
    public string? Subject { get; set; }
    public string? Body { get; set; }
    public CommunicationStatus Status { get; set; } = CommunicationStatus.Queued;
    public string? ProviderRef { get; set; }
    public ulong? CampaignId { get; set; }
    public decimal? Cost { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? DeliveredAt { get; set; }
    /// <summary>Delivery attempts made by the email outbox (Status stays Queued until sent or given up).</summary>
    public int Attempts { get; set; }
    /// <summary>Push outbox: payload and delivery details ({kind, refId, route, category, urgent, expiresAt, tickets, reason}).</summary>
    public System.Text.Json.JsonDocument? Meta { get; set; }
    /// <summary>Push outbox: not sent before this instant (quiet hours defer a row by setting it).</summary>
    public DateTime? NotBefore { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
}
