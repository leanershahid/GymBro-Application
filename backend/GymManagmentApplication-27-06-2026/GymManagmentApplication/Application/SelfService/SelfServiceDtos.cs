using GymManagmentApplication.Application.Billing.Responses;

namespace GymManagmentApplication.Application.SelfService;

// ── Plan browser ────────────────────────────────────────────────────────────

/// <summary>A plan as the member app's comparison cards show it (public, active plans only).</summary>
public class PublicPlanResponse
{
    public ulong Id { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public string Currency { get; set; } = "INR";
    /// <summary>Daily | Weekly | Monthly | Quarterly | HalfYearly | Yearly | OneTime</summary>
    public string BillingCycle { get; set; } = "";
    public int DurationDays { get; set; }
    public decimal JoiningFee { get; set; }
    public int? ClassCredits { get; set; }
    public int? PtSessions { get; set; }
    public string? AccessHours { get; set; }
    /// <summary>Branch the plan is limited to (null = every branch).</summary>
    public ulong? BranchId { get; set; }
    public string? BranchName { get; set; }
    public List<string> Features { get; set; } = [];
    public bool IsPopular { get; set; }
    public byte TrialDays { get; set; }
    /// <summary>The member's current plan (change-plan screen).</summary>
    public bool IsCurrent { get; set; }
}

/// <summary>The gym's rules, as shown to members (read-only on the apps).</summary>
public class MemberRulesResponse
{
    public int MinimumTermMonths { get; set; }
    public int NoticeDays { get; set; }
    public int MaxFreezeDaysPerYear { get; set; }
    public int MinFreezeDays { get; set; }
    public decimal FreezeFee { get; set; }
    public decimal CancellationFee { get; set; }
    public bool AllowSelfCancel { get; set; }
    public bool AllowOnlineJoin { get; set; }
    public decimal TaxPercent { get; set; }
    public int MaxStartDaysAhead { get; set; }
    public bool FreezeNeedsApproval { get; set; }
    public bool CancelNeedsApproval { get; set; }
    public bool ChangeNeedsApproval { get; set; }

    public static MemberRulesResponse From(MembershipRulesSettings s) => new()
    {
        MinimumTermMonths = s.MinimumTermMonths, NoticeDays = s.NoticeDays, MaxFreezeDaysPerYear = s.MaxFreezeDaysPerYear,
        MinFreezeDays = s.MinFreezeDays, FreezeFee = s.FreezeFee, CancellationFee = s.CancellationFee,
        AllowSelfCancel = s.AllowSelfCancel, AllowOnlineJoin = s.AllowOnlineJoin, TaxPercent = s.TaxPercent,
        MaxStartDaysAhead = s.MaxStartDaysAhead,
        FreezeNeedsApproval = !s.AutoApproves(Domain.Entities.Membership.MembershipRequestTypes.Freeze),
        CancelNeedsApproval = !s.AutoApproves(Domain.Entities.Membership.MembershipRequestTypes.Cancel),
        ChangeNeedsApproval = !s.AutoApproves(Domain.Entities.Membership.MembershipRequestTypes.Change),
    };
}

public class PlanCatalogResponse
{
    public List<PublicPlanResponse> Plans { get; set; } = [];
    public MemberRulesResponse Rules { get; set; } = new();
    /// <summary>The gym takes online payments (Razorpay); otherwise the member pays at the front desk.</summary>
    public bool OnlinePayments { get; set; }
    public string Currency { get; set; } = "INR";
}

// ── Join / buy ──────────────────────────────────────────────────────────────

public class JoinQuoteRequest
{
    public ulong PlanId { get; set; }
    /// <summary>First day of the membership; null = today (gym time).</summary>
    public DateOnly? StartDate { get; set; }
    public string? CouponCode { get; set; }
}

public class CheckoutRequest : JoinQuoteRequest
{
    /// <summary>The "I agree to the membership terms" checkbox. Recorded as a terms consent.</summary>
    public bool AcceptTerms { get; set; }
    public string? TermsVersion { get; set; }
}

public class QuoteLine
{
    public string Label { get; set; } = "";
    public decimal Amount { get; set; }
    /// <summary>plan · joining_fee · discount · tax · fee · charge</summary>
    public string Kind { get; set; } = "";
}

/// <summary>Server-side price for joining: what the review screen shows and the invoice will say.</summary>
public class JoinQuoteResponse
{
    public ulong PlanId { get; set; }
    public string PlanName { get; set; } = "";
    public string BillingCycle { get; set; } = "";
    public int DurationDays { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string Currency { get; set; } = "INR";
    public List<QuoteLine> Lines { get; set; } = [];
    public decimal PlanPrice { get; set; }
    public decimal JoiningFee { get; set; }
    public decimal Subtotal { get; set; }
    public string? CouponCode { get; set; }
    public bool CouponApplied { get; set; }
    /// <summary>Why a typed coupon didn't apply (plain language), or what it gave.</summary>
    public string? CouponMessage { get; set; }
    public decimal Discount { get; set; }
    public decimal TaxPercent { get; set; }
    public decimal Tax { get; set; }
    public decimal Total { get; set; }
    /// <summary>What each renewal costs (plan price + tax; no joining fee or coupon).</summary>
    public decimal RenewalPrice { get; set; }
    public bool OnlinePayments { get; set; }
    /// <summary>Safety steps still open ("waiver", "health", …): the join flow runs the safety flow for these.</summary>
    public List<string> SafetyMissing { get; set; } = [];
    /// <summary>The gym's safety gating is on: checkout is refused until the safety steps are done.</summary>
    public bool SafetyRequired { get; set; }
    public MemberRulesResponse Rules { get; set; } = new();
}

public class CheckoutResponse
{
    public SubscriptionResponse Membership { get; set; } = default!;
    public InvoiceResponse Invoice { get; set; } = default!;
    public JoinQuoteResponse Quote { get; set; } = default!;
    /// <summary>Razorpay order to open Checkout with; null when paying at the desk or nothing is due.</summary>
    public OnlineOrderResponse? Order { get; set; }
    /// <summary>No online gateway: the invoice waits at the front desk and staff were told.</summary>
    public bool PayAtDesk { get; set; }
    /// <summary>Nothing to pay (e.g. a 100% coupon): the membership is already active.</summary>
    public bool Activated { get; set; }
    /// <summary>An unpaid checkout for the same plan and date was reused instead of creating a second one.</summary>
    public bool Reused { get; set; }
}

// ── My membership ───────────────────────────────────────────────────────────

public class MyMembershipResponse
{
    /// <summary>The membership the member is on (active / paused / trial / pending), or null.</summary>
    public SubscriptionResponse? Current { get; set; }
    public PublicPlanResponse? Plan { get; set; }
    public MemberRulesResponse Rules { get; set; } = new();
    public int FreezeDaysUsedThisYear { get; set; }
    public int FreezeDaysLeftThisYear { get; set; }
    /// <summary>What cancelling today would mean (null without a cancellable membership).</summary>
    public CancelPreview? CancelPreview { get; set; }
    public List<MembershipRequestResponse> OpenRequests { get; set; } = [];
    /// <summary>Unpaid invoice of a pending (not yet paid) membership, for "Finish paying".</summary>
    public InvoiceResponse? PendingInvoice { get; set; }
    public bool CanFreeze { get; set; }
    public bool CanCancel { get; set; }
    public bool CanChangePlan { get; set; }
    public bool OnlinePayments { get; set; }
}

public class CancelPreview
{
    public DateOnly LastDay { get; set; }
    public DateOnly? NoticeEnd { get; set; }
    public DateOnly? MinimumTermEnd { get; set; }
    public DateOnly? PaidThrough { get; set; }
    public int UncoveredDays { get; set; }
    public decimal UncoveredCharge { get; set; }
    public decimal CancellationFee { get; set; }
    public decimal FinalCharge { get; set; }
    public string Currency { get; set; } = "INR";
}

// ── Requests ────────────────────────────────────────────────────────────────

public class CreateMembershipRequestRequest
{
    /// <summary>freeze | cancel | change</summary>
    public string Type { get; set; } = "";
    /// <summary>Defaults to the member's current membership.</summary>
    public ulong? MembershipId { get; set; }
    /// <summary>Freeze: first and last paused day.</summary>
    public DateOnly? From { get; set; }
    public DateOnly? To { get; set; }
    /// <summary>Change: the plan to move to.</summary>
    public ulong? NewPlanId { get; set; }
    public string? ReasonCode { get; set; }
    public string? Reason { get; set; }
}

/// <summary>What a request would do, shown before the member confirms (nothing is saved).</summary>
public class MembershipRequestPreview
{
    public string Type { get; set; } = "";
    public bool Allowed { get; set; }
    /// <summary>Plain-language reason it isn't allowed.</summary>
    public string? Problem { get; set; }
    public bool NeedsApproval { get; set; }
    public DateOnly? EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public int? Days { get; set; }
    public decimal Fee { get; set; }
    public string Currency { get; set; } = "INR";
    public List<QuoteLine> Lines { get; set; } = [];
    /// <summary>One or two sentences: what happens, when, and what it costs.</summary>
    public string Summary { get; set; } = "";
    /// <summary>Change only: "upgrade" (now, pro-rated) or "downgrade" (at renewal).</summary>
    public string? ChangeKind { get; set; }
    public string? NewPlanName { get; set; }
    /// <summary>Cancel only: a pause is allowed, so the app can offer "Pause instead?".</summary>
    public bool CanPauseInstead { get; set; }
    public int FreezeDaysLeft { get; set; }
    public CancelPreview? Cancel { get; set; }
}

public class MembershipRequestResponse
{
    public ulong Id { get; set; }
    public ulong MembershipId { get; set; }
    public ulong MemberId { get; set; }
    public string? MemberName { get; set; }
    public string? PlanName { get; set; }
    public string Type { get; set; } = "";
    public string Status { get; set; } = "";
    public string? ReasonCode { get; set; }
    public string? Reason { get; set; }
    public DateTime RequestedAt { get; set; }
    public DateOnly? EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public ulong? NewPlanId { get; set; }
    public string? NewPlanName { get; set; }
    public decimal Fee { get; set; }
    public string Currency { get; set; } = "INR";
    public ulong? InvoiceId { get; set; }
    public bool AutoApproved { get; set; }
    public ulong? DecidedBy { get; set; }
    public string? DecidedByName { get; set; }
    public DateTime? DecidedAt { get; set; }
    public string? DecisionNote { get; set; }
    public DateTime? AppliedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? MembershipStatus { get; set; }
}

public class DecideMembershipRequestRequest
{
    public string? Note { get; set; }
}
