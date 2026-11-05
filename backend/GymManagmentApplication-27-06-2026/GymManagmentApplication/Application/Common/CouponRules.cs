using System.Globalization;
using GymManagmentApplication.Domain.Entities.Billing;
using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Application.Common;

/// <summary>
/// The one set of coupon rules (ARCH-015), used by membership pricing (/api/pricing) and the shop
/// alike: code normalisation, validity checks (active, start/end, usage limit, minimum order) and
/// the discount amount (percentage or fixed, capped by MaxDiscount and the amount itself).
/// </summary>
public static class CouponRules
{
    public static string NormalizeCode(string? code) => (code ?? string.Empty).Trim().ToUpperInvariant();

    /// <summary>Why the coupon can't be used on <paramref name="amount"/> right now, or null when it can.</summary>
    public static string? Check(Coupon coupon, decimal amount, DateTime now, string? currency = null)
    {
        if (!coupon.IsActive) return "Coupon code is invalid";
        if (coupon.ValidFrom.HasValue && now < coupon.ValidFrom.Value) return "This coupon is not active yet";
        if (coupon.ValidUntil.HasValue && now > coupon.ValidUntil.Value) return "This coupon has expired";
        if (coupon.MaxUses.HasValue && coupon.UsesCount >= coupon.MaxUses.Value) return "This coupon has reached its usage limit";
        if (coupon.MinOrder > 0 && amount < coupon.MinOrder)
            return $"A minimum order of {Format(coupon.MinOrder, currency ?? coupon.Currency)} is required for this coupon";
        return null;
    }

    /// <summary>The discount the coupon gives on <paramref name="amount"/> (never more than the amount).</summary>
    public static decimal CalculateDiscount(Coupon coupon, decimal amount)
    {
        if (amount <= 0) return 0;
        var discount = coupon.Type == CouponType.Percentage ? amount * coupon.Value / 100m : coupon.Value;
        if (coupon.MaxDiscount.HasValue) discount = Math.Min(discount, coupon.MaxDiscount.Value);
        return Money.Round(Math.Clamp(discount, 0, amount));
    }

    /// <summary>"₹1,500" for INR (the default), otherwise "1,500.00 USD".</summary>
    public static string Format(decimal amount, string? currency)
    {
        if (string.IsNullOrWhiteSpace(currency) || currency.Equals("INR", StringComparison.OrdinalIgnoreCase))
        {
            CultureInfo culture;
            try { culture = CultureInfo.GetCultureInfo("en-IN"); }
            catch (CultureNotFoundException) { culture = CultureInfo.InvariantCulture; }
            return "₹" + amount.ToString(amount == decimal.Truncate(amount) ? "#,##0" : "#,##0.00", culture);
        }
        return $"{amount:N2} {currency.ToUpperInvariant()}";
    }
}
