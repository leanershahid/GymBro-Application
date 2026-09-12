using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.Membership;

public class GymMembership : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong UserId { get; set; }
    public ulong PlanId { get; set; }
    public ulong? BranchId { get; set; }
    public MembershipStatus Status { get; set; } = MembershipStatus.Pending;
    public DateOnly StartsAt { get; set; }
    public DateOnly? EndsAt { get; set; }
    public DateTime? PausedAt { get; set; }
    public DateTime? CancelledAt { get; set; }
    public bool AutoRenew { get; set; } = true;
    public MembershipSource Source { get; set; } = MembershipSource.Online;
    public ulong? CorporateId { get; set; }
    public string? Notes { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
    public Identity.User User { get; set; } = default!;
    public MembershipPlan Plan { get; set; } = default!;
    public Core.Branch? Branch { get; set; }
    public CorporateAccount? Corporate { get; set; }
}
