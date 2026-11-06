namespace GymManagmentApplication.Domain.Entities.Membership;

// Member self-service (roadmap feature 4): a member asks to pause, cancel or change their gym
// membership. Mapping: Infrastructure/Data/Configurations/SelfServiceConfigurations.cs.

/// <summary>
/// A member's request to freeze, cancel or change plan. Created from the member app; decided
/// automatically (when the gym's rules allow it) or by staff from the "Membership requests" queue.
/// An approved request is carried out by the existing SubscriptionService logic, right away when
/// it is due, otherwise by MembershipRequestJob on its effective date.
/// </summary>
public class MembershipRequest : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong UserId { get; set; }
    public ulong MembershipId { get; set; }
    /// <summary>One of <see cref="MembershipRequestTypes"/>.</summary>
    public string Type { get; set; } = MembershipRequestTypes.Freeze;
    /// <summary>One of <see cref="MembershipRequestStatuses"/>.</summary>
    public string Status { get; set; } = MembershipRequestStatuses.Pending;
    /// <summary>Picker value (cancel: "moving", "price", "injury", …) — optional.</summary>
    public string? ReasonCode { get; set; }
    /// <summary>The member's own words (optional).</summary>
    public string? Reason { get; set; }
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
    /// <summary>Freeze: first frozen day. Cancel: last day of access. Change: the day the new plan applies.</summary>
    public DateOnly? EffectiveFrom { get; set; }
    /// <summary>Freeze: last frozen day. Unused for cancel / change.</summary>
    public DateOnly? EffectiveTo { get; set; }
    /// <summary>Change: the plan asked for.</summary>
    public ulong? NewPlanId { get; set; }
    /// <summary>Fee or charge quoted when the request was made (freeze fee, cancellation fee + uncovered days, upgrade difference).</summary>
    public decimal Fee { get; set; }
    /// <summary>The invoice raised for <see cref="Fee"/> once approved.</summary>
    public ulong? InvoiceId { get; set; }
    /// <summary>True when the gym's rules approved it without staff.</summary>
    public bool AutoApproved { get; set; }
    public ulong? DecidedBy { get; set; }
    public DateTime? DecidedAt { get; set; }
    public string? DecisionNote { get; set; }
    /// <summary>When the freeze / cancel / plan change was actually carried out on the membership.</summary>
    public DateTime? AppliedAt { get; set; }
    /// <summary>Freeze only: when the membership was unfrozen again at the end of the pause.</summary>
    public DateTime? CompletedAt { get; set; }

    public GymMembership Membership { get; set; } = default!;
}

public static class MembershipRequestTypes
{
    public const string Freeze = "freeze";
    public const string Cancel = "cancel";
    public const string Change = "change";
    public static readonly string[] All = [Freeze, Cancel, Change];
}

public static class MembershipRequestStatuses
{
    public const string Pending = "pending";
    public const string Approved = "approved";
    public const string Rejected = "rejected";
    public const string Withdrawn = "withdrawn";
    public static readonly string[] All = [Pending, Approved, Rejected, Withdrawn];
}
