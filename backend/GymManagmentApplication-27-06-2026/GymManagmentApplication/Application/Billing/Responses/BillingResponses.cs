namespace GymManagmentApplication.Application.Billing.Responses;

public class MembershipPlanResponse
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public string Currency { get; set; } = default!;
    public string BillingCycle { get; set; } = default!;
    public int DurationDays { get; set; }
    public List<string> Features { get; set; } = [];
    public bool IsPublic { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class SubscriptionResponse
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong MemberId { get; set; }
    public ulong PlanId { get; set; }
    public string PlanName { get; set; } = default!;
    public string Status { get; set; } = default!; // Active | Frozen | Cancelled | Expired
    public DateOnly StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public DateOnly? FrozenFrom { get; set; }
    public DateOnly? FrozenUntil { get; set; }
    public DateOnly? NextRenewalDate { get; set; }
    public decimal Price { get; set; }
    public string Currency { get; set; } = default!;
    public DateTime CreatedAt { get; set; }
}

public class SubscriptionUsageResponse
{
    public ulong SubscriptionId { get; set; }
    public int ClassBookingsUsed { get; set; }
    public int PtSessionsUsed { get; set; }
    public int DaysActive { get; set; }
    public int DaysRemaining { get; set; }
}

public class PaymentResponse
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong MemberId { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = default!;
    public string Status { get; set; } = default!; // succeeded | failed | pending | refunded
    public string? Description { get; set; }
    public string? GatewayRef { get; set; }
    public DateTime PaidAt { get; set; }
}

public class PaymentMethodResponse
{
    public ulong Id { get; set; }
    public string Type { get; set; } = default!;
    public string Provider { get; set; } = default!;
    public string? Last4 { get; set; }
    public string? Brand { get; set; }
    public bool IsDefault { get; set; }
    public DateTime AddedAt { get; set; }
}

public class PaymentIntentResponse
{
    public string ClientSecret { get; set; } = default!;
    public string IntentId { get; set; } = default!;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = default!;
    public string Provider { get; set; } = default!;
}

public class InvoiceResponse
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong MemberId { get; set; }
    public decimal Subtotal { get; set; }
    public decimal Tax { get; set; }
    public decimal Discount { get; set; }
    public decimal Total { get; set; }
    public string Currency { get; set; } = default!;
    public string Status { get; set; } = default!;
    public DateOnly? DueDate { get; set; }
    public DateTime IssuedAt { get; set; }
    public string? Notes { get; set; }
}

public class PricingRuleResponse
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public string Name { get; set; } = default!;
    public string RuleType { get; set; } = default!;
    public decimal Modifier { get; set; }
    public string ModifierType { get; set; } = default!;
    public DateTime? ValidFrom { get; set; }
    public DateTime? ValidUntil { get; set; }
    public bool IsActive { get; set; }
}

public class CalculatedPriceResponse
{
    public ulong PlanId { get; set; }
    public decimal OriginalPrice { get; set; }
    public decimal FinalPrice { get; set; }
    public decimal DiscountAmount { get; set; }
    public string Currency { get; set; } = default!;
    public List<string> AppliedRules { get; set; } = [];
}

public class DiscountResponse
{
    public ulong Id { get; set; }
    public string Code { get; set; } = default!;
    public string DiscountType { get; set; } = default!;
    public decimal Value { get; set; }
    public int? MaxUses { get; set; }
    public int UsedCount { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public bool IsValid { get; set; }
}

public class ValidateDiscountResponse
{
    public string Code { get; set; } = default!;
    public bool IsValid { get; set; }
    public string? InvalidReason { get; set; }
    public decimal OriginalPrice { get; set; }
    public decimal DiscountedPrice { get; set; }
    public decimal DiscountAmount { get; set; }
}
