using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Shop.Common;
using GymManagmentApplication.Domain.Entities.Shop;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Shop.Catalog;

// Admin catalog: products (+variants, images) and categories.
// Ported from Unique Lights Services/Admin/AdminProductService.cs and AdminCategoryService.cs.

public interface IShopAdminProductService
{
    Task<PagedResponse<ShopAdminProductListItemDto>> SearchAsync(ShopAdminProductQuery query);
    Task<ShopAdminProductDetailDto> GetAsync(ulong id);
    Task<ShopAdminProductDetailDto> CreateAsync(UpsertShopProductRequest request);
    Task<ShopAdminProductDetailDto> UpdateAsync(ulong id, UpsertShopProductRequest request);
    Task DeleteAsync(ulong id);

    Task<ShopAdminProductDetailDto> AddVariantAsync(ulong productId, UpsertShopVariantRequest request);
    Task<ShopAdminProductDetailDto> UpdateVariantAsync(ulong productId, ulong variantId, UpsertShopVariantRequest request);
    Task<ShopAdminProductDetailDto> DeleteVariantAsync(ulong productId, ulong variantId);

    Task<ShopAdminProductDetailDto> UploadImageAsync(ulong productId, UploadShopImageRequest request);
    Task<ShopAdminProductDetailDto> AddImageUrlAsync(ulong productId, AddShopImageUrlRequest request);
    Task<ShopAdminProductDetailDto> UpdateImageAsync(ulong productId, ulong imageId, UpdateShopImageRequest request);
    Task<ShopAdminProductDetailDto> DeleteImageAsync(ulong productId, ulong imageId);
}

public sealed class ShopAdminProductService(
    IAppDbContext db,
    ICurrentUser currentUser,
    IShopProductQueries products,
    IFileStorage storage,
    ILogger<ShopAdminProductService> logger) : IShopAdminProductService
{
    private const int MaxImagesPerProduct = 12;
    private const int MaxVariantsPerProduct = 50;

    public async Task<PagedResponse<ShopAdminProductListItemDto>> SearchAsync(ShopAdminProductQuery query)
    {
        ShopValidation.MaxLength(query.Search, 100, "search");
        ShopValidation.Require(string.IsNullOrWhiteSpace(query.Status) ||
                               new[] { "active", "inactive", "all" }.Contains(query.Status.Trim().ToLowerInvariant()),
            "status must be one of: active, inactive, all.");
        return await products.SearchAdminAsync(query);
    }

    public async Task<ShopAdminProductDetailDto> GetAsync(ulong id) =>
        (await LoadAsync(id)).ToAdminDetailDto();

    public async Task<ShopAdminProductDetailDto> CreateAsync(UpsertShopProductRequest request)
    {
        ValidateProduct(request);
        await EnsureCategoryExistsAsync(request.CategoryId);

        var tid = currentUser.ResolveTenantId();
        var sku = request.Sku.Trim();
        var slug = await ResolveSlugAsync(request.Slug, request.Name, null);
        if (await products.ProductSkuExistsAsync(sku, null)) throw new ArgumentException($"A product with SKU {sku} already exists");
        if (await products.VariantSkuExistsAsync(sku, null)) throw new ArgumentException($"A variant with SKU {sku} already exists");

        var product = new ShopProduct { TenantId = tid };
        Apply(product, request, slug, sku);

        // Every product needs at least one purchasable variant: create the default "Standard" variant.
        var variant = new ShopVariant
        {
            TenantId = tid,
            Sku = sku,
            Name = "Standard",
            Price = request.BasePrice,
            CompareAtPrice = request.CompareAtPrice,
            IsDefault = true,
            IsActive = true,
            Inventory = new ShopInventory { TenantId = tid, QuantityOnHand = 0, LowStockThreshold = 5 }
        };
        product.Variants.Add(variant);

        db.ShopProducts.Add(product);
        await db.SaveChangesAsync();
        logger.LogInformation("Shop product {ProductId} ({Sku}) created", product.Id, product.Sku);
        return await GetAsync(product.Id);
    }

    public async Task<ShopAdminProductDetailDto> UpdateAsync(ulong id, UpsertShopProductRequest request)
    {
        ValidateProduct(request);
        var product = await LoadAsync(id);
        if (request.CategoryId != product.CategoryId) await EnsureCategoryExistsAsync(request.CategoryId);

        var sku = request.Sku.Trim();
        if (!string.Equals(sku, product.Sku, StringComparison.Ordinal) && await products.ProductSkuExistsAsync(sku, id))
        {
            throw new ArgumentException($"A product with SKU {sku} already exists");
        }

        var slug = await ResolveSlugAsync(request.Slug, request.Name, id, currentSlug: product.Slug);
        Apply(product, request, slug, sku);
        await db.SaveChangesAsync();
        return product.ToAdminDetailDto();
    }

    public async Task DeleteAsync(ulong id)
    {
        var product = await LoadAsync(id);
        var now = DateTime.UtcNow;
        product.DeletedAt = now;
        product.IsActive = false;
        foreach (var variant in product.Variants.Where(v => v.DeletedAt == null))
        {
            variant.DeletedAt = now;
            variant.IsActive = false;
        }

        // Remove the product from carts and wishlists so members don't see dead lines.
        var variantIds = product.Variants.Select(v => v.Id).ToList();
        await db.ShopCartItems.Where(ci => variantIds.Contains(ci.VariantId)).ExecuteDeleteAsync();
        await db.ShopWishlistItems.Where(w => w.ProductId == id).ExecuteDeleteAsync();
        await db.SaveChangesAsync();
        logger.LogInformation("Shop product {ProductId} soft deleted", id);
    }

    // ---------- Variants ----------

    public async Task<ShopAdminProductDetailDto> AddVariantAsync(ulong productId, UpsertShopVariantRequest request)
    {
        ValidateVariant(request);
        var product = await LoadAsync(productId);
        var live = product.Variants.Where(v => v.DeletedAt == null).ToList();
        if (live.Count >= MaxVariantsPerProduct) throw new ArgumentException($"A product can have at most {MaxVariantsPerProduct} variants");

        var sku = request.Sku.Trim();
        if (await products.VariantSkuExistsAsync(sku, null)) throw new ArgumentException($"A variant with SKU {sku} already exists");

        var variant = new ShopVariant
        {
            TenantId = product.TenantId,
            ProductId = product.Id,
            Inventory = new ShopInventory
            {
                TenantId = product.TenantId,
                QuantityOnHand = request.InitialStock ?? 0,
                LowStockThreshold = request.LowStockThreshold ?? 5
            }
        };
        ApplyVariant(variant, request, sku);
        product.Variants.Add(variant);

        if (variant.IsDefault || live.All(v => !v.IsDefault))
        {
            SetDefault(product, variant);
        }

        await db.SaveChangesAsync();
        return product.ToAdminDetailDto();
    }

    public async Task<ShopAdminProductDetailDto> UpdateVariantAsync(ulong productId, ulong variantId, UpsertShopVariantRequest request)
    {
        ValidateVariant(request);
        var product = await LoadAsync(productId);
        var variant = product.Variants.FirstOrDefault(v => v.Id == variantId && v.DeletedAt == null)
                      ?? throw new KeyNotFoundException("Variant not found");

        var sku = request.Sku.Trim();
        if (!string.Equals(sku, variant.Sku, StringComparison.Ordinal) && await products.VariantSkuExistsAsync(sku, variantId))
        {
            throw new ArgumentException($"A variant with SKU {sku} already exists");
        }

        ApplyVariant(variant, request, sku);
        variant.Inventory ??= new ShopInventory { TenantId = variant.TenantId, VariantId = variant.Id };
        if (request.LowStockThreshold.HasValue) variant.Inventory.LowStockThreshold = request.LowStockThreshold.Value;
        // initialStock is only used on creation; stock changes go through PATCH api/shop/admin/inventory/{variantId}.

        if (request.IsDefault) SetDefault(product, variant);
        EnsureDefaultExists(product);

        await db.SaveChangesAsync();
        return product.ToAdminDetailDto();
    }

    public async Task<ShopAdminProductDetailDto> DeleteVariantAsync(ulong productId, ulong variantId)
    {
        var product = await LoadAsync(productId);
        var variant = product.Variants.FirstOrDefault(v => v.Id == variantId && v.DeletedAt == null)
                      ?? throw new KeyNotFoundException("Variant not found");

        if (product.Variants.Count(v => v.DeletedAt == null) <= 1)
        {
            throw new ArgumentException("A product must have at least one variant");
        }

        variant.DeletedAt = DateTime.UtcNow;
        variant.IsActive = false;
        variant.IsDefault = false;
        EnsureDefaultExists(product);

        await db.ShopCartItems.Where(ci => ci.VariantId == variantId).ExecuteDeleteAsync();
        await db.SaveChangesAsync();
        return product.ToAdminDetailDto();
    }

    // ---------- Images ----------

    public async Task<ShopAdminProductDetailDto> UploadImageAsync(ulong productId, UploadShopImageRequest request)
    {
        var file = request.File ?? throw new ArgumentException("An image file is required.");
        ShopValidation.MaxLength(request.AltText, 250, "altText");

        var product = await LoadAsync(productId);
        EnsureImageCapacity(product);

        // IFileStorage validates type (jpg/png/webp/heic) and size (5 MB).
        var url = await storage.SaveAsync(file, ImageFolder(product), FileKind.Image);

        AddImage(product, url, request.AltText, request.IsPrimary);
        try
        {
            await db.SaveChangesAsync();
        }
        catch
        {
            // Don't leave orphaned files behind if the DB write fails.
            await storage.DeleteAsync(url);
            throw;
        }

        return product.ToAdminDetailDto();
    }

    public async Task<ShopAdminProductDetailDto> AddImageUrlAsync(ulong productId, AddShopImageUrlRequest request)
    {
        ShopValidation.NotEmpty(request.Url, "url");
        ShopValidation.ImageUrl(request.Url.Trim(), "url");
        ShopValidation.MaxLength(request.AltText, 250, "altText");

        var product = await LoadAsync(productId);
        EnsureImageCapacity(product);
        AddImage(product, request.Url.Trim(), request.AltText, request.IsPrimary);
        await db.SaveChangesAsync();
        return product.ToAdminDetailDto();
    }

    public async Task<ShopAdminProductDetailDto> UpdateImageAsync(ulong productId, ulong imageId, UpdateShopImageRequest request)
    {
        ShopValidation.MaxLength(request.AltText, 250, "altText");
        ShopValidation.Between(request.SortOrder, 0, 10_000, "sortOrder");

        var product = await LoadAsync(productId);
        var image = product.Images.FirstOrDefault(i => i.Id == imageId) ?? throw new KeyNotFoundException("Image not found");

        image.AltText = string.IsNullOrWhiteSpace(request.AltText) ? null : request.AltText.Trim();
        image.SortOrder = request.SortOrder;

        if (request.IsPrimary)
        {
            foreach (var i in product.Images) i.IsPrimary = i.Id == image.Id;
        }
        else if (image.IsPrimary)
        {
            image.IsPrimary = false;
            EnsurePrimaryImage(product);
        }

        await db.SaveChangesAsync();
        return product.ToAdminDetailDto();
    }

    public async Task<ShopAdminProductDetailDto> DeleteImageAsync(ulong productId, ulong imageId)
    {
        var product = await LoadAsync(productId);
        var image = product.Images.FirstOrDefault(i => i.Id == imageId) ?? throw new KeyNotFoundException("Image not found");

        product.Images.Remove(image);
        db.ShopProductImages.Remove(image);
        if (image.IsPrimary) EnsurePrimaryImage(product);
        await db.SaveChangesAsync();

        // Only files this shop uploaded (stored under the product's folder) are removed from storage;
        // images added by URL point elsewhere and are left alone.
        if (IsOwnUpload(product, image.Url))
        {
            await storage.DeleteAsync(image.Url);
        }

        return product.ToAdminDetailDto();
    }

    // ---------- Helpers ----------

    private static string ImageFolder(ShopProduct product) => $"tenant-{product.TenantId}/shop/products/{product.Id}";

    private static bool IsOwnUpload(ShopProduct product, string url) =>
        url.Contains($"/{ImageFolder(product)}/", StringComparison.Ordinal);

    private async Task<ShopProduct> LoadAsync(ulong id) =>
        await products.GetForAdminAsync(id) ?? throw new KeyNotFoundException("Product not found");

    private async Task EnsureCategoryExistsAsync(ulong categoryId)
    {
        var tid = currentUser.ResolveTenantId();
        if (!await db.ShopCategories.AnyAsync(c => c.Id == categoryId && c.TenantId == tid && c.DeletedAt == null))
        {
            throw new ArgumentException("Category does not exist.");
        }
    }

    private async Task<string> ResolveSlugAsync(string? requested, string name, ulong? productId, string? currentSlug = null)
    {
        if (!string.IsNullOrWhiteSpace(requested))
        {
            var slug = requested.Trim().ToLowerInvariant();
            if (slug != currentSlug && await products.SlugExistsAsync(slug, productId))
            {
                throw new ArgumentException($"A product with slug '{slug}' already exists");
            }
            return slug;
        }

        // Keep the existing slug on update when none is supplied (stable URLs).
        if (currentSlug is not null) return currentSlug;

        var baseSlug = ShopSlug.Slugify(name);
        var candidate = baseSlug;
        for (var i = 2; await products.SlugExistsAsync(candidate, productId); i++)
        {
            candidate = $"{baseSlug}-{i}";
        }
        return candidate;
    }

    private static void ValidateProduct(UpsertShopProductRequest r)
    {
        ShopValidation.NotEmpty(r.Name, "name");
        ShopValidation.MaxLength(r.Name, 200, "name");
        ShopValidation.Slug(r.Slug, 220);
        ShopValidation.Sku(r.Sku);
        ShopValidation.MaxLength(r.ShortDescription, 500, "shortDescription");
        ShopValidation.MaxLength(r.Description, 10000, "description");
        ShopValidation.MaxLength(r.Brand, 100, "brand");
        ShopValidation.Money(r.BasePrice, "basePrice");
        ShopValidation.Require(r.BasePrice > 0, "basePrice must be greater than 0.");
        ShopValidation.Money(r.CompareAtPrice, "compareAtPrice");
        ShopValidation.Require(!r.CompareAtPrice.HasValue || r.CompareAtPrice > r.BasePrice, "compareAtPrice must be greater than basePrice.");
        ShopValidation.Require(r.CategoryId > 0, "categoryId is required.");
        if (r.Specifications is { } s)
        {
            ShopValidation.Require(s.Count <= 40, "At most 40 specifications are allowed.");
            ShopValidation.Require(s.All(kv => !string.IsNullOrWhiteSpace(kv.Key) && kv.Key.Length <= 60), "Specification names must be 1-60 characters.");
            ShopValidation.Require(s.All(kv => kv.Value is not null && kv.Value.Length <= 500), "Specification values must be at most 500 characters.");
        }
    }

    private static void ValidateVariant(UpsertShopVariantRequest r)
    {
        ShopValidation.Sku(r.Sku);
        ShopValidation.NotEmpty(r.Name, "name");
        ShopValidation.MaxLength(r.Name, 150, "name");
        ShopValidation.MaxLength(r.Flavour, 50, "flavour");
        ShopValidation.MaxLength(r.Size, 50, "size");
        ShopValidation.MaxLength(r.Colour, 50, "colour");
        ShopValidation.MaxLength(r.Weight, 50, "weight");
        ShopValidation.Money(r.Price, "price");
        ShopValidation.Require(r.Price > 0, "price must be greater than 0.");
        ShopValidation.Money(r.CompareAtPrice, "compareAtPrice");
        ShopValidation.Require(!r.CompareAtPrice.HasValue || r.CompareAtPrice > r.Price, "compareAtPrice must be greater than price.");
        ShopValidation.Between(r.InitialStock, 0, 1_000_000, "initialStock");
        ShopValidation.Between(r.LowStockThreshold, 0, 100_000, "lowStockThreshold");
    }

    private static void Apply(ShopProduct product, UpsertShopProductRequest r, string slug, string sku)
    {
        product.Name = r.Name.Trim();
        product.Slug = slug;
        product.Sku = sku;
        product.ShortDescription = string.IsNullOrWhiteSpace(r.ShortDescription) ? null : r.ShortDescription.Trim();
        product.Description = string.IsNullOrWhiteSpace(r.Description) ? null : r.Description.Trim();
        product.Brand = string.IsNullOrWhiteSpace(r.Brand) ? null : r.Brand.Trim();
        product.BasePrice = r.BasePrice;
        product.CompareAtPrice = r.CompareAtPrice;
        product.CategoryId = r.CategoryId;
        product.IsActive = r.IsActive;
        product.IsFeatured = r.IsFeatured;
        product.IsNew = r.IsNew;
        product.Specifications = (r.Specifications ?? new Dictionary<string, string>())
            .Where(kv => !string.IsNullOrWhiteSpace(kv.Key))
            .GroupBy(kv => kv.Key.Trim())
            .ToDictionary(g => g.Key, g => g.Last().Value?.Trim() ?? string.Empty);
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static void ApplyVariant(ShopVariant v, UpsertShopVariantRequest r, string sku)
    {
        v.Sku = sku;
        v.Name = r.Name.Trim();
        v.Flavour = Clean(r.Flavour);
        v.Size = Clean(r.Size);
        v.Colour = Clean(r.Colour);
        v.Weight = Clean(r.Weight);
        v.Price = r.Price;
        v.CompareAtPrice = r.CompareAtPrice;
        v.IsActive = r.IsActive;
        v.IsDefault = r.IsDefault;
    }

    private static void SetDefault(ShopProduct product, ShopVariant target)
    {
        foreach (var v in product.Variants.Where(v => v.DeletedAt == null)) v.IsDefault = ReferenceEquals(v, target);
    }

    private static void EnsureDefaultExists(ShopProduct product)
    {
        var live = product.Variants.Where(v => v.DeletedAt == null).ToList();
        if (live.Count == 0 || live.Any(v => v.IsDefault)) return;
        var next = live.Where(v => v.IsActive).OrderBy(v => v.Price).FirstOrDefault() ?? live.OrderBy(v => v.Price).First();
        next.IsDefault = true;
    }

    private static void EnsureImageCapacity(ShopProduct product)
    {
        if (product.Images.Count >= MaxImagesPerProduct)
        {
            throw new ArgumentException($"A product can have at most {MaxImagesPerProduct} images");
        }
    }

    private void AddImage(ShopProduct product, string url, string? altText, bool isPrimary)
    {
        var makePrimary = isPrimary || product.Images.Count == 0;
        if (makePrimary)
        {
            foreach (var i in product.Images) i.IsPrimary = false;
        }

        var image = new ShopProductImage
        {
            TenantId = product.TenantId,
            ProductId = product.Id,
            Url = url,
            AltText = string.IsNullOrWhiteSpace(altText) ? product.Name : altText.Trim(),
            SortOrder = product.Images.Count == 0 ? 0 : product.Images.Max(i => i.SortOrder) + 1,
            IsPrimary = makePrimary
        };
        product.Images.Add(image);
        db.ShopProductImages.Add(image);
    }

    private static void EnsurePrimaryImage(ShopProduct product)
    {
        if (product.Images.Count == 0 || product.Images.Any(i => i.IsPrimary)) return;
        product.Images.OrderBy(i => i.SortOrder).ThenBy(i => i.CreatedAt).First().IsPrimary = true;
    }
}

// ───────────────────────────── Categories ─────────────────────────────

public interface IShopAdminCategoryService
{
    Task<IReadOnlyList<ShopAdminCategoryDto>> GetAllAsync();
    Task<ShopAdminCategoryDto> CreateAsync(UpsertShopCategoryRequest request);
    Task<ShopAdminCategoryDto> UpdateAsync(ulong id, UpsertShopCategoryRequest request);
    Task DeleteAsync(ulong id);
}

public sealed class ShopAdminCategoryService(IAppDbContext db, ICurrentUser currentUser) : IShopAdminCategoryService
{
    private ulong Tid => currentUser.ResolveTenantId();

    private IQueryable<ShopCategory> Categories()
    {
        var tid = Tid;
        return db.ShopCategories.Where(c => c.TenantId == tid && c.DeletedAt == null);
    }

    private IQueryable<ShopProduct> Products()
    {
        var tid = Tid;
        return db.ShopProducts.Where(p => p.TenantId == tid && p.DeletedAt == null);
    }

    public async Task<IReadOnlyList<ShopAdminCategoryDto>> GetAllAsync()
    {
        var counts = await Products().AsNoTracking()
            .GroupBy(p => p.CategoryId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count);
        var categories = await Categories().AsNoTracking()
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .ToListAsync();
        return categories.Select(c => ToDto(c, counts.GetValueOrDefault(c.Id))).ToList();
    }

    public async Task<ShopAdminCategoryDto> CreateAsync(UpsertShopCategoryRequest request)
    {
        var category = new ShopCategory { TenantId = Tid };
        await ApplyAsync(category, request);
        db.ShopCategories.Add(category);
        await db.SaveChangesAsync();
        return ToDto(category, 0);
    }

    public async Task<ShopAdminCategoryDto> UpdateAsync(ulong id, UpsertShopCategoryRequest request)
    {
        var category = await Categories().FirstOrDefaultAsync(c => c.Id == id) ?? throw new KeyNotFoundException("Category not found");
        await ApplyAsync(category, request);
        await db.SaveChangesAsync();
        var count = await Products().CountAsync(p => p.CategoryId == id);
        return ToDto(category, count);
    }

    public async Task DeleteAsync(ulong id)
    {
        var category = await Categories().FirstOrDefaultAsync(c => c.Id == id) ?? throw new KeyNotFoundException("Category not found");
        if (await Products().AnyAsync(p => p.CategoryId == id))
        {
            throw new ArgumentException("This category still contains products. Move or delete them first.");
        }
        if (await Categories().AnyAsync(c => c.ParentId == id))
        {
            throw new ArgumentException("This category has sub-categories. Move or delete them first.");
        }

        category.DeletedAt = DateTime.UtcNow;
        category.IsActive = false;
        await db.SaveChangesAsync();
    }

    private static void Validate(UpsertShopCategoryRequest r)
    {
        ShopValidation.NotEmpty(r.Name, "name");
        ShopValidation.MaxLength(r.Name, 120, "name");
        ShopValidation.Slug(r.Slug, 140);
        ShopValidation.MaxLength(r.Description, 1000, "description");
        ShopValidation.ImageUrl(r.ImageUrl, "imageUrl");
        ShopValidation.Between(r.SortOrder, 0, 10_000, "sortOrder");
    }

    private async Task ApplyAsync(ShopCategory category, UpsertShopCategoryRequest r)
    {
        Validate(r);
        var slug = string.IsNullOrWhiteSpace(r.Slug) ? ShopSlug.Slugify(r.Name) : r.Slug.Trim().ToLowerInvariant();
        if (slug != category.Slug && await Categories().AnyAsync(c => c.Slug == slug && c.Id != category.Id))
        {
            throw new ArgumentException($"A category with slug '{slug}' already exists");
        }

        if (r.ParentId.HasValue)
        {
            var parentId = r.ParentId.Value;
            if (parentId == category.Id) throw new ArgumentException("A category cannot be its own parent.");

            var all = await Categories().AsNoTracking().Select(c => new { c.Id, c.ParentId }).ToListAsync();
            if (all.All(c => c.Id != parentId)) throw new ArgumentException("Parent category does not exist.");

            // Walk up from the proposed parent: reaching this category would create a cycle.
            var parents = all.ToDictionary(c => c.Id, c => c.ParentId);
            ulong? cursor = parentId;
            var guard = 0;
            while (cursor.HasValue && guard++ < 100)
            {
                if (cursor.Value == category.Id) throw new ArgumentException("A category cannot be moved under its own descendant.");
                cursor = parents.GetValueOrDefault(cursor.Value);
            }
        }

        category.Name = r.Name.Trim();
        category.Slug = slug;
        category.Description = string.IsNullOrWhiteSpace(r.Description) ? null : r.Description.Trim();
        category.ImageUrl = string.IsNullOrWhiteSpace(r.ImageUrl) ? null : r.ImageUrl.Trim();
        category.ParentId = r.ParentId;
        category.SortOrder = r.SortOrder;
        category.IsActive = r.IsActive;
    }

    private static ShopAdminCategoryDto ToDto(ShopCategory c, int productCount) => new()
    {
        Id = c.Id,
        Name = c.Name,
        Slug = c.Slug,
        Description = c.Description,
        ImageUrl = c.ImageUrl,
        ParentId = c.ParentId,
        SortOrder = c.SortOrder,
        ProductCount = productCount,
        Children = [],
        IsActive = c.IsActive
    };
}
