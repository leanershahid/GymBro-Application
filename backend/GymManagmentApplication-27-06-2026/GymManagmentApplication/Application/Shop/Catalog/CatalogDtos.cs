namespace GymManagmentApplication.Application.Shop.Catalog;

// Shop catalog DTOs, ported from the Unique Lights store (Dtos/Catalog, Dtos/Reviews, Dtos/Admin,
// Dtos/Shopping wishlist part). Lighting fields are mapped to gym fields:
// finish → flavour, colorTemperature → size, wattage → weight (string); color → colour.
// JSON is camelCase (the API default).

// ───────────────────────────── Public catalog ─────────────────────────────

public class ShopCategoryDto
{
    public ulong Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Slug { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string? ImageUrl { get; init; }
    public ulong? ParentId { get; init; }
    public int SortOrder { get; init; }
    /// <summary>Active products in this category and all of its (active) sub-categories.</summary>
    public int ProductCount { get; init; }
    public List<ShopCategoryDto> Children { get; init; } = [];
}

public static class ShopProductSorts
{
    public const string Featured = "featured";
    public const string Newest = "newest";
    public const string PriceAsc = "price_asc";
    public const string PriceDesc = "price_desc";
    public const string Rating = "rating";
    public const string Name = "name";

    public static readonly string[] All = [Featured, Newest, PriceAsc, PriceDesc, Rating, Name];
}

public sealed class ShopProductImageDto
{
    public ulong Id { get; init; }
    public string Url { get; init; } = string.Empty;
    public string? AltText { get; init; }
    public int SortOrder { get; init; }
    public bool IsPrimary { get; init; }
}

/// <summary>
/// The product card used by listings, search, related products, suggestions and the wishlist.
/// Price/compareAt come from the default variant (BasePrice/CompareAtPrice when there is none).
/// </summary>
public class ShopProductCardDto
{
    public ulong Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Slug { get; init; } = string.Empty;
    public string? Brand { get; init; }
    public string? ShortDescription { get; init; }
    public decimal Price { get; init; }
    public decimal? CompareAtPrice { get; init; }
    public int? DiscountPercent { get; init; }
    public ShopProductImageDto? PrimaryImage { get; init; }
    public ShopProductImageDto? SecondaryImage { get; init; }
    /// <summary>Convenience copy of <see cref="PrimaryImage"/>.Url.</summary>
    public string? PrimaryImageUrl { get; init; }
    /// <summary>Convenience copy of <see cref="SecondaryImage"/>.Url (hover image).</summary>
    public string? SecondaryImageUrl { get; init; }
    public string CategoryName { get; init; } = string.Empty;
    public string CategorySlug { get; init; } = string.Empty;
    public decimal AverageRating { get; init; }
    public int ReviewCount { get; init; }
    public bool InStock { get; init; }
    public bool IsNew { get; init; }
    public bool IsFeatured { get; init; }
    public ulong? DefaultVariantId { get; init; }
}

public class ShopVariantDto
{
    public ulong Id { get; init; }
    public string Sku { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? Flavour { get; init; }
    public string? Size { get; init; }
    public string? Colour { get; init; }
    public string? Weight { get; init; }
    public decimal Price { get; init; }
    public decimal? CompareAtPrice { get; init; }
    /// <summary>Available units (on hand − reserved).</summary>
    public int Stock { get; init; }
    public bool InStock { get; init; }
    public bool IsDefault { get; init; }
}

public sealed record ShopIdNameSlugDto(ulong Id, string Name, string Slug);

public sealed class ShopProductDetailDto : ShopProductCardDto
{
    public string Sku { get; init; } = string.Empty;
    public string? Description { get; init; }
    public Dictionary<string, string> Specifications { get; init; } = new();
    public List<ShopProductImageDto> Images { get; init; } = [];
    public List<ShopVariantDto> Variants { get; init; } = [];
    public ShopIdNameSlugDto Category { get; init; } = null!;
}

public sealed class ShopProductFiltersDto
{
    public IReadOnlyList<string> Brands { get; init; } = [];
    public IReadOnlyList<string> Flavours { get; init; } = [];
    public IReadOnlyList<string> Sizes { get; init; } = [];
    public IReadOnlyList<string> Colours { get; init; } = [];
    public decimal MinPrice { get; init; }
    public decimal MaxPrice { get; init; }
}

public sealed class ShopSearchSuggestionsDto
{
    public IReadOnlyList<ShopProductCardDto> Products { get; init; } = [];
    public IReadOnlyList<ShopIdNameSlugDto> Categories { get; init; } = [];
}

/// <summary>GET api/shop/products query string. List filters are comma-separated.</summary>
public sealed class ShopProductQuery
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 12;
    public string? Search { get; set; }
    /// <summary>Category slug — includes products of its sub-categories.</summary>
    public string? Category { get; set; }
    public decimal? MinPrice { get; set; }
    public decimal? MaxPrice { get; set; }
    public string? Brands { get; set; }
    public string? Flavours { get; set; }
    public string? Sizes { get; set; }
    public string? Colours { get; set; }
    public bool? InStock { get; set; }
    public bool? Featured { get; set; }
    public bool? IsNew { get; set; }
    /// <summary>featured (default) | newest | price_asc | price_desc | rating | name</summary>
    public string? Sort { get; set; }
}

// ───────────────────────────── Reviews ─────────────────────────────

public sealed class ShopReviewDto
{
    public ulong Id { get; init; }
    public ulong ProductId { get; init; }
    public int Rating { get; init; }
    public string? Title { get; init; }
    public string? Comment { get; init; }
    /// <summary>"First L."</summary>
    public string AuthorName { get; init; } = string.Empty;
    public bool IsVerifiedPurchase { get; init; }
    public DateTime CreatedAt { get; init; }
    public bool IsMine { get; init; }
}

public sealed class ShopReviewSummaryDto
{
    public decimal AverageRating { get; init; }
    public int ReviewCount { get; init; }
    /// <summary>Keys "1".."5" → number of reviews with that rating.</summary>
    public Dictionary<string, int> Distribution { get; init; } = new();
}

public sealed class CreateShopReviewRequest
{
    public ulong ProductId { get; init; }
    public int Rating { get; init; }
    public string? Title { get; init; }
    public string? Comment { get; init; }
}

// ───────────────────────────── Wishlist ─────────────────────────────

public sealed class ShopWishlistItemDto
{
    public ulong Id { get; init; }
    public ulong ProductId { get; init; }
    public DateTime AddedAt { get; init; }
    public ShopProductCardDto Product { get; init; } = null!;
}

public sealed class ShopWishlistDto
{
    public IReadOnlyList<ShopWishlistItemDto> Items { get; init; } = [];
}

public sealed class AddShopWishlistItemRequest
{
    public ulong ProductId { get; init; }
}

// ───────────────────────────── Admin: products ─────────────────────────────

public sealed class ShopAdminProductListItemDto
{
    public ulong Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Slug { get; init; } = string.Empty;
    public string Sku { get; init; } = string.Empty;
    public string CategoryName { get; init; } = string.Empty;
    public decimal Price { get; init; }
    public decimal? CompareAtPrice { get; init; }
    public int TotalStock { get; init; }
    public int VariantCount { get; init; }
    public bool IsActive { get; init; }
    public bool IsFeatured { get; init; }
    public bool IsNew { get; init; }
    public string? PrimaryImageUrl { get; init; }
    public DateTime UpdatedAt { get; init; }
}

public sealed class ShopAdminVariantDto : ShopVariantDto
{
    public bool IsActive { get; init; }
    public int QuantityOnHand { get; init; }
    public int ReservedQuantity { get; init; }
    public int LowStockThreshold { get; init; }
}

public sealed class ShopAdminProductDetailDto
{
    public ulong Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Slug { get; init; } = string.Empty;
    public string Sku { get; init; } = string.Empty;
    public string? ShortDescription { get; init; }
    public string? Description { get; init; }
    public string? Brand { get; init; }
    public decimal BasePrice { get; init; }
    public decimal? CompareAtPrice { get; init; }
    public ulong CategoryId { get; init; }
    public bool IsActive { get; init; }
    public bool IsFeatured { get; init; }
    public bool IsNew { get; init; }
    public Dictionary<string, string> Specifications { get; init; } = new();
    public IReadOnlyList<ShopProductImageDto> Images { get; init; } = [];
    public IReadOnlyList<ShopAdminVariantDto> Variants { get; init; } = [];
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
}

public sealed class UpsertShopProductRequest
{
    public string Name { get; init; } = string.Empty;
    /// <summary>Optional; generated from the name on create, kept on update when omitted.</summary>
    public string? Slug { get; init; }
    public string Sku { get; init; } = string.Empty;
    public string? ShortDescription { get; init; }
    public string? Description { get; init; }
    public string? Brand { get; init; }
    public decimal BasePrice { get; init; }
    public decimal? CompareAtPrice { get; init; }
    public ulong CategoryId { get; init; }
    public bool IsActive { get; init; }
    public bool IsFeatured { get; init; }
    public bool IsNew { get; init; }
    public Dictionary<string, string>? Specifications { get; init; }
}

public sealed class UpsertShopVariantRequest
{
    public string Sku { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? Flavour { get; init; }
    public string? Size { get; init; }
    public string? Colour { get; init; }
    public string? Weight { get; init; }
    public decimal Price { get; init; }
    public decimal? CompareAtPrice { get; init; }
    public bool IsDefault { get; init; }
    public bool IsActive { get; init; }
    /// <summary>Only used when the variant is created.</summary>
    public int? InitialStock { get; init; }
    public int? LowStockThreshold { get; init; }
}

/// <summary>multipart/form-data: file, altText, isPrimary.</summary>
public sealed class UploadShopImageRequest
{
    public IFormFile? File { get; init; }
    public string? AltText { get; init; }
    public bool IsPrimary { get; init; }
}

public sealed class AddShopImageUrlRequest
{
    public string Url { get; init; } = string.Empty;
    public string? AltText { get; init; }
    public bool IsPrimary { get; init; }
}

public sealed class UpdateShopImageRequest
{
    public string? AltText { get; init; }
    public int SortOrder { get; init; }
    public bool IsPrimary { get; init; }
}

public sealed class ShopAdminProductQuery
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 12;
    public string? Search { get; set; }
    public ulong? CategoryId { get; set; }
    /// <summary>active | inactive | all (default all)</summary>
    public string? Status { get; set; }
}

// ───────────────────────────── Admin: categories ─────────────────────────────

public sealed class UpsertShopCategoryRequest
{
    public string Name { get; init; } = string.Empty;
    public string? Slug { get; init; }
    public string? Description { get; init; }
    public string? ImageUrl { get; init; }
    public ulong? ParentId { get; init; }
    public int SortOrder { get; init; }
    public bool IsActive { get; init; }
}

/// <summary>Flat admin list row (children is always empty; build the tree from parentId).</summary>
public sealed class ShopAdminCategoryDto : ShopCategoryDto
{
    public bool IsActive { get; init; }
}

// ───────────────────────────── Admin: inventory ─────────────────────────────

public sealed class ShopInventoryItemDto
{
    public ulong VariantId { get; init; }
    public ulong ProductId { get; init; }
    public string ProductName { get; init; } = string.Empty;
    public string VariantName { get; init; } = string.Empty;
    public string Sku { get; init; } = string.Empty;
    public string? ImageUrl { get; init; }
    public int QuantityOnHand { get; init; }
    public int ReservedQuantity { get; init; }
    public int Available { get; init; }
    public int LowStockThreshold { get; init; }
    /// <summary>available ≤ lowStockThreshold (or no inventory row).</summary>
    public bool IsLowStock { get; init; }
}

/// <summary>Either quantityOnHand (set) or adjustment (+/−), optionally lowStockThreshold.</summary>
public sealed class UpdateShopInventoryRequest
{
    public int? QuantityOnHand { get; init; }
    public int? Adjustment { get; init; }
    public int? LowStockThreshold { get; init; }
}

public sealed class ShopInventoryQuery
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 12;
    public string? Search { get; set; }
    public bool? LowStockOnly { get; set; }
}
