using GymManagmentApplication.Domain.Enums;
using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Membership;

public class MembershipPlan : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong? BranchId { get; set; }
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public BillingCycle BillingCycle { get; set; }
    public decimal Price { get; set; }
    public string Currency { get; set; } = "USD";
    public byte TrialDays { get; set; }
    public uint? MaxMembers { get; set; }
    public JsonDocument? Features { get; set; }
    public bool IsActive { get; set; } = true;
    public ushort SortOrder { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
    public Core.Branch? Branch { get; set; }
    public ICollection<GymMembership> Memberships { get; set; } = [];
}
