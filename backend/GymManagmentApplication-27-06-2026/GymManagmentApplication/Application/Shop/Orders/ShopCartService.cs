using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Shop.Common;
using GymManagmentApplication.Domain.Entities.Shop;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace GymManagmentApplication.Application.Shop.Orders;

public interface IShopCartService
{
    Task<ShopCartDto> GetAsync();
    Task<ShopCartDto> AddItemAsync(ShopAddCartItemRequest request);
    Task<ShopCartDto> UpdateItemAsync(ulong itemId, ShopUpdateCartItemRequest request);
    Task<ShopCartDto> RemoveItemAsync(ulong itemId);
    Task<ShopCartDto> ClearAsync();

    // Used by checkout.
    Task<ulong> GetOrCreateCartIdAsync(ulong tenantId, ulong userId);
    Task<ShopCartDto> GetCartDtoAsync(ulong cartId);
    /// <summary>Tracked cart lines with variant, inventory, product, images and category loaded.</summary>
    Task<List<ShopCartItem>> GetItemsForCheckoutAsync(ulong tenantId, ulong userId);
}

/// <summary>The member's cart: one per person per gym. Ported from the store's CartService + CartRepository.</summary>
public sealed class ShopCartService(IAppDbContext db, ICurrentUser currentUser) : IShopCartService
{
    public const int MaxQuantityPerLine = 99;

    private sealed record VariantInfo(ulong Id, string ProductName, string VariantName, bool Purchasable, int Available);

    private ulong TenantId => currentUser.ResolveTenantId();
    private ulong UserId => currentUser.UserId ?? throw new UnauthorizedAccessException("Please sign in again.");

    public async Task<ShopCartDto> GetAsync()
    {
        var cartId = await GetOrCreateCartIdAsync(TenantId, UserId);
        return await GetCartDtoAsync(cartId);
    }

    public async Task<ShopCartDto> AddItemAsync(ShopAddCartItemRequest request)
    {
        if (request.VariantId == 0) throw new ArgumentException("Choose a product option.");
        EnsureQuantity(request.Quantity);

        var tid = TenantId;
        var cartId = await GetOrCreateCartIdAsync(tid, UserId);
        var variant = await GetVariantInfoAsync(tid, request.VariantId) ?? throw new KeyNotFoundException("Product variant not found");
        EnsurePurchasable(variant);

        var item = await db.ShopCartItems.FirstOrDefaultAsync(ci => ci.CartId == cartId && ci.VariantId == variant.Id);
        var newQuantity = (item?.Quantity ?? 0) + request.Quantity;
        if (newQuantity > MaxQuantityPerLine)
            throw ShopRuleException.Rule($"You can add at most {MaxQuantityPerLine} units of an item to your cart.");
        EnsureStock(variant, newQuantity);

        if (item is null)
            db.ShopCartItems.Add(new ShopCartItem { Id = 0, TenantId = tid, CartId = cartId, VariantId = variant.Id, Quantity = newQuantity });
        else
        {
            item.Quantity = newQuantity;
            item.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();
        return await GetCartDtoAsync(cartId);
    }

    public async Task<ShopCartDto> UpdateItemAsync(ulong itemId, ShopUpdateCartItemRequest request)
    {
        EnsureQuantity(request.Quantity);
        var tid = TenantId;
        var cartId = await GetOrCreateCartIdAsync(tid, UserId);
        var item = await db.ShopCartItems.FirstOrDefaultAsync(ci => ci.Id == itemId && ci.CartId == cartId)
                   ?? throw new KeyNotFoundException("Cart item not found");

        var variant = await GetVariantInfoAsync(tid, item.VariantId) ?? throw new KeyNotFoundException("Product variant not found");
        EnsurePurchasable(variant);
        EnsureStock(variant, request.Quantity);

        item.Quantity = request.Quantity;
        item.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return await GetCartDtoAsync(cartId);
    }

    public async Task<ShopCartDto> RemoveItemAsync(ulong itemId)
    {
        var cartId = await GetOrCreateCartIdAsync(TenantId, UserId);
        var deleted = await db.ShopCartItems.Where(ci => ci.Id == itemId && ci.CartId == cartId).ExecuteDeleteAsync();
        if (deleted == 0) throw new KeyNotFoundException("Cart item not found");
        return await GetCartDtoAsync(cartId);
    }

    public async Task<ShopCartDto> ClearAsync()
    {
        var cartId = await GetOrCreateCartIdAsync(TenantId, UserId);
        await db.ShopCartItems.Where(ci => ci.CartId == cartId).ExecuteDeleteAsync();
        return await GetCartDtoAsync(cartId);
    }

    // ---------- Shared with checkout ----------

    public async Task<ulong> GetOrCreateCartIdAsync(ulong tenantId, ulong userId)
    {
        var existing = await FindCartIdAsync(tenantId, userId);
        if (existing.HasValue) return existing.Value;

        var cart = new ShopCart { Id = 0, TenantId = tenantId, UserId = userId };
        db.ShopCarts.Add(cart);
        try
        {
            await db.SaveChangesAsync();
            return cart.Id;
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // A concurrent request created the cart first.
            db.Entry(cart).State = EntityState.Detached;
            return await FindCartIdAsync(tenantId, userId)
                   ?? throw ShopRuleException.Conflict("Your cart was being updated at the same moment. Please try again.");
        }
    }

    private Task<ulong?> FindCartIdAsync(ulong tenantId, ulong userId) =>
        db.ShopCarts.AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.UserId == userId)
            .Select(c => (ulong?)c.Id)
            .FirstOrDefaultAsync();

    public async Task<ShopCartDto> GetCartDtoAsync(ulong cartId)
    {
        var rows = await db.ShopCartItems.AsNoTracking()
            .Where(ci => ci.CartId == cartId)
            .OrderBy(ci => ci.CreatedAt).ThenBy(ci => ci.Id)
            .Select(ci => new
            {
                ci.Id,
                ci.VariantId,
                ci.Variant.ProductId,
                ProductName = ci.Variant.Product.Name,
                ProductSlug = ci.Variant.Product.Slug,
                VariantName = ci.Variant.Name,
                ci.Variant.Flavour,
                ci.Variant.Size,
                ci.Variant.Colour,
                ci.Variant.Weight,
                ci.Variant.Sku,
                ImageUrl = ci.Variant.Product.Images
                    .OrderByDescending(i => i.IsPrimary).ThenBy(i => i.SortOrder).ThenBy(i => i.CreatedAt)
                    .Select(i => i.Url).FirstOrDefault(),
                ci.Variant.Price,
                ci.Variant.CompareAtPrice,
                ci.Quantity,
                Available = ci.Variant.Inventory != null
                    ? ci.Variant.Inventory.QuantityOnHand - ci.Variant.Inventory.ReservedQuantity
                    : 0,
                Purchasable = ci.Variant.IsActive && ci.Variant.DeletedAt == null
                              && ci.Variant.Product.IsActive && ci.Variant.Product.DeletedAt == null
                              && ci.Variant.Product.Category.IsActive && ci.Variant.Product.Category.DeletedAt == null
            })
            .ToListAsync();

        var items = rows.Select(r => new ShopCartItemDto
        {
            Id = r.Id,
            VariantId = r.VariantId,
            ProductId = r.ProductId,
            ProductName = r.ProductName,
            ProductSlug = r.ProductSlug,
            VariantName = r.VariantName,
            Flavour = r.Flavour,
            Size = r.Size,
            Colour = r.Colour,
            Weight = r.Weight,
            Sku = r.Sku,
            ImageUrl = r.ImageUrl,
            UnitPrice = r.Price,
            CompareAtPrice = ShopPricing.EffectiveCompareAt(r.Price, r.CompareAtPrice),
            Quantity = r.Quantity,
            LineTotal = ShopPricing.Round(r.Price * r.Quantity),
            AvailableStock = r.Purchasable ? Math.Max(0, r.Available) : 0
        }).ToList();

        return new ShopCartDto
        {
            Id = cartId,
            Items = items,
            ItemCount = items.Sum(i => i.Quantity),
            Subtotal = ShopPricing.Round(items.Sum(i => i.LineTotal))
        };
    }

    public Task<List<ShopCartItem>> GetItemsForCheckoutAsync(ulong tenantId, ulong userId) =>
        db.ShopCartItems
            .Where(ci => ci.TenantId == tenantId && ci.Cart.UserId == userId && ci.Cart.TenantId == tenantId)
            .Include(ci => ci.Variant).ThenInclude(v => v.Inventory)
            .Include(ci => ci.Variant).ThenInclude(v => v.Product).ThenInclude(p => p.Images)
            .Include(ci => ci.Variant).ThenInclude(v => v.Product).ThenInclude(p => p.Category)
            .OrderBy(ci => ci.CreatedAt).ThenBy(ci => ci.Id)
            .AsSplitQuery()
            .ToListAsync();

    // ---------- Rules ----------

    private Task<VariantInfo?> GetVariantInfoAsync(ulong tenantId, ulong variantId) =>
        db.ShopVariants.AsNoTracking()
            .Where(v => v.Id == variantId && v.TenantId == tenantId && v.DeletedAt == null && v.Product.DeletedAt == null)
            .Select(v => new VariantInfo(
                v.Id,
                v.Product.Name,
                v.Name,
                v.IsActive && v.Product.IsActive && v.Product.Category.IsActive && v.Product.Category.DeletedAt == null,
                v.Inventory != null ? v.Inventory.QuantityOnHand - v.Inventory.ReservedQuantity : 0))
            .FirstOrDefaultAsync();

    private static void EnsureQuantity(int quantity)
    {
        if (quantity is < 1 or > MaxQuantityPerLine)
            throw new ArgumentException($"Quantity must be between 1 and {MaxQuantityPerLine}.");
    }

    private static void EnsurePurchasable(VariantInfo variant)
    {
        if (!variant.Purchasable) throw ShopRuleException.Rule($"{variant.ProductName} is no longer available.");
    }

    private static void EnsureStock(VariantInfo variant, int quantity)
    {
        var available = Math.Max(0, variant.Available);
        if (quantity <= available) return;

        var name = $"{variant.ProductName} ({variant.VariantName})";
        throw ShopRuleException.Conflict(available == 0
            ? $"{name} is out of stock."
            : $"Only {available} unit{(available == 1 ? "" : "s")} of {name} available.");
    }
}
