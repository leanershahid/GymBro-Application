using GymManagmentApplication.Domain.Enums;
using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Communication;

public class Campaign : BaseEntity
{
    public ulong TenantId { get; set; }
    public string Name { get; set; } = default!;
    public CampaignType Type { get; set; }
    public CampaignStatus Status { get; set; } = CampaignStatus.Draft;
    public JsonDocument? Audience { get; set; }
    public JsonDocument? Content { get; set; }
    public DateTime? ScheduledAt { get; set; }
    public uint SentCount { get; set; }
    public uint OpenCount { get; set; }
    public uint ClickCount { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
}
