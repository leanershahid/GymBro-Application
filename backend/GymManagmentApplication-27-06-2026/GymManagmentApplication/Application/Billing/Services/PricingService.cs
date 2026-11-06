using System.Text.Json;
using GymManagmentApplication.Application.Billing.Interfaces;
using GymManagmentApplication.Application.Billing.Requests;
using GymManagmentApplication.Application.Billing.Responses;
using GymManagmentApplication.Domain.Entities.Billing;
using GymManagmentApplication.Domain.Entities.Platform;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Application.Common;
using Microsoft.EntityFrameworkCore;


namespace GymManagmentApplication.Application.Billing.Services;

public class PricingService(IAppDbContext db, ICurrentUser currentUser) : IPricingService
{
    public async Task<List<PricingRuleResponse>> GetRulesAsync(ulong tenantId)
    {
        tenantId = currentUser.ResolveTenantId(tenantId);
        var rules = await db.PricingRules
            .Where(r => r.TenantId == tenantId && r.IsActive)
            .OrderBy(r => r.Priority).ToListAsync();
        return rules.Select(MapRule).ToList();
    }

    public async Task<PricingRuleResponse?> GetRuleAsync(ulong id) =>
        await db.PricingRules.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id) is { } rule ? MapRule(rule) : null;

    public async Task<DiscountResponse?> GetDiscountAsync(ulong id) =>
        await db.Coupons.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id) is { } coupon ? MapDiscount(coupon) : null;

    public async Task<PricingRuleResponse> CreateRuleAsync(CreatePricingRuleRequest request)
    {
        request.TenantId = currentUser.ResolveTenantId(request.TenantId);
        var rule = new PricingRule
        {
            TenantId = request.TenantId, Name = request.Name,
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
        request.TenantId = currentUser.ResolveTenantId(request.TenantId);
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

        final = Math.Max(0, final);

        // Apply discount code — same rules as the shop (CouponRules): expiry, start date, usage
        // limit, minimum order and maximum discount all apply; codes are case-insensitive.
        var currency = plan?.Currency ?? await TenantCurrencyAsync(request.TenantId);
        if (!string.IsNullOrWhiteSpace(request.DiscountCode))
        {
            var coupon = await FindCouponAsync(request.TenantId, request.DiscountCode);
            if (coupon is not null && CouponRules.Check(coupon, final, DateTime.UtcNow, currency) is null)
            {
                final -= CouponRules.CalculateDiscount(coupon, final);
                applied.Add($"COUPON:{coupon.Code}");
            }
        }

        final = Money.Round(Math.Max(0, final));
        return new CalculatedPriceResponse
        {
            PlanId = request.PlanId, OriginalPrice = original,
            FinalPrice = final, DiscountAmount = original - final,
            Currency = currency, AppliedRules = applied
        };
    }

    private Task<Coupon?> FindCouponAsync(ulong tenantId, string code)
    {
        var normalized = CouponRules.NormalizeCode(code);
        return db.Coupons.AsNoTracking().FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Code == normalized);
    }

    private async Task<string> TenantCurrencyAsync(ulong tenantId) =>
        await db.Tenants.IgnoreQueryFilters().Where(t => t.Id == tenantId).Select(t => t.Currency).FirstOrDefaultAsync() ?? "INR";

    public async Task<List<DiscountResponse>> GetDiscountsAsync(ulong tenantId)
    {
        tenantId = currentUser.ResolveTenantId(tenantId);
        var coupons = await db.Coupons
            .Where(c => c.TenantId == tenantId && c.IsActive)
            .ToListAsync();
        return coupons.Select(MapDiscount).ToList();
    }

    public async Task<DiscountResponse> CreateDiscountAsync(CreateDiscountRequest request)
    {
        request.TenantId = currentUser.ResolveTenantId(request.TenantId);
        var code = CouponRules.NormalizeCode(request.Code);
        if (code.Length == 0) throw new ArgumentException("Enter a discount code.");
        if (await db.Coupons.AnyAsync(c => c.TenantId == request.TenantId && c.Code == code))
            throw RuleException.Conflict($"Discount code {code} already exists.");
        var coupon = new Coupon
        {
            TenantId = request.TenantId, Code = code,
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
        request.TenantId = currentUser.ResolveTenantId(request.TenantId);
        var plan = await db.MembershipPlans.FindAsync(request.PlanId);
        decimal original = plan?.Price ?? 0;

        var coupon = await FindCouponAsync(request.TenantId, request.Code);

        if (coupon is null)
            return new ValidateDiscountResponse { Code = request.Code, IsValid = false,
                InvalidReason = "Code not found or expired.", OriginalPrice = original,
                DiscountedPrice = original, DiscountAmount = 0 };

        // Shared with the shop (ARCH-015): active, start/end dates, usage limit, minimum order.
        var invalid = CouponRules.Check(coupon, original, DateTime.UtcNow, plan?.Currency);
        if (invalid is not null)
            return new ValidateDiscountResponse { Code = request.Code, IsValid = false,
                InvalidReason = invalid, OriginalPrice = original,
                DiscountedPrice = original, DiscountAmount = 0 };

        var discount = CouponRules.CalculateDiscount(coupon, original);
        var final = Money.Round(Math.Max(0, original - discount));

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
