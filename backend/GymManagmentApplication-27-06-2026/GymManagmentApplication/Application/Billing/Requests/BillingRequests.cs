namespace GymManagmentApplication.Application.Billing.Requests;

// ── Membership Plans ─────────────────────────────────────────────────────────
public class CreateMembershipPlanRequest
{
    public ulong TenantId { get; set; }
    /// <summary>Optional branch; must belong to the same gym.</summary>
    public ulong? BranchId { get; set; }
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
    /// <summary>Optional branch; must belong to the same gym.</summary>
    public ulong? BranchId { get; set; }
    public ulong MemberId { get; set; }
    public ulong PlanId { get; set; }
    public DateOnly StartDate { get; set; }
    public ulong? PaymentMethodId { get; set; }
    /// <summary>Tax % on the invoice raised for the plan (e.g. 18 for GST).</summary>
    public decimal TaxPercent { get; set; }
    public decimal Discount { get; set; }
    /// <summary>Paid at the desk right away: cash | upi | card | netbanking | cheque | wallet. Empty = invoice left due.</summary>
    public string? PayNowMethod { get; set; }
    public string? PaymentReference { get; set; }
}

public class RenewSubscriptionRequest
{
    public decimal TaxPercent { get; set; }
    public decimal Discount { get; set; }
    public string? PayNowMethod { get; set; }
    public string? PaymentReference { get; set; }
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
/// <summary>
/// A payment taken at the desk. With InvoiceId it pays (part of) that invoice; without, an
/// invoice for Amount/Description is created and paid in one go.
/// </summary>
public class ChargeRequest
{
    public ulong TenantId { get; set; }
    public ulong MemberId { get; set; }
    public ulong? InvoiceId { get; set; }
    public decimal Amount { get; set; }
    public string? Currency { get; set; }
    public string? Description { get; set; }
    public ulong? PaymentMethodId { get; set; }
    /// <summary>cash | upi | card | netbanking | cheque | wallet</summary>
    public string Method { get; set; } = "cash";
    /// <summary>Receipt / UPI transaction id / cheque number.</summary>
    public string? Reference { get; set; }
    public string? Notes { get; set; }
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
    /// <summary>The invoice to pay online; Amount defaults to its balance.</summary>
    public ulong InvoiceId { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "USD";
    public string Provider { get; set; } = "razorpay";
}

/// <summary>What Razorpay Checkout returns after a successful payment.</summary>
public class VerifyOnlinePaymentRequest
{
    public ulong InvoiceId { get; set; }
    public string OrderId { get; set; } = default!;
    public string PaymentId { get; set; } = default!;
    public string Signature { get; set; } = default!;
}

public class SaveGatewayRequest
{
    public string KeyId { get; set; } = default!;
    /// <summary>Leave empty to keep the stored secret.</summary>
    public string? KeySecret { get; set; }
    public bool IsActive { get; set; } = true;
}

public class PaymentReminderRequest
{
    public ulong MemberId { get; set; }
    public string? Message { get; set; }
    public string Channel { get; set; } = "email";
}
