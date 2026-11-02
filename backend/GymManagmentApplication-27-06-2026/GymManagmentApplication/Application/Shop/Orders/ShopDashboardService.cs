using System.Globalization;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Shop.Common;
using GymManagmentApplication.Domain.Entities.Shop;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Shop.Orders;

public interface IShopDashboardService
{
    Task<ShopDashboardDto> GetAsync();
}

/// <summary>The shop's admin overview. Ported from the store's DashboardService.</summary>
public sealed class ShopDashboardService(AppDbContext db, ICurrentUser currentUser, ShopOrderCore core) : IShopDashboardService
{
    private const int Days = 30;

    public async Task<ShopDashboardDto> GetAsync()
    {
        var tid = currentUser.ResolveTenantId();
        var today = DateTime.UtcNow.Date;
        var start = DateTime.SpecifyKind(today.AddDays(-(Days - 1)), DateTimeKind.Utc);
        var previousStart = start.AddDays(-Days);

        var orders = db.ShopOrders.AsNoTracking().Where(o => o.TenantId == tid);
        var valid = orders.Where(o => o.Status != ShopOrderStatus.Cancelled);

        var totals = await valid
            .GroupBy(_ => 1)
            .Select(g => new { Revenue = g.Sum(o => o.Total), Count = g.Count() })
            .FirstOrDefaultAsync();
        var totalRevenue = totals?.Revenue ?? 0m;
        var ordersCount = totals?.Count ?? 0;

        var revenueLast30 = await valid.Where(o => o.PlacedAt >= start).SumAsync(o => (decimal?)o.Total) ?? 0m;
        var revenuePrevious30 = await valid.Where(o => o.PlacedAt >= previousStart && o.PlacedAt < start)
            .SumAsync(o => (decimal?)o.Total) ?? 0m;

        // Buyers: people with at least one shop order (the store counted users with the Customer role).
        var customersCount = await orders.Select(o => o.UserId).Distinct().CountAsync();
        var productsCount = await db.ShopProducts.CountAsync(p => p.TenantId == tid && p.DeletedAt == null);

        // Grouped by UTC calendar day in memory: only the last 30 days' rows are read.
        var recent = await valid.Where(o => o.PlacedAt >= start).Select(o => new { o.PlacedAt, o.Total }).ToListAsync();
        var dailyLookup = recent
            .GroupBy(o => DateTime.SpecifyKind(o.PlacedAt, DateTimeKind.Utc).ToUniversalTime().Date)
            .ToDictionary(g => g.Key, g => (Revenue: g.Sum(o => o.Total), Orders: g.Count()));

        var salesByDay = Enumerable.Range(0, Days)
            .Select(i => start.AddDays(i).Date)
            .Select(day => dailyLookup.TryGetValue(day, out var d)
                ? new ShopSalesByDayDto(day.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), d.Revenue, d.Orders)
                : new ShopSalesByDayDto(day.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), 0m, 0))
            .ToList();

        var statusCounts = await orders
            .GroupBy(o => o.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync();
        var ordersByStatus = Enum.GetValues<ShopOrderStatus>()
            .Select(s => new ShopOrdersByStatusDto(s, statusCounts.FirstOrDefault(c => c.Status == s)?.Count ?? 0))
            .ToList();

        var topProducts = await db.ShopOrderItems.AsNoTracking()
            .Where(i => i.TenantId == tid && i.Order.Status != ShopOrderStatus.Cancelled)
            .GroupBy(i => i.ProductId)
            .Select(g => new
            {
                ProductId = g.Key,
                Name = g.Max(i => i.ProductName) ?? "",
                ImageUrl = g.Max(i => i.ImageUrl),
                Units = g.Sum(i => i.Quantity),
                Revenue = g.Sum(i => i.LineTotal)
            })
            .OrderByDescending(x => x.Units).ThenByDescending(x => x.Revenue)
            .Take(5)
            .ToListAsync();

        var recentOrders = await core.GetRecentSummariesAsync(core.Query(tid), 5, includeCustomer: true);
        var lowStock = await GetLowStockAsync(tid, 10);

        return new ShopDashboardDto
        {
            TotalRevenue = totalRevenue,
            OrdersCount = ordersCount,
            CustomersCount = customersCount,
            ProductsCount = productsCount,
            AverageOrderValue = ordersCount == 0 ? 0m : ShopPricing.Round(totalRevenue / ordersCount),
            RevenueLast30Days = revenueLast30,
            RevenuePrevious30Days = revenuePrevious30,
            SalesByDay = salesByDay,
            OrdersByStatus = ordersByStatus,
            TopProducts = topProducts.Select(t => new ShopTopProductDto(t.ProductId, t.Name, t.ImageUrl, t.Units, t.Revenue)).ToList(),
            RecentOrders = recentOrders,
            LowStock = lowStock
        };
    }

    /// <summary>Active variants of active products at or under their low-stock threshold (or with no stock row), lowest first.</summary>
    private Task<List<ShopLowStockItemDto>> GetLowStockAsync(ulong tid, int take) =>
        db.ShopVariants.AsNoTracking()
            .Where(v => v.TenantId == tid && v.DeletedAt == null && v.IsActive
                        && v.Product.DeletedAt == null && v.Product.IsActive)
            .Where(v => v.Inventory == null ||
                        v.Inventory.QuantityOnHand - v.Inventory.ReservedQuantity <= v.Inventory.LowStockThreshold)
            .OrderBy(v => v.Inventory != null ? v.Inventory.QuantityOnHand - v.Inventory.ReservedQuantity : 0)
            .ThenBy(v => v.Product.Name)
            .Take(take)
            .Select(v => new ShopLowStockItemDto
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
                IsLowStock = true
            })
            .ToListAsync();
}
