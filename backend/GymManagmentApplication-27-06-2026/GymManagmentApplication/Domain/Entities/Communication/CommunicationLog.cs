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

    public Core.Tenant Tenant { get; set; } = default!;
    public Campaign? Campaign { get; set; }
}
