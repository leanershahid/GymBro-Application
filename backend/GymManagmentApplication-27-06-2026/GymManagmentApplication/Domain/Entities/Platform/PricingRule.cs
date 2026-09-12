using GymManagmentApplication.Domain.Enums;
using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Platform;

public class PricingRule
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public string Name { get; set; } = default!;
    public PricingAppliesTo AppliesTo { get; set; }
    public ulong? EntityId { get; set; }
    public PricingRuleType RuleType { get; set; }
    public JsonDocument Conditions { get; set; } = default!;
    public decimal PriceModifier { get; set; }
    public PriceModifierType ModifierType { get; set; } = PriceModifierType.Percentage;
    public byte Priority { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime? ValidFrom { get; set; }
    public DateTime? ValidUntil { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Core.Tenant Tenant { get; set; } = default!;
}
