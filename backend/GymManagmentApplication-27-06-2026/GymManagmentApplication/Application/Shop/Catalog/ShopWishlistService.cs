using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Shop;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Shop.Catalog;

// The member's wishlist, ported from Unique Lights Services/WishlistService.cs.

public interface IShopWishlistService
{
    Task<ShopWishlistDto> GetAsync();
    Task<ShopWishlistDto> AddAsync(ulong productId);
    Task<ShopWishlistDto> RemoveAsync(ulong productId);
}

public sealed class ShopWishlistService(AppDbContext db, ICurrentUser currentUser, IShopProductQueries products) : IShopWishlistService
{
    private const int MaxItems = 200;

    private ulong RequireUserId() =>
        currentUser.UserId ?? throw new UnauthorizedAccessException("Unauthorized. Token is missing or invalid.");

    public async Task<ShopWishlistDto> GetAsync()
    {
        var wishlistId = await GetOrCreateIdAsync();
        return await BuildAsync(wishlistId);
    }

    public async Task<ShopWishlistDto> AddAsync(ulong productId)
    {
        ShopValidation.Require(productId > 0, "productId is required.");
        var wishlistId = await GetOrCreateIdAsync();

        if (!await products.QueryPublic().AnyAsync(p => p.Id == productId))
        {
            throw new KeyNotFoundException("Product not found");
        }

        var exists = await db.ShopWishlistItems.AnyAsync(w => w.WishlistId == wishlistId && w.ProductId == productId);
        if (!exists)
        {
            if (await db.ShopWishlistItems.CountAsync(w => w.WishlistId == wishlistId) >= MaxItems)
            {
                throw new ArgumentException($"Your wishlist can contain at most {MaxItems} products.");
            }

            db.ShopWishlistItems.Add(new ShopWishlistItem
            {
                TenantId = currentUser.ResolveTenantId(),
                WishlistId = wishlistId,
                ProductId = productId
            });
            try
            {
                await db.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (IsDuplicate(ex))
            {
                // Concurrent duplicate add: the endpoint is idempotent.
                db.ChangeTracker.Clear();
            }
        }

        return await BuildAsync(wishlistId);
    }

    public async Task<ShopWishlistDto> RemoveAsync(ulong productId)
    {
        var wishlistId = await GetOrCreateIdAsync();
        await db.ShopWishlistItems.Where(w => w.WishlistId == wishlistId && w.ProductId == productId).ExecuteDeleteAsync();
        return await BuildAsync(wishlistId);
    }

    private static bool IsDuplicate(DbUpdateException ex) =>
        ex.InnerException is Npgsql.PostgresException { SqlState: Npgsql.PostgresErrorCodes.UniqueViolation } pg
        && pg.ConstraintName?.StartsWith("PK_", StringComparison.Ordinal) != true;

    private async Task<ulong> GetOrCreateIdAsync()
    {
        var userId = RequireUserId();
        var tid = currentUser.ResolveTenantId();
        var existing = await db.ShopWishlists.AsNoTracking()
            .Where(w => w.TenantId == tid && w.UserId == userId)
            .Select(w => (ulong?)w.Id).FirstOrDefaultAsync();
        if (existing.HasValue) return existing.Value;

        var wishlist = new ShopWishlist { TenantId = tid, UserId = userId };
        db.ShopWishlists.Add(wishlist);
        try
        {
            await db.SaveChangesAsync();
            return wishlist.Id;
        }
        catch (DbUpdateException ex) when (IsDuplicate(ex))
        {
            db.Entry(wishlist).State = EntityState.Detached;
            return await db.ShopWishlists.AsNoTracking()
                .Where(w => w.TenantId == tid && w.UserId == userId).Select(w => w.Id).FirstAsync();
        }
    }

    private async Task<ShopWishlistDto> BuildAsync(ulong wishlistId)
    {
        var rows = await db.ShopWishlistItems.AsNoTracking()
            .Where(w => w.WishlistId == wishlistId)
            .OrderByDescending(w => w.CreatedAt)
            .Select(w => new { w.Id, w.ProductId, w.CreatedAt })
            .ToListAsync();

        var cards = (await products.GetCardsByIdsAsync(rows.Select(r => r.ProductId).ToList()))
            .ToDictionary(p => p.Id);

        // Products that became unavailable (inactive / deleted) are hidden from the wishlist.
        return new ShopWishlistDto
        {
            Items = rows
                .Where(r => cards.ContainsKey(r.ProductId))
                .Select(r => new ShopWishlistItemDto
                {
                    Id = r.Id,
                    ProductId = r.ProductId,
                    AddedAt = r.CreatedAt,
                    Product = cards[r.ProductId]
                })
                .ToList()
        };
    }
}
