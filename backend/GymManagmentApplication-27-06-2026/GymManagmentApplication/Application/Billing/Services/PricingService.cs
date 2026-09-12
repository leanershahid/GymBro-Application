using System.Text.Json;
using GymManagmentApplication.Application.Billing.Interfaces;
using GymManagmentApplication.Application.Billing.Requests;
using GymManagmentApplication.Application.Billing.Responses;
using GymManagmentApplication.Domain.Entities.Billing;
using GymManagmentApplication.Domain.Entities.Platform;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Billing.Services;

public class PricingService(AppDbContext db) : IPricingService
{
    public async Task<List<PricingRuleResponse>> GetRulesAsync(ulong tenantId)
    {
        var rules = await db.PricingRules
            .Where(r => r.TenantId == tenantId && r.IsActive)
            .OrderBy(r => r.Priority).ToListAsync();
        return rules.Select(MapRule).ToList();
    }

    public async Task<PricingRuleResponse> CreateRuleAsync(CreatePricingRuleRequest request)
    {
        var id = (await db.PricingRules.MaxAsync(r => (ulong?)r.Id) ?? 0) + 1;
        var rule = new PricingRule
        {
            Id = id, TenantId = request.TenantId, Name = request.Name,
            RuleType = Enum.TryParse<PricingRuleType>(request.RuleType, true, out var rt)
                ? rt : PricingRuleType.Promotional,
            Conditions = JsonDocument.Parse(request.Condition ?? "{}"),
            PriceModifier = request.Modifier,
            ModifierType = Enum.TryParse<PriceModifierType>(request.ModifierType, true, out var mt)
                ? mt : PriceModifierType.Percentage,
            ValidFrom = request.ValidFrom, ValidUntil = request.ValidUntil,
            IsActive = request.IsActive, CreatedAt = DateTime.UtcNow
        };
        db.PricingRules.Add(rule);
        await db.SaveChangesAsync();
        return MapRule(rule);
    }

    public async Task<PricingRuleResponse?> UpdateRuleAsync(ulong id, UpdatePricingRuleRequest request)
    {
        var rule = await db.PricingRules.FindAsync(id);
        if (rule is null) return null;
        if (request.Name is not null) rule.Name = request.Name;
        if (request.Modifier.HasValue) rule.PriceModifier = request.Modifier.Value;
        if (request.ValidFrom.HasValue) rule.ValidFrom = request.ValidFrom;
        if (request.ValidUntil.HasValue) rule.ValidUntil = request.ValidUntil;
        if (request.IsActive.HasValue) rule.IsActive = request.IsActive.Value;
        await db.SaveChangesAsync();
        return MapRule(rule);
    }

    public async Task<bool> DeleteRuleAsync(ulong id)
    {
        var rule = await db.PricingRules.FindAsync(id);
        if (rule is null) return false;
        db.PricingRules.Remove(rule);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<CalculatedPriceResponse> CalculateAsync(CalculatePriceRequest request)
    {
        var plan = await db.MembershipPlans.FindAsync(request.PlanId);
        decimal original = plan?.Price ?? 0;
        decimal final = original;
        var applied = new List<string>();

        // Apply active pricing rules
        var rules = await db.PricingRules
            .Where(r => r.TenantId == request.TenantId && r.IsActive)
            .OrderBy(r => r.Priority).ToListAsync();
        foreach (var rule in rules)
        {
            if (rule.ModifierType == PriceModifierType.Percentage)
                final -= final * (rule.PriceModifier / 100);
            else
                final -= rule.PriceModifier;
            applied.Add(rule.Name);
        }

        // Apply discount code
        if (!string.IsNullOrWhiteSpace(request.DiscountCode))
        {
            var coupon = await db.Coupons.FirstOrDefaultAsync(c =>
                c.TenantId == request.TenantId && c.Code == request.DiscountCode && c.IsActive);
            if (coupon is not null)
            {
                if (coupon.Type == CouponType.Percentage)
                    final -= final * (coupon.Value / 100);
                else
                    final -= coupon.Value;
                applied.Add($"COUPON:{coupon.Code}");
            }
        }

        final = Math.Max(0, final);
        return new CalculatedPriceResponse
        {
            PlanId = request.PlanId, OriginalPrice = original,
            FinalPrice = final, DiscountAmount = original - final,
            Currency = plan?.Currency ?? "USD", AppliedRules = applied
        };
    }

    public async Task<List<DiscountResponse>> GetDiscountsAsync(ulong tenantId)
    {
        var coupons = await db.Coupons
            .Where(c => c.TenantId == tenantId && c.IsActive)
            .ToListAsync();
        return coupons.Select(MapDiscount).ToList();
    }

    public async Task<DiscountResponse> CreateDiscountAsync(CreateDiscountRequest request)
    {
        var id = (await db.Coupons.MaxAsync(c => (ulong?)c.Id) ?? 0) + 1;
        var coupon = new Coupon
        {
            Id = id, TenantId = request.TenantId, Code = request.Code.ToUpper(),
            Type = Enum.TryParse<CouponType>(request.DiscountType, true, out var ct)
                ? ct : CouponType.Percentage,
            Value = request.Value,
            MaxUses = request.MaxUses.HasValue ? (uint)request.MaxUses.Value : null,
            ValidUntil = request.ExpiresAt, IsActive = true, UsesCount = 0
        };
        db.Coupons.Add(coupon);
        await db.SaveChangesAsync();
        return MapDiscount(coupon);
    }

    public async Task<ValidateDiscountResponse> ValidateDiscountAsync(ValidateDiscountRequest request)
    {
        var plan = await db.MembershipPlans.FindAsync(request.PlanId);
        decimal original = plan?.Price ?? 0;

        var coupon = await db.Coupons.FirstOrDefaultAsync(c =>
            c.TenantId == request.TenantId && c.Code == request.Code.ToUpper() && c.IsActive);

        if (coupon is null)
            return new ValidateDiscountResponse { Code = request.Code, IsValid = false,
                InvalidReason = "Code not found or expired.", OriginalPrice = original,
                DiscountedPrice = original, DiscountAmount = 0 };

        if (coupon.ValidUntil.HasValue && coupon.ValidUntil < DateTime.UtcNow)
            return new ValidateDiscountResponse { Code = request.Code, IsValid = false,
                InvalidReason = "Code has expired.", OriginalPrice = original,
                DiscountedPrice = original, DiscountAmount = 0 };

        decimal discount = coupon.Type == CouponType.Percentage
            ? original * (coupon.Value / 100) : coupon.Value;
        decimal final = Math.Max(0, original - discount);

        return new ValidateDiscountResponse
        {
            Code = request.Code, IsValid = true,
            OriginalPrice = original, DiscountedPrice = final,
            DiscountAmount = discount
        };
    }

    private static PricingRuleResponse MapRule(PricingRule r) => new()
    {
        Id = r.Id, TenantId = r.TenantId, Name = r.Name,
        RuleType = r.RuleType.ToString(), Modifier = r.PriceModifier,
        ModifierType = r.ModifierType.ToString(),
        ValidFrom = r.ValidFrom, ValidUntil = r.ValidUntil, IsActive = r.IsActive
    };

    private static DiscountResponse MapDiscount(Coupon c) => new()
    {
        Id = c.Id, Code = c.Code, DiscountType = c.Type.ToString(),
        Value = c.Value, MaxUses = (int?)c.MaxUses,
        UsedCount = (int)c.UsesCount, ExpiresAt = c.ValidUntil, IsValid = c.IsActive
    };
}
