using System.Text.RegularExpressions;
using GymManagmentApplication.Application.Shop.Common;
using GymManagmentApplication.Domain.Entities.Shop;

namespace GymManagmentApplication.Application.Shop.Catalog;

/// <summary>
/// In-memory entity → DTO mapping for single aggregates (list endpoints project in SQL instead).
/// Ported from Unique Lights Services/Common/Mappers.cs.
/// </summary>
public static class ShopMappers
{
    public static ShopProductImageDto ToDto(this ShopProductImage i) => new()
    {
        Id = i.Id,
        Url = i.Url,
        AltText = i.AltText,
        SortOrder = i.SortOrder,
        IsPrimary = i.IsPrimary
    };

    /// <summary>Primary first, then SortOrder, then oldest.</summary>
    public static IEnumerable<ShopProductImage> OrderedImages(this ShopProduct p) =>
        p.Images.OrderByDescending(i => i.IsPrimary).ThenBy(i => i.SortOrder).ThenBy(i => i.CreatedAt);

    public static IEnumerable<ShopVariant> OrderedVariants(this IEnumerable<ShopVariant> variants) =>
        variants.OrderByDescending(v => v.IsDefault).ThenBy(v => v.Price).ThenBy(v => v.Name);

    public static ShopVariantDto ToDto(this ShopVariant v) => new()
    {
        Id = v.Id,
        Sku = v.Sku,
        Name = v.Name,
        Flavour = v.Flavour,
        Size = v.Size,
        Colour = v.Colour,
        Weight = v.Weight,
        Price = v.Price,
        CompareAtPrice = ShopPricing.EffectiveCompareAt(v.Price, v.CompareAtPrice),
        Stock = v.AvailableStock(),
        InStock = v.IsActive && v.AvailableStock() > 0,
        IsDefault = v.IsDefault
    };

    public static ShopAdminVariantDto ToAdminDto(this ShopVariant v) => new()
    {
        Id = v.Id,
        Sku = v.Sku,
        Name = v.Name,
        Flavour = v.Flavour,
        Size = v.Size,
        Colour = v.Colour,
        Weight = v.Weight,
        Price = v.Price,
        CompareAtPrice = v.CompareAtPrice,
        Stock = v.AvailableStock(),
        InStock = v.IsActive && v.AvailableStock() > 0,
        IsDefault = v.IsDefault,
        IsActive = v.IsActive,
        QuantityOnHand = v.Inventory?.QuantityOnHand ?? 0,
        ReservedQuantity = v.Inventory?.ReservedQuantity ?? 0,
        LowStockThreshold = v.Inventory?.LowStockThreshold ?? 5
    };

    /// <summary>
    /// The product card (listing tile) for a loaded product. Requires Category, Images and
    /// Variants (+Inventory) to be loaded. Pricing follows the default variant
    /// (<see cref="ShopPricing.DefaultVariant"/>), falling back to BasePrice/CompareAtPrice.
    /// Same shape and rules as the SQL projection used by listings.
    /// </summary>
    public static ShopProductCardDto ToProductCard(this ShopProduct p)
    {
        var defaultVariant = ShopPricing.DefaultVariant(p.Variants);
        var price = defaultVariant?.Price ?? p.BasePrice;
        var rawCompare = defaultVariant is null ? p.CompareAtPrice : defaultVariant.CompareAtPrice;
        var images = p.OrderedImages().Select(i => i.ToDto()).ToList();
        var primary = images.ElementAtOrDefault(0);
        var secondary = images.ElementAtOrDefault(1);

        return new ShopProductCardDto
        {
            Id = p.Id,
            Name = p.Name,
            Slug = p.Slug,
            Brand = p.Brand,
            ShortDescription = p.ShortDescription,
            Price = price,
            CompareAtPrice = ShopPricing.EffectiveCompareAt(price, rawCompare),
            DiscountPercent = ShopPricing.DiscountPercent(price, rawCompare),
            PrimaryImage = primary,
            SecondaryImage = secondary,
            PrimaryImageUrl = primary?.Url,
            SecondaryImageUrl = secondary?.Url,
            CategoryName = p.Category?.Name ?? string.Empty,
            CategorySlug = p.Category?.Slug ?? string.Empty,
            AverageRating = p.AverageRating,
            ReviewCount = p.ReviewCount,
            InStock = p.Variants.Any(v => v.IsActive && v.DeletedAt == null && v.AvailableStock() > 0),
            IsNew = p.IsNew,
            IsFeatured = p.IsFeatured,
            DefaultVariantId = defaultVariant?.Id
        };
    }

    /// <summary>Requires Category, Images, Variants (+Inventory) to be loaded.</summary>
    public static ShopProductDetailDto ToDetailDto(this ShopProduct p)
    {
        var activeVariants = p.Variants.Where(v => v.IsActive && v.DeletedAt == null).OrderedVariants().ToList();
        var defaultVariant = activeVariants.FirstOrDefault();
        var price = defaultVariant?.Price ?? p.BasePrice;
        var compare = ShopPricing.EffectiveCompareAt(price, defaultVariant is null ? p.CompareAtPrice : defaultVariant.CompareAtPrice);
        var images = p.OrderedImages().Select(i => i.ToDto()).ToList();
        var primary = images.ElementAtOrDefault(0);
        var secondary = images.ElementAtOrDefault(1);

        return new ShopProductDetailDto
        {
            Id = p.Id,
            Name = p.Name,
            Slug = p.Slug,
            Brand = p.Brand,
            ShortDescription = p.ShortDescription,
            Price = price,
            CompareAtPrice = compare,
            DiscountPercent = ShopPricing.DiscountPercent(price, compare),
            PrimaryImage = primary,
            SecondaryImage = secondary,
            PrimaryImageUrl = primary?.Url,
            SecondaryImageUrl = secondary?.Url,
            CategoryName = p.Category.Name,
            CategorySlug = p.Category.Slug,
            AverageRating = p.AverageRating,
            ReviewCount = p.ReviewCount,
            InStock = activeVariants.Any(v => v.AvailableStock() > 0),
            IsNew = p.IsNew,
            IsFeatured = p.IsFeatured,
            DefaultVariantId = defaultVariant?.Id,
            Sku = p.Sku,
            Description = p.Description,
            Specifications = new Dictionary<string, string>(p.Specifications ?? []),
            Images = images,
            Variants = activeVariants.Select(v => v.ToDto()).ToList(),
            Category = new ShopIdNameSlugDto(p.Category.Id, p.Category.Name, p.Category.Slug)
        };
    }

    /// <summary>Requires Images and Variants (+Inventory) to be loaded.</summary>
    public static ShopAdminProductDetailDto ToAdminDetailDto(this ShopProduct p) => new()
    {
        Id = p.Id,
        Name = p.Name,
        Slug = p.Slug,
        Sku = p.Sku,
        ShortDescription = p.ShortDescription,
        Description = p.Description,
        Brand = p.Brand,
        BasePrice = p.BasePrice,
        CompareAtPrice = p.CompareAtPrice,
        CategoryId = p.CategoryId,
        IsActive = p.IsActive,
        IsFeatured = p.IsFeatured,
        IsNew = p.IsNew,
        Specifications = new Dictionary<string, string>(p.Specifications ?? []),
        Images = p.OrderedImages().Select(i => i.ToDto()).ToList(),
        Variants = p.Variants.Where(v => v.DeletedAt == null).OrderedVariants().Select(v => v.ToAdminDto()).ToList(),
        CreatedAt = p.CreatedAt,
        UpdatedAt = p.UpdatedAt
    };

    /// <summary>Review author shown as "First L." (just "First" without a last name).</summary>
    public static string AuthorName(string? firstName, string? lastName)
    {
        var first = (firstName ?? string.Empty).Trim();
        var last = (lastName ?? string.Empty).Trim();
        return last.Length == 0 ? first : $"{first} {char.ToUpperInvariant(last[0])}.";
    }
}

/// <summary>Request validation (the Unique Lights FluentValidation rules), throwing ArgumentException → 400.</summary>
internal static partial class ShopValidation
{
    public static void Require(bool condition, string message)
    {
        if (!condition) throw new ArgumentException(message);
    }

    public static void MaxLength(string? value, int max, string field)
    {
        if (value is not null && value.Length > max) throw new ArgumentException($"{field} must be at most {max} characters.");
    }

    public static void NotEmpty(string? value, string field)
    {
        if (string.IsNullOrWhiteSpace(value)) throw new ArgumentException($"{field} is required.");
    }

    /// <summary>0 ≤ value &lt; 10,000,000,000 with at most 2 decimals.</summary>
    public static void Money(decimal? value, string field)
    {
        if (!value.HasValue) return;
        var v = value.Value;
        if (v < 0 || v >= 10_000_000_000m) throw new ArgumentException($"{field} must be between 0 and 9,999,999,999.99.");
        if (decimal.Round(v, 2) != v) throw new ArgumentException($"{field} can have at most 2 decimal places.");
    }

    public static void Between(int? value, int min, int max, string field)
    {
        if (value.HasValue && (value.Value < min || value.Value > max))
            throw new ArgumentException($"{field} must be between {min} and {max}.");
    }

    public static void Slug(string? value, int max)
    {
        if (string.IsNullOrWhiteSpace(value)) return;
        MaxLength(value, max, "slug");
        if (!SlugPattern().IsMatch(value))
            throw new ArgumentException("Slug may only contain lowercase letters, digits and single hyphens.");
    }

    public static void Sku(string? value)
    {
        NotEmpty(value, "sku");
        MaxLength(value, 64, "sku");
        if (!SkuPattern().IsMatch(value!))
            throw new ArgumentException("SKU may only contain letters, digits, '.', '_' and '-'.");
    }

    public static void ImageUrl(string? value, string field)
    {
        if (string.IsNullOrWhiteSpace(value)) return;
        MaxLength(value, 1024, field);
        if (!BeValidImageUrl(value))
            throw new ArgumentException("Must be an absolute http(s) URL or a site-relative path starting with '/'.");
    }

    public static bool BeValidImageUrl(string url) =>
        (url.StartsWith('/') && !url.StartsWith("//", StringComparison.Ordinal)) ||
        (Uri.TryCreate(url, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp));

    [GeneratedRegex("^[a-z0-9]+(?:-[a-z0-9]+)*$")] private static partial Regex SlugPattern();
    [GeneratedRegex("^[A-Za-z0-9._-]+$")] private static partial Regex SkuPattern();
}
