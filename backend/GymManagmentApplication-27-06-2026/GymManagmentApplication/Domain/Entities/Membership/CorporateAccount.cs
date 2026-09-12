using GymManagmentApplication.Domain.Enums;
using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Membership;

public class CorporateAccount
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public string Name { get; set; } = default!;
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public JsonDocument? BillingInfo { get; set; }
    public uint? MaxMembers { get; set; }
    public CorporateStatus Status { get; set; } = CorporateStatus.Active;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
    public ICollection<GymMembership> Memberships { get; set; } = [];
}
