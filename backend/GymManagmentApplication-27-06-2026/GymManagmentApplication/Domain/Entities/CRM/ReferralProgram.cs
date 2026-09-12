using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.CRM;

public class ReferralProgram
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public string Name { get; set; } = default!;
    public JsonDocument? ReferrerReward { get; set; }
    public JsonDocument? RefereeReward { get; set; }
    public uint? MaxUses { get; set; }
    public uint UsesCount { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime? StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
    public ICollection<Referral> Referrals { get; set; } = [];
}
