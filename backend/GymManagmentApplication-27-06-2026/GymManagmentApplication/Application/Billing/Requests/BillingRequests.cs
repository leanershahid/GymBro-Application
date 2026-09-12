namespace GymManagmentApplication.Application.Billing.Requests;

// ── Membership Plans ─────────────────────────────────────────────────────────
public class CreateMembershipPlanRequest
{
    public ulong TenantId { get; set; }
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public string Currency { get; set; } = "USD";
    public string BillingCycle { get; set; } = "monthly"; // monthly | quarterly | annual
    public int DurationDays { get; set; }
    public List<string>? Features { get; set; }
    public bool IsPublic { get; set; } = true;
}

public class UpdateMembershipPlanRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public decimal? Price { get; set; }
    public string? BillingCycle { get; set; }
    public int? DurationDays { get; set; }
    public bool? IsPublic { get; set; }
    public bool? IsActive { get; set; }
}

public class UpdatePlanFeaturesRequest
{
    public List<string> Features { get; set; } = [];
}

// ── Subscriptions ────────────────────────────────────────────────────────────
public class CreateSubscriptionRequest
{
    public ulong TenantId { get; set; }
    public ulong MemberId { get; set; }
    public ulong PlanId { get; set; }
    public DateOnly StartDate { get; set; }
    public ulong? PaymentMethodId { get; set; }
}

public class FreezeSubscriptionRequest
{
    public DateOnly FreezeFrom { get; set; }
    public DateOnly FreezeUntil { get; set; }
    public string? Reason { get; set; }
}

public class UpgradeDowngradeRequest
{
    public ulong NewPlanId { get; set; }
    public DateOnly? EffectiveDate { get; set; }
}

// ── Payments ─────────────────────────────────────────────────────────────────
public class ChargeRequest
{
    public ulong TenantId { get; set; }
    public ulong MemberId { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "USD";
    public string? Description { get; set; }
    public ulong? PaymentMethodId { get; set; }
}

public class RefundRequest
{
    public ulong PaymentId { get; set; }
    public decimal? Amount { get; set; } // null = full refund
    public string? Reason { get; set; }
}

public class SavePaymentMethodRequest
{
    public ulong MemberId { get; set; }
    public string Type { get; set; } = default!; // card | upi | bank-account
    public string Provider { get; set; } = default!; // stripe | razorpay
    public string Token { get; set; } = default!;
    public bool SetAsDefault { get; set; }
}

public class CreatePaymentIntentRequest
{
    public ulong TenantId { get; set; }
    public ulong MemberId { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "USD";
    public string Provider { get; set; } = "stripe";
}

public class PaymentReminderRequest
{
    public ulong MemberId { get; set; }
    public string? Message { get; set; }
    public string Channel { get; set; } = "email";
}
