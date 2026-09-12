namespace GymManagmentApplication.Application.Billing.Requests;

// ── Invoices ─────────────────────────────────────────────────────────────────
public class GenerateInvoiceRequest
{
    public ulong TenantId { get; set; }
    public ulong MemberId { get; set; }
    public List<InvoiceLineItem> Items { get; set; } = [];
    public string? Notes { get; set; }
    public DateOnly? DueDate { get; set; }
}

public class InvoiceLineItem
{
    public string Description { get; set; } = default!;
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; } = 1;
}

public class SendInvoiceRequest
{
    public string? AdditionalMessage { get; set; }
}

public class InvoiceListRequest
{
    public ulong? TenantId { get; set; }
    public ulong? MemberId { get; set; }
    public string? Status { get; set; } // paid | unpaid | overdue
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

// ── Dynamic Pricing ───────────────────────────────────────────────────────────
public class CreatePricingRuleRequest
{
    public ulong TenantId { get; set; }
    public string Name { get; set; } = default!;
    public string RuleType { get; set; } = default!; // time-based | demand-based | promotional
    public decimal Modifier { get; set; }       // e.g. -10 for 10% discount, +5 for 5% surcharge
    public string ModifierType { get; set; } = "percentage"; // percentage | fixed
    public string? Condition { get; set; }      // JSON condition string
    public DateTime? ValidFrom { get; set; }
    public DateTime? ValidUntil { get; set; }
    public bool IsActive { get; set; } = true;
}

public class UpdatePricingRuleRequest
{
    public string? Name { get; set; }
    public decimal? Modifier { get; set; }
    public DateTime? ValidFrom { get; set; }
    public DateTime? ValidUntil { get; set; }
    public bool? IsActive { get; set; }
}

public class CalculatePriceRequest
{
    public ulong TenantId { get; set; }
    public ulong PlanId { get; set; }
    public ulong? MemberId { get; set; }
    public string? DiscountCode { get; set; }
}

public class CreateDiscountRequest
{
    public ulong TenantId { get; set; }
    public string Code { get; set; } = default!;
    public string DiscountType { get; set; } = "percentage"; // percentage | fixed
    public decimal Value { get; set; }
    public int? MaxUses { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public List<ulong>? ApplicablePlanIds { get; set; }
}

public class ValidateDiscountRequest
{
    public ulong TenantId { get; set; }
    public string Code { get; set; } = default!;
    public ulong PlanId { get; set; }
    public ulong? MemberId { get; set; }
}
