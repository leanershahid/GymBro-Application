using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Shop.Common;
using GymManagmentApplication.Domain.Entities.Shop;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Shop.Catalog;

// Public catalog: categories, product search/filters/suggest/detail/related.
// Ported from Unique Lights Services/CatalogService.cs + Repositories/ProductRepository.cs.

public sealed class ShopProductSearchCriteria
{
    public string? Search { get; init; }
    public IReadOnlyCollection<ulong>? CategoryIds { get; init; }
    public decimal? MinPrice { get; init; }
    public decimal? MaxPrice { get; init; }
    public IReadOnlyCollection<string> Brands { get; init; } = [];
    public IReadOnlyCollection<string> Flavours { get; init; } = [];
    public IReadOnlyCollection<string> Sizes { get; init; } = [];
    public IReadOnlyCollection<string> Colours { get; init; } = [];
    public bool? InStock { get; init; }
    public bool? Featured { get; init; }
    public bool? IsNew { get; init; }
    public string Sort { get; init; } = ShopProductSorts.Featured;
    public ulong? ExcludeProductId { get; init; }
}

/// <summary>Product queries shared by the catalog, the wishlist and the admin catalog (the Unique Lights ProductRepository).</summary>
public interface IShopProductQueries
{
    /// <summary>Active, non-deleted products of this gym in active, non-deleted categories (no tracking).</summary>
    IQueryable<ShopProduct> QueryPublic();

    Task<PagedResponse<ShopProductCardDto>> SearchAsync(ShopProductSearchCriteria criteria, int page, int pageSize);
    Task<List<ShopProductCardDto>> ListAsync(ShopProductSearchCriteria criteria, int take);
    /// <summary>Product cards for the given ids (only those still publicly visible).</summary>
    Task<List<ShopProductCardDto>> GetCardsByIdsAsync(IReadOnlyCollection<ulong> productIds);
    Task<ShopProductFiltersDto> GetFiltersAsync(IReadOnlyCollection<ulong>? categoryIds);
    Task<ShopProduct?> GetPublicDetailAsync(string slug);
    /// <summary>Tracked, non-deleted product (any active state) with images, variants and inventory.</summary>
    Task<ShopProduct?> GetForAdminAsync(ulong id);
    Task<PagedResponse<ShopAdminProductListItemDto>> SearchAdminAsync(ShopAdminProductQuery query);
    Task<bool> SlugExistsAsync(string slug, ulong? excludeId);
    Task<bool> ProductSkuExistsAsync(string sku, ulong? excludeId);
    Task<bool> VariantSkuExistsAsync(string sku, ulong? excludeVariantId);
}

public sealed class ShopProductQueries(AppDbContext db, ICurrentUser currentUser) : IShopProductQueries
{
    private ulong Tid => currentUser.ResolveTenantId();

    /// <summary>Intermediate row: the product plus SQL-computed "default variant" price data.</summary>
    private sealed class PricedProduct
    {
        public ShopProduct P { get; init; } = null!;
        public decimal Price { get; init; }
        public decimal? CompareAt { get; init; }
        public ulong? DefaultVariantId { get; init; }
        public bool InStock { get; init; }
    }

    public IQueryable<ShopProduct> QueryPublic()
    {
        var tid = Tid;
        return db.ShopProducts.AsNoTracking().Where(p =>
            p.TenantId == tid && p.DeletedAt == null && p.IsActive &&
            p.Category.IsActive && p.Category.DeletedAt == null);
    }

    private static IQueryable<PricedProduct> WithPricing(IQueryable<ShopProduct> query) =>
        query.Select(p => new PricedProduct
        {
            P = p,
            Price = p.Variants
                        .Where(v => v.IsActive && v.DeletedAt == null)
                        .OrderByDescending(v => v.IsDefault).ThenBy(v => v.Price).ThenBy(v => v.Id)
                        .Select(v => (decimal?)v.Price)
                        .FirstOrDefault() ?? p.BasePrice,
            CompareAt = p.Variants.Any(v => v.IsActive && v.DeletedAt == null)
                ? p.Variants
                    .Where(v => v.IsActive && v.DeletedAt == null)
                    .OrderByDescending(v => v.IsDefault).ThenBy(v => v.Price).ThenBy(v => v.Id)
                    .Select(v => v.CompareAtPrice)
                    .FirstOrDefault()
                : p.CompareAtPrice,
            DefaultVariantId = p.Variants
                .Where(v => v.IsActive && v.DeletedAt == null)
                .OrderByDescending(v => v.IsDefault).ThenBy(v => v.Price).ThenBy(v => v.Id)
                .Select(v => (ulong?)v.Id)
                .FirstOrDefault(),
            InStock = p.Variants.Any(v => v.IsActive && v.DeletedAt == null && v.Inventory != null &&
                                          v.Inventory.QuantityOnHand - v.Inventory.ReservedQuantity > 0)
        });

    private static IQueryable<ShopProductCardDto> ToCards(IQueryable<PricedProduct> query) =>
        query.Select(x => new ShopProductCardDto
        {
            Id = x.P.Id,
            Name = x.P.Name,
            Slug = x.P.Slug,
            Brand = x.P.Brand,
            ShortDescription = x.P.ShortDescription,
            Price = x.Price,
            CompareAtPrice = ShopPricing.EffectiveCompareAt(x.Price, x.CompareAt),
            DiscountPercent = ShopPricing.DiscountPercent(x.Price, x.CompareAt),
            PrimaryImage = x.P.Images
                .OrderByDescending(i => i.IsPrimary).ThenBy(i => i.SortOrder).ThenBy(i => i.CreatedAt)
                .Select(i => new ShopProductImageDto { Id = i.Id, Url = i.Url, AltText = i.AltText, SortOrder = i.SortOrder, IsPrimary = i.IsPrimary })
                .FirstOrDefault(),
            SecondaryImage = x.P.Images
                .OrderByDescending(i => i.IsPrimary).ThenBy(i => i.SortOrder).ThenBy(i => i.CreatedAt)
                .Select(i => new ShopProductImageDto { Id = i.Id, Url = i.Url, AltText = i.AltText, SortOrder = i.SortOrder, IsPrimary = i.IsPrimary })
                .Skip(1)
                .FirstOrDefault(),
            PrimaryImageUrl = x.P.Images
                .OrderByDescending(i => i.IsPrimary).ThenBy(i => i.SortOrder).ThenBy(i => i.CreatedAt)
                .Select(i => i.Url)
                .FirstOrDefault(),
            SecondaryImageUrl = x.P.Images
                .OrderByDescending(i => i.IsPrimary).ThenBy(i => i.SortOrder).ThenBy(i => i.CreatedAt)
                .Select(i => i.Url)
                .Skip(1)
                .FirstOrDefault(),
            CategoryName = x.P.Category.Name,
            CategorySlug = x.P.Category.Slug,
            AverageRating = x.P.AverageRating,
            ReviewCount = x.P.ReviewCount,
            InStock = x.InStock,
            IsNew = x.P.IsNew,
            IsFeatured = x.P.IsFeatured,
            DefaultVariantId = x.DefaultVariantId
        });

    private IQueryable<PricedProduct> BuildQuery(ShopProductSearchCriteria c)
    {
        var query = QueryPublic();

        if (c.ExcludeProductId.HasValue)
        {
            var excluded = c.ExcludeProductId.Value;
            query = query.Where(p => p.Id != excluded);
        }

        if (!string.IsNullOrWhiteSpace(c.Search))
        {
            var pattern = ShopSearch.Contains(c.Search);
            query = query.Where(p =>
                EF.Functions.ILike(p.Name, pattern, ShopSearch.EscapeCharacter) ||
                (p.Brand != null && EF.Functions.ILike(p.Brand, pattern, ShopSearch.EscapeCharacter)) ||
                EF.Functions.ILike(p.Sku, pattern, ShopSearch.EscapeCharacter) ||
                (p.ShortDescription != null && EF.Functions.ILike(p.ShortDescription, pattern, ShopSearch.EscapeCharacter)));
        }

        if (c.CategoryIds is not null)
        {
            var ids = c.CategoryIds.ToList();
            query = query.Where(p => ids.Contains(p.CategoryId));
        }

        if (c.Brands.Count > 0)
        {
            var brands = c.Brands.ToList();
            query = query.Where(p => p.Brand != null && brands.Contains(p.Brand));
        }

        if (c.Flavours.Count > 0)
        {
            var flavours = c.Flavours.ToList();
            query = query.Where(p => p.Variants.Any(v => v.IsActive && v.DeletedAt == null && v.Flavour != null && flavours.Contains(v.Flavour)));
        }

        if (c.Sizes.Count > 0)
        {
            var sizes = c.Sizes.ToList();
            query = query.Where(p => p.Variants.Any(v => v.IsActive && v.DeletedAt == null && v.Size != null && sizes.Contains(v.Size)));
        }

        if (c.Colours.Count > 0)
        {
            var colours = c.Colours.ToList();
            query = query.Where(p => p.Variants.Any(v => v.IsActive && v.DeletedAt == null && v.Colour != null && colours.Contains(v.Colour)));
        }

        if (c.Featured.HasValue)
        {
            var featured = c.Featured.Value;
            query = query.Where(p => p.IsFeatured == featured);
        }

        if (c.IsNew.HasValue)
        {
            var isNew = c.IsNew.Value;
            query = query.Where(p => p.IsNew == isNew);
        }

        var priced = WithPricing(query);

        if (c.InStock.HasValue)
        {
            var inStock = c.InStock.Value;
            priced = priced.Where(x => x.InStock == inStock);
        }

        if (c.MinPrice.HasValue)
        {
            var min = c.MinPrice.Value;
            priced = priced.Where(x => x.Price >= min);
        }

        if (c.MaxPrice.HasValue)
        {
            var max = c.MaxPrice.Value;
            priced = priced.Where(x => x.Price <= max);
        }

        return c.Sort switch
        {
            ShopProductSorts.Newest => priced.OrderByDescending(x => x.P.IsNew).ThenByDescending(x => x.P.CreatedAt).ThenBy(x => x.P.Id),
            ShopProductSorts.PriceAsc => priced.OrderBy(x => x.Price).ThenBy(x => x.P.Name).ThenBy(x => x.P.Id),
            ShopProductSorts.PriceDesc => priced.OrderByDescending(x => x.Price).ThenBy(x => x.P.Name).ThenBy(x => x.P.Id),
            ShopProductSorts.Rating => priced.OrderByDescending(x => x.P.AverageRating).ThenByDescending(x => x.P.ReviewCount).ThenBy(x => x.P.Id),
            ShopProductSorts.Name => priced.OrderBy(x => x.P.Name).ThenBy(x => x.P.Id),
            _ => priced.OrderByDescending(x => x.P.IsFeatured).ThenByDescending(x => x.P.AverageRating)
                .ThenByDescending(x => x.P.CreatedAt).ThenBy(x => x.P.Id)
        };
    }

    public async Task<PagedResponse<ShopProductCardDto>> SearchAsync(ShopProductSearchCriteria criteria, int page, int pageSize)
    {
        var query = BuildQuery(criteria);
        var total = await query.CountAsync();
        var items = total == 0
            ? []
            : await ToCards(query.Skip((page - 1) * pageSize).Take(pageSize)).ToListAsync();
        return ShopSearch.Page(items, page, pageSize, total);
    }

    public Task<List<ShopProductCardDto>> ListAsync(ShopProductSearchCriteria criteria, int take) =>
        ToCards(BuildQuery(criteria).Take(take)).ToListAsync();

    public async Task<List<ShopProductCardDto>> GetCardsByIdsAsync(IReadOnlyCollection<ulong> productIds)
    {
        if (productIds.Count == 0) return [];
        var ids = productIds.ToList();
        return await ToCards(WithPricing(QueryPublic().Where(p => ids.Contains(p.Id)))).ToListAsync();
    }

    public async Task<ShopProductFiltersDto> GetFiltersAsync(IReadOnlyCollection<ulong>? categoryIds)
    {
        var products = QueryPublic();
        if (categoryIds is not null)
        {
            var ids = categoryIds.ToList();
            products = products.Where(p => ids.Contains(p.CategoryId));
        }

        var brands = await products.Where(p => p.Brand != null && p.Brand != "")
            .Select(p => p.Brand!).Distinct().OrderBy(b => b).ToListAsync();

        var variants = products.SelectMany(p => p.Variants).Where(v => v.IsActive && v.DeletedAt == null);
        var flavours = await variants.Where(v => v.Flavour != null && v.Flavour != "")
            .Select(v => v.Flavour!).Distinct().OrderBy(f => f).ToListAsync();
        var sizes = await variants.Where(v => v.Size != null && v.Size != "")
            .Select(v => v.Size!).Distinct().OrderBy(s => s).ToListAsync();
        var colours = await variants.Where(v => v.Colour != null && v.Colour != "")
            .Select(v => v.Colour!).Distinct().OrderBy(c => c).ToListAsync();

        var prices = WithPricing(products).Select(x => x.Price);
        var minPrice = await prices.Select(p => (decimal?)p).MinAsync() ?? 0m;
        var maxPrice = await prices.Select(p => (decimal?)p).MaxAsync() ?? 0m;

        return new ShopProductFiltersDto
        {
            Brands = brands,
            Flavours = flavours,
            Sizes = sizes,
            Colours = colours,
            MinPrice = minPrice,
            MaxPrice = maxPrice
        };
    }

    public Task<ShopProduct?> GetPublicDetailAsync(string slug) =>
        QueryPublic()
            .Include(p => p.Category)
            .Include(p => p.Images)
            .Include(p => p.Variants).ThenInclude(v => v.Inventory)
            .AsSplitQuery()
            .FirstOrDefaultAsync(p => p.Slug == slug);

    public Task<ShopProduct?> GetForAdminAsync(ulong id)
    {
        var tid = Tid;
        return db.ShopProducts
            .Include(p => p.Images)
            .Include(p => p.Variants).ThenInclude(v => v.Inventory)
            .AsSplitQuery()
            .FirstOrDefaultAsync(p => p.Id == id && p.TenantId == tid && p.DeletedAt == null);
    }

    public async Task<PagedResponse<ShopAdminProductListItemDto>> SearchAdminAsync(ShopAdminProductQuery q)
    {
        var (page, size) = ShopSearch.Paging(q.Page, q.PageSize);
        var tid = Tid;
        var query = db.ShopProducts.AsNoTracking().Where(p => p.TenantId == tid && p.DeletedAt == null);

        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var pattern = ShopSearch.Contains(q.Search);
            query = query.Where(p =>
                EF.Functions.ILike(p.Name, pattern, ShopSearch.EscapeCharacter) ||
                EF.Functions.ILike(p.Sku, pattern, ShopSearch.EscapeCharacter) ||
                (p.Brand != null && EF.Functions.ILike(p.Brand, pattern, ShopSearch.EscapeCharacter)) ||
                p.Variants.Any(v => v.DeletedAt == null && EF.Functions.ILike(v.Sku, pattern, ShopSearch.EscapeCharacter)));
        }

        if (q.CategoryId.HasValue)
        {
            var categoryId = q.CategoryId.Value;
            query = query.Where(p => p.CategoryId == categoryId);
        }

        switch (q.Status?.Trim().ToLowerInvariant())
        {
            case "active":
                query = query.Where(p => p.IsActive);
                break;
            case "inactive":
                query = query.Where(p => !p.IsActive);
                break;
        }

        var total = await query.CountAsync();
        var rows = await WithPricing(query)
            .OrderByDescending(x => x.P.UpdatedAt).ThenBy(x => x.P.Id)
            .Skip((page - 1) * size).Take(size)
            .Select(x => new ShopAdminProductListItemDto
            {
                Id = x.P.Id,
                Name = x.P.Name,
                Slug = x.P.Slug,
                Sku = x.P.Sku,
                CategoryName = x.P.Category.Name,
                Price = x.Price,
                CompareAtPrice = ShopPricing.EffectiveCompareAt(x.Price, x.CompareAt),
                TotalStock = x.P.Variants.Where(v => v.DeletedAt == null)
                    .Sum(v => v.Inventory != null ? v.Inventory.QuantityOnHand : 0),
                VariantCount = x.P.Variants.Count(v => v.DeletedAt == null),
                IsActive = x.P.IsActive,
                IsFeatured = x.P.IsFeatured,
                IsNew = x.P.IsNew,
                PrimaryImageUrl = x.P.Images
                    .OrderByDescending(i => i.IsPrimary).ThenBy(i => i.SortOrder).ThenBy(i => i.CreatedAt)
                    .Select(i => i.Url).FirstOrDefault(),
                UpdatedAt = x.P.UpdatedAt
            })
            .ToListAsync();

        return ShopSearch.Page(rows, page, size, total);
    }

    public Task<bool> SlugExistsAsync(string slug, ulong? excludeId)
    {
        var tid = Tid;
        return db.ShopProducts.AnyAsync(p => p.TenantId == tid && p.DeletedAt == null && p.Slug == slug &&
                                             (excludeId == null || p.Id != excludeId));
    }

    public Task<bool> ProductSkuExistsAsync(string sku, ulong? excludeId)
    {
        var tid = Tid;
        return db.ShopProducts.AnyAsync(p => p.TenantId == tid && p.DeletedAt == null && p.Sku == sku &&
                                             (excludeId == null || p.Id != excludeId));
    }

    public Task<bool> VariantSkuExistsAsync(string sku, ulong? excludeVariantId)
    {
        var tid = Tid;
        return db.ShopVariants.AnyAsync(v => v.TenantId == tid && v.DeletedAt == null && v.Product.DeletedAt == null &&
                                             v.Sku == sku && (excludeVariantId == null || v.Id != excludeVariantId));
    }
}

// ───────────────────────────── Categories ─────────────────────────────

public interface IShopCategoryService
{
    Task<IReadOnlyList<ShopCategoryDto>> GetTreeAsync();
    Task<ShopCategoryDto> GetBySlugAsync(string slug);
    /// <summary>Active category id for the slug plus all active descendants; null when the slug is unknown.</summary>
    Task<IReadOnlyCollection<ulong>?> ResolveCategoryIdsAsync(string slug);
}

public sealed class ShopCategoryService(AppDbContext db, ICurrentUser currentUser) : IShopCategoryService
{
    private sealed record CategoryRow(ulong Id, string Name, string Slug, string? Description, string? ImageUrl, ulong? ParentId, int SortOrder);

    private IQueryable<ShopCategory> ActiveCategories()
    {
        var tid = currentUser.ResolveTenantId();
        return db.ShopCategories.AsNoTracking().Where(c => c.TenantId == tid && c.DeletedAt == null && c.IsActive);
    }

    private async Task<(List<CategoryRow> Rows, Dictionary<ulong, int> DirectCounts)> LoadActiveAsync()
    {
        var tid = currentUser.ResolveTenantId();
        var rows = await ActiveCategories()
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .Select(c => new CategoryRow(c.Id, c.Name, c.Slug, c.Description, c.ImageUrl, c.ParentId, c.SortOrder))
            .ToListAsync();

        var counts = await db.ShopProducts.AsNoTracking()
            .Where(p => p.TenantId == tid && p.DeletedAt == null && p.IsActive)
            .GroupBy(p => p.CategoryId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count);

        return (rows, counts);
    }

    private static ShopCategoryDto Build(CategoryRow row, ILookup<ulong?, CategoryRow> byParent, Dictionary<ulong, int> counts, int depth = 0)
    {
        var children = depth > 10
            ? []
            : byParent[row.Id].Select(c => Build(c, byParent, counts, depth + 1)).ToList();

        return new ShopCategoryDto
        {
            Id = row.Id,
            Name = row.Name,
            Slug = row.Slug,
            Description = row.Description,
            ImageUrl = row.ImageUrl,
            ParentId = row.ParentId,
            SortOrder = row.SortOrder,
            // Count includes products of child categories (matches the ?category= filter behaviour).
            ProductCount = counts.GetValueOrDefault(row.Id) + children.Sum(c => c.ProductCount),
            Children = children
        };
    }

    public async Task<IReadOnlyList<ShopCategoryDto>> GetTreeAsync()
    {
        var (rows, counts) = await LoadActiveAsync();
        var ids = rows.Select(r => r.Id).ToHashSet();
        var byParent = rows.ToLookup(r => r.ParentId);
        // Top level = no parent, or parent not active (orphans are promoted so they remain reachable).
        return rows.Where(r => r.ParentId is null || !ids.Contains(r.ParentId.Value))
            .Select(r => Build(r, byParent, counts))
            .ToList();
    }

    public async Task<ShopCategoryDto> GetBySlugAsync(string slug)
    {
        var (rows, counts) = await LoadActiveAsync();
        var normalized = slug.Trim().ToLowerInvariant();
        var row = rows.FirstOrDefault(r => r.Slug == normalized)
                  ?? throw new KeyNotFoundException("Category not found");
        return Build(row, rows.ToLookup(r => r.ParentId), counts);
    }

    public async Task<IReadOnlyCollection<ulong>?> ResolveCategoryIdsAsync(string slug)
    {
        var all = await ActiveCategories()
            .Select(c => new { c.Id, c.Slug, c.ParentId })
            .ToListAsync();

        var normalized = slug.Trim().ToLowerInvariant();
        var root = all.FirstOrDefault(c => c.Slug == normalized);
        if (root is null) return null;

        var byParent = all.ToLookup(c => c.ParentId);
        var result = new HashSet<ulong> { root.Id };
        var queue = new Queue<ulong>([root.Id]);
        while (queue.Count > 0)
        {
            foreach (var child in byParent[queue.Dequeue()])
            {
                if (result.Add(child.Id)) queue.Enqueue(child.Id);
            }
        }
        return result;
    }
}

// ───────────────────────────── Products ─────────────────────────────

public interface IShopProductService
{
    Task<PagedResponse<ShopProductCardDto>> SearchAsync(ShopProductQuery query);
    Task<ShopProductFiltersDto> GetFiltersAsync(string? categorySlug);
    Task<ShopSearchSuggestionsDto> SuggestAsync(string? q);
    Task<ShopProductDetailDto> GetBySlugAsync(string slug);
    Task<IReadOnlyList<ShopProductCardDto>> GetRelatedAsync(string slug);
}

public sealed class ShopProductService(
    AppDbContext db,
    ICurrentUser currentUser,
    IShopProductQueries products,
    IShopCategoryService categories) : IShopProductService
{
    private const int SuggestProducts = 6;
    private const int SuggestCategories = 4;
    private const int RelatedProducts = 8;

    public async Task<PagedResponse<ShopProductCardDto>> SearchAsync(ShopProductQuery q)
    {
        Validate(q);
        var (page, size) = ShopSearch.Paging(q.Page, q.PageSize);

        IReadOnlyCollection<ulong>? categoryIds = null;
        if (!string.IsNullOrWhiteSpace(q.Category))
        {
            categoryIds = await categories.ResolveCategoryIdsAsync(q.Category);
            if (categoryIds is null) return ShopSearch.Page(Array.Empty<ShopProductCardDto>(), page, size, 0);
        }

        var criteria = new ShopProductSearchCriteria
        {
            Search = string.IsNullOrWhiteSpace(q.Search) ? null : q.Search.Trim(),
            CategoryIds = categoryIds,
            MinPrice = q.MinPrice,
            MaxPrice = q.MaxPrice,
            Brands = ShopSearch.SplitList(q.Brands),
            Flavours = ShopSearch.SplitList(q.Flavours),
            Sizes = ShopSearch.SplitList(q.Sizes),
            Colours = ShopSearch.SplitList(q.Colours),
            InStock = q.InStock,
            Featured = q.Featured,
            IsNew = q.IsNew,
            Sort = string.IsNullOrWhiteSpace(q.Sort) ? ShopProductSorts.Featured : q.Sort.Trim().ToLowerInvariant()
        };

        return await products.SearchAsync(criteria, page, size);
    }

    private static void Validate(ShopProductQuery q)
    {
        ShopValidation.MaxLength(q.Search, 100, "search");
        ShopValidation.MaxLength(q.Category, 140, "category");
        ShopValidation.Require(q.MinPrice is null or >= 0, "minPrice must be greater than or equal to 0.");
        ShopValidation.Require(q.MaxPrice is null or >= 0, "maxPrice must be greater than or equal to 0.");
        ShopValidation.Require(!(q.MinPrice.HasValue && q.MaxPrice.HasValue) || q.MaxPrice >= q.MinPrice,
            "maxPrice must be greater than or equal to minPrice.");
        ShopValidation.MaxLength(q.Brands, 1000, "brands");
        ShopValidation.MaxLength(q.Flavours, 1000, "flavours");
        ShopValidation.MaxLength(q.Sizes, 1000, "sizes");
        ShopValidation.MaxLength(q.Colours, 1000, "colours");
        ShopValidation.Require(string.IsNullOrWhiteSpace(q.Sort) || ShopProductSorts.All.Contains(q.Sort.Trim().ToLowerInvariant()),
            $"sort must be one of: {string.Join(", ", ShopProductSorts.All)}.");
    }

    public async Task<ShopProductFiltersDto> GetFiltersAsync(string? categorySlug)
    {
        IReadOnlyCollection<ulong>? categoryIds = null;
        if (!string.IsNullOrWhiteSpace(categorySlug))
        {
            categoryIds = await categories.ResolveCategoryIdsAsync(categorySlug) ?? [];
        }
        return await products.GetFiltersAsync(categoryIds);
    }

    public async Task<ShopSearchSuggestionsDto> SuggestAsync(string? q)
    {
        var term = q?.Trim() ?? string.Empty;
        if (term.Length < 2) return new ShopSearchSuggestionsDto();
        if (term.Length > 100) term = term[..100];

        var productItems = await products.ListAsync(
            new ShopProductSearchCriteria { Search = term, Sort = ShopProductSorts.Featured }, SuggestProducts);

        var tid = currentUser.ResolveTenantId();
        var pattern = ShopSearch.Contains(term);
        var categoryItems = await db.ShopCategories.AsNoTracking()
            .Where(c => c.TenantId == tid && c.DeletedAt == null && c.IsActive &&
                        EF.Functions.ILike(c.Name, pattern, ShopSearch.EscapeCharacter))
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .Take(SuggestCategories)
            .Select(c => new ShopIdNameSlugDto(c.Id, c.Name, c.Slug))
            .ToListAsync();

        return new ShopSearchSuggestionsDto { Products = productItems, Categories = categoryItems };
    }

    public async Task<ShopProductDetailDto> GetBySlugAsync(string slug)
    {
        var product = await products.GetPublicDetailAsync(slug.Trim().ToLowerInvariant())
                      ?? throw new KeyNotFoundException("Product not found");
        return product.ToDetailDto();
    }

    public async Task<IReadOnlyList<ShopProductCardDto>> GetRelatedAsync(string slug)
    {
        var normalized = slug.Trim().ToLowerInvariant();
        var product = await products.QueryPublic()
            .Where(p => p.Slug == normalized)
            .Select(p => new { p.Id, p.CategoryId })
            .FirstOrDefaultAsync() ?? throw new KeyNotFoundException("Product not found");

        return await products.ListAsync(new ShopProductSearchCriteria
        {
            CategoryIds = [product.CategoryId],
            ExcludeProductId = product.Id,
            Sort = ShopProductSorts.Featured
        }, RelatedProducts);
    }
}
