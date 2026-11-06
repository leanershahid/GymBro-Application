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

    // ── Online sales (member self-service, feature 4) ──
    /// <summary>Offered in the member app's plan browser / join flow. Hidden plans can still be sold at the desk.</summary>
    public bool IsPublic { get; set; } = true;
    /// <summary>Shown with a "Most popular" badge in the plan browser.</summary>
    public bool IsPopular { get; set; }
    /// <summary>One-off fee added to a new member's first invoice (0 = none).</summary>
    public decimal JoiningFee { get; set; }
    /// <summary>Class credits per billing period (null = not limited / not stated).</summary>
    public int? ClassCredits { get; set; }
    /// <summary>PT sessions included per billing period (null = none stated).</summary>
    public int? PtSessions { get; set; }
    /// <summary>Free-text access hours, e.g. "24/7" or "6am–11am weekdays".</summary>
    public string? AccessHours { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
    public Core.Branch? Branch { get; set; }
    public ICollection<GymMembership> Memberships { get; set; } = [];
}
