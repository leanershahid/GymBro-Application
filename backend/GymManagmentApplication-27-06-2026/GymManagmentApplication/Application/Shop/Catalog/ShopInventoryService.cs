using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Shop.Common;
using GymManagmentApplication.Domain.Entities.Shop;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Shop.Catalog;

// Stock per variant, ported from Unique Lights Services/Admin/InventoryService.cs.
// Low stock = available (on hand − reserved) ≤ threshold, or no inventory row at all.

public interface IShopInventoryService
{
    Task<PagedResponse<ShopInventoryItemDto>> SearchAsync(ShopInventoryQuery query);
    /// <summary>Active variants of active products that are low on stock, lowest available first (for dashboards).</summary>
    Task<IReadOnlyList<ShopInventoryItemDto>> GetLowStockAsync(int take);
    Task<ShopInventoryItemDto> UpdateAsync(ulong variantId, UpdateShopInventoryRequest request);
}

public sealed class ShopInventoryService(AppDbContext db, ICurrentUser currentUser, ILogger<ShopInventoryService> logger) : IShopInventoryService
{
    /// <summary>Non-deleted variants of non-deleted products of this gym.</summary>
    private IQueryable<ShopVariant> Variants()
    {
        var tid = currentUser.ResolveTenantId();
        return db.ShopVariants.AsNoTracking()
            .Where(v => v.TenantId == tid && v.DeletedAt == null && v.Product.DeletedAt == null);
    }

    private static IQueryable<ShopInventoryItemDto> Project(IQueryable<ShopVariant> query) =>
        query.Select(v => new ShopInventoryItemDto
        {
            VariantId = v.Id,
            ProductId = v.ProductId,
            ProductName = v.Product.Name,
            VariantName = v.Name,
            Sku = v.Sku,
            ImageUrl = v.Product.Images
                .OrderByDescending(i => i.IsPrimary).ThenBy(i => i.SortOrder).ThenBy(i => i.CreatedAt)
                .Select(i => i.Url).FirstOrDefault(),
            QuantityOnHand = v.Inventory != null ? v.Inventory.QuantityOnHand : 0,
            ReservedQuantity = v.Inventory != null ? v.Inventory.ReservedQuantity : 0,
            Available = v.Inventory != null && v.Inventory.QuantityOnHand > v.Inventory.ReservedQuantity
                ? v.Inventory.QuantityOnHand - v.Inventory.ReservedQuantity
                : 0,
            LowStockThreshold = v.Inventory != null ? v.Inventory.LowStockThreshold : 5,
            IsLowStock = v.Inventory == null ||
                         v.Inventory.QuantityOnHand - v.Inventory.ReservedQuantity <= v.Inventory.LowStockThreshold
        });

    private static IQueryable<ShopVariant> WhereLowStock(IQueryable<ShopVariant> query) =>
        query.Where(v => v.Inventory == null ||
                         v.Inventory.QuantityOnHand - v.Inventory.ReservedQuantity <= v.Inventory.LowStockThreshold);

    public async Task<PagedResponse<ShopInventoryItemDto>> SearchAsync(ShopInventoryQuery q)
    {
        ShopValidation.MaxLength(q.Search, 100, "search");
        var (page, size) = ShopSearch.Paging(q.Page, q.PageSize);

        var query = Variants();
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var pattern = ShopSearch.Contains(q.Search);
            const string esc = ShopSearch.EscapeCharacter;
            query = query.Where(v =>
                EF.Functions.ILike(v.Sku, pattern, esc) ||
                EF.Functions.ILike(v.Name, pattern, esc) ||
                EF.Functions.ILike(v.Product.Name, pattern, esc));
        }

        if (q.LowStockOnly == true) query = WhereLowStock(query);

        var total = await query.CountAsync();
        var items = await Project(query
                .OrderBy(v => v.Product.Name).ThenBy(v => v.Name).ThenBy(v => v.Id)
                .Skip((page - 1) * size).Take(size))
            .ToListAsync();
        return ShopSearch.Page(items, page, size, total);
    }

    public async Task<IReadOnlyList<ShopInventoryItemDto>> GetLowStockAsync(int take) =>
        await Project(WhereLowStock(Variants().Where(v => v.IsActive && v.Product.IsActive))
                .OrderBy(v => v.Inventory != null ? v.Inventory.QuantityOnHand - v.Inventory.ReservedQuantity : 0)
                .ThenBy(v => v.Product.Name)
                .Take(take))
            .ToListAsync();

    public async Task<ShopInventoryItemDto> UpdateAsync(ulong variantId, UpdateShopInventoryRequest request)
    {
        ShopValidation.Require(!(request.QuantityOnHand.HasValue && request.Adjustment.HasValue),
            "Provide either quantityOnHand or adjustment, not both.");
        ShopValidation.Require(request.QuantityOnHand.HasValue || request.Adjustment.HasValue || request.LowStockThreshold.HasValue,
            "Provide quantityOnHand, adjustment or lowStockThreshold.");
        ShopValidation.Between(request.QuantityOnHand, 0, 1_000_000, "quantityOnHand");
        ShopValidation.Between(request.Adjustment, -1_000_000, 1_000_000, "adjustment");
        ShopValidation.Require(request.Adjustment != 0, "adjustment must not be 0.");
        ShopValidation.Between(request.LowStockThreshold, 0, 100_000, "lowStockThreshold");

        var tid = currentUser.ResolveTenantId();
        var variant = await db.ShopVariants.Include(v => v.Inventory)
                          .FirstOrDefaultAsync(v => v.Id == variantId && v.TenantId == tid &&
                                                    v.DeletedAt == null && v.Product.DeletedAt == null)
                      ?? throw new KeyNotFoundException("Variant not found");

        var inventory = variant.Inventory;
        if (inventory is null)
        {
            inventory = new ShopInventory { TenantId = variant.TenantId, VariantId = variant.Id };
            db.ShopInventories.Add(inventory);
        }

        var before = inventory.QuantityOnHand;
        if (request.QuantityOnHand.HasValue)
        {
            inventory.QuantityOnHand = request.QuantityOnHand.Value;
        }
        else if (request.Adjustment.HasValue)
        {
            var next = inventory.QuantityOnHand + request.Adjustment.Value;
            if (next < 0)
            {
                throw new ArgumentException($"Adjustment would make stock negative (on hand: {inventory.QuantityOnHand})");
            }
            inventory.QuantityOnHand = next;
        }

        if (request.LowStockThreshold.HasValue) inventory.LowStockThreshold = request.LowStockThreshold.Value;
        if (inventory.QuantityOnHand < inventory.ReservedQuantity)
        {
            throw new ArgumentException($"Quantity on hand cannot be lower than the reserved quantity ({inventory.ReservedQuantity})");
        }

        try
        {
            // xmin concurrency token: a checkout changing this row at the same moment fails the save.
            await db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ArgumentException("The stock was changed by someone else at the same moment. Please reload and try again.");
        }
        logger.LogInformation("Shop inventory for variant {VariantId} changed from {Before} to {After}", variantId, before, inventory.QuantityOnHand);

        return await Project(Variants().Where(v => v.Id == variantId)).FirstAsync();
    }
}
