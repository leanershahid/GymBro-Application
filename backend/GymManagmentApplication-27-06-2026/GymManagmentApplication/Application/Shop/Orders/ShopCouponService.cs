using System.Text.RegularExpressions;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Shop.Common;
using GymManagmentApplication.Domain.Entities.Billing;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Shop.Orders;

public sealed record ShopCouponEvaluation(Coupon? Coupon, decimal Discount, string? Error)
{
    public bool IsValid => Coupon is not null && Error is null;
}

public interface IShopCouponService
{
    /// <summary>Evaluates a code against a subtotal without throwing.</summary>
    Task<ShopCouponEvaluation> EvaluateAsync(ulong tenantId, string code, decimal subtotal);
    Task<ShopCouponValidationDto> ValidateAsync(ShopValidateCouponRequest request);

    // Admin
    Task<IReadOnlyList<ShopCouponDto>> GetAllAsync();
    Task<ShopCouponDto> CreateAsync(ShopUpsertCouponRequest request);
    Task<ShopCouponDto> UpdateAsync(ulong id, ShopUpsertCouponRequest request);
    Task DeleteAsync(ulong id);
}

/// <summary>
/// Shop coupons, ported from the store's CouponService onto GymBro's shared <see cref="Coupon"/> table:
/// DiscountType → Type (Percentage / Fixed), MinOrderAmount → MinOrder (0 = none), MaxDiscountAmount →
/// MaxDiscount, StartsAt/EndsAt → ValidFrom/ValidUntil, UsageLimit/UsedCount → MaxUses/UsesCount.
/// </summary>
public sealed partial class ShopCouponService(AppDbContext db, ICurrentUser currentUser) : IShopCouponService
{
    private static readonly CouponType[] ShopTypes = [CouponType.Percentage, CouponType.Fixed];

    public static string NormalizeCode(string? code) => CouponRules.NormalizeCode(code);

    public async Task<ShopCouponEvaluation> EvaluateAsync(ulong tenantId, string code, decimal subtotal)
    {
        var normalized = NormalizeCode(code);
        var coupon = await db.Coupons.AsNoTracking().FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Code == normalized);
        if (coupon is null || !ShopTypes.Contains(coupon.Type)) return new ShopCouponEvaluation(null, 0, "Coupon code is invalid");

        var error = Check(coupon, subtotal, DateTime.UtcNow);
        return error is null
            ? new ShopCouponEvaluation(coupon, CalculateDiscount(coupon, subtotal), null)
            : new ShopCouponEvaluation(coupon, 0, error);
    }

    public async Task<ShopCouponValidationDto> ValidateAsync(ShopValidateCouponRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Code)) throw new ArgumentException("Enter a coupon code.");
        if (request.Code.Length > 40) throw new ArgumentException("Coupon code must be at most 40 characters.");
        if (request.Subtotal < 0) throw new ArgumentException("Subtotal can't be negative.");

        var result = await EvaluateAsync(currentUser.ResolveTenantId(), request.Code, request.Subtotal);
        if (!result.IsValid) throw ShopRuleException.Rule(result.Error!);

        return new ShopCouponValidationDto
        {
            Code = result.Coupon!.Code,
            Description = result.Coupon.Description,
            DiscountAmount = result.Discount
        };
    }

    // The rules themselves live in CouponRules, shared with membership pricing (ARCH-015).
    public static string? Check(Coupon coupon, decimal subtotal, DateTime now) => CouponRules.Check(coupon, subtotal, now, "INR");

    public static decimal CalculateDiscount(Coupon coupon, decimal subtotal) => CouponRules.CalculateDiscount(coupon, subtotal);

    // ---------- Admin ----------

    public async Task<IReadOnlyList<ShopCouponDto>> GetAllAsync()
    {
        var tid = currentUser.ResolveTenantId();
        var coupons = await db.Coupons.AsNoTracking()
            .Where(c => c.TenantId == tid && ShopTypes.Contains(c.Type))
            .OrderByDescending(c => c.CreatedAt).ThenByDescending(c => c.Id)
            .ToListAsync();
        return coupons.Select(ToDto).ToList();
    }

    public async Task<ShopCouponDto> CreateAsync(ShopUpsertCouponRequest request)
    {
        var code = Validate(request);
        var tid = currentUser.ResolveTenantId();
        if (await db.Coupons.AnyAsync(c => c.TenantId == tid && c.Code == code))
            throw ShopRuleException.Conflict($"Coupon code {code} already exists");

        var coupon = new Coupon { Id = 0, TenantId = tid };
        Apply(coupon, request, code);
        db.Coupons.Add(coupon);
        await db.SaveChangesAsync();
        return ToDto(coupon);
    }

    public async Task<ShopCouponDto> UpdateAsync(ulong id, ShopUpsertCouponRequest request)
    {
        var code = Validate(request);
        var tid = currentUser.ResolveTenantId();
        var coupon = await db.Coupons.FirstOrDefaultAsync(c => c.Id == id && c.TenantId == tid)
                     ?? throw new KeyNotFoundException("Coupon not found");
        if (code != coupon.Code && await db.Coupons.AnyAsync(c => c.TenantId == tid && c.Code == code && c.Id != id))
            throw ShopRuleException.Conflict($"Coupon code {code} already exists");

        Apply(coupon, request, code);
        coupon.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return ToDto(coupon);
    }

    /// <summary>
    /// The coupon table has no DeletedAt, so a coupon that was ever used (shop orders or billing
    /// redemptions keep pointing at it) is switched off instead; an unused one is removed.
    /// </summary>
    public async Task DeleteAsync(ulong id)
    {
        var tid = currentUser.ResolveTenantId();
        var coupon = await db.Coupons.FirstOrDefaultAsync(c => c.Id == id && c.TenantId == tid)
                     ?? throw new KeyNotFoundException("Coupon not found");

        var referenced = coupon.UsesCount > 0
                         || await db.ShopOrders.AnyAsync(o => o.CouponId == id)
                         || await db.CouponRedemptions.AnyAsync(r => r.CouponId == id);
        if (referenced)
        {
            coupon.IsActive = false;
            coupon.UpdatedAt = DateTime.UtcNow;
        }
        else db.Coupons.Remove(coupon);

        await db.SaveChangesAsync();
    }

    public static ShopCouponDto ToDto(Coupon c) => new()
    {
        Id = c.Id,
        Code = c.Code,
        Description = c.Description,
        DiscountType = c.Type,
        Value = c.Value,
        MinOrderAmount = c.MinOrder > 0 ? c.MinOrder : null,
        MaxDiscountAmount = c.MaxDiscount,
        StartsAt = c.ValidFrom,
        EndsAt = c.ValidUntil,
        UsageLimit = c.MaxUses,
        UsedCount = c.UsesCount,
        IsActive = c.IsActive,
        CreatedAt = c.CreatedAt
    };

    private static void Apply(Coupon coupon, ShopUpsertCouponRequest r, string code)
    {
        coupon.Code = code;
        coupon.Description = string.IsNullOrWhiteSpace(r.Description) ? null : r.Description.Trim();
        coupon.Type = r.DiscountType;
        coupon.Value = r.Value;
        coupon.MinOrder = r.MinOrderAmount ?? 0m;
        coupon.MaxDiscount = r.MaxDiscountAmount;
        coupon.ValidFrom = ToUtc(r.StartsAt);
        coupon.ValidUntil = ToUtc(r.EndsAt);
        coupon.MaxUses = r.UsageLimit.HasValue ? (uint)r.UsageLimit.Value : null;
        coupon.IsActive = r.IsActive;
    }

    private static DateTime? ToUtc(DateTime? value) => value switch
    {
        null => null,
        { Kind: DateTimeKind.Utc } v => v,
        { Kind: DateTimeKind.Local } v => v.ToUniversalTime(),
        var v => DateTime.SpecifyKind(v.Value, DateTimeKind.Utc)
    };

    /// <summary>The store admin form's rules. Returns the normalised (upper-case) code.</summary>
    private static string Validate(ShopUpsertCouponRequest r)
    {
        if (r is null) throw new ArgumentException("Coupon details are required.");
        var code = NormalizeCode(r.Code);
        if (code.Length is < 3 or > 30) throw new ArgumentException("Code must be 3–30 characters.");
        if (!CodePattern().IsMatch(code)) throw new ArgumentException("Code may only contain letters, digits, '_' and '-'.");
        if (r.Description is { Length: > 300 }) throw new ArgumentException("Description must be at most 300 characters.");
        if (!ShopTypes.Contains(r.DiscountType)) throw new ArgumentException("Discount type must be Percentage or Fixed.");
        if (r.Value <= 0) throw new ArgumentException("Value must be greater than 0.");
        if (r.Value >= 10_000_000_000m || decimal.Round(r.Value, 2) != r.Value) throw new ArgumentException("Value is not a valid amount.");
        if (r.DiscountType == CouponType.Percentage && r.Value > 90) throw new ArgumentException("A percentage discount cannot exceed 90.");
        if (r.MinOrderAmount is < 0) throw new ArgumentException("Minimum order can't be negative.");
        if (r.MaxDiscountAmount is <= 0) throw new ArgumentException("Maximum discount must be greater than 0.");
        if (r.UsageLimit is <= 0) throw new ArgumentException("Usage limit must be greater than 0.");
        if (r.StartsAt.HasValue && r.EndsAt.HasValue && ToUtc(r.EndsAt) <= ToUtc(r.StartsAt))
            throw new ArgumentException("endsAt must be after startsAt.");
        return code;
    }

    [GeneratedRegex("^[A-Z0-9_-]+$")] private static partial Regex CodePattern();
}
