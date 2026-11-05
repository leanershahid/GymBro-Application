using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Shop.Common;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Entities.Shop;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Shop.Orders;

public interface IShopAdminOrdersService
{
    Task<PagedResponse<ShopOrderSummaryDto>> SearchAsync(ShopOrderStatus? status, string? search, int page, int pageSize);
    Task<ShopOrderDto> GetAsync(string orderNumber);
    Task<ShopOrderDto> UpdateStatusAsync(string orderNumber, ShopUpdateOrderStatusRequest request);

    Task<PagedResponse<ShopAdminCustomerDto>> SearchCustomersAsync(string? search, int page, int pageSize);
    Task<ShopAdminCustomerDetailDto> GetCustomerAsync(ulong id);
}

/// <summary>The gym's side of shop orders and buyers (the store's admin OrderService half + AdminCustomerService).</summary>
public sealed class ShopAdminOrdersService(
    AppDbContext db,
    ICurrentUser currentUser,
    ShopOrderCore core,
    ILogger<ShopAdminOrdersService> logger) : IShopAdminOrdersService
{
    /// <summary>Forward progression. Processing is an internal step (not shown in the customer timeline).</summary>
    private static readonly ShopOrderStatus[] Flow =
    [
        ShopOrderStatus.Pending, ShopOrderStatus.Confirmed, ShopOrderStatus.Processing,
        ShopOrderStatus.Shipped, ShopOrderStatus.OutForDelivery, ShopOrderStatus.Delivered
    ];

    private static readonly ShopOrderStatus[] AdminCancellable = [ShopOrderStatus.Pending, ShopOrderStatus.Confirmed, ShopOrderStatus.Processing];

    private ulong TenantId => currentUser.ResolveTenantId();

    // ---------- Orders ----------

    public Task<PagedResponse<ShopOrderSummaryDto>> SearchAsync(ShopOrderStatus? status, string? search, int page, int pageSize)
    {
        if (status.HasValue && !Enum.IsDefined(status.Value)) throw new ArgumentException("Unknown order status.");
        if (search is { Length: > 100 }) throw new ArgumentException("Search must be at most 100 characters.");

        var query = core.Query(TenantId);
        if (status.HasValue)
        {
            var s = status.Value;
            query = query.Where(o => o.Status == s);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = ShopSearch.Contains(search);
            const string esc = ShopSearch.EscapeCharacter;
            query = query.Where(o =>
                EF.Functions.ILike(o.OrderNumber, pattern, esc) ||
                EF.Functions.ILike(o.User.Email ?? "", pattern, esc) ||
                EF.Functions.ILike((o.User.FirstName ?? "") + " " + (o.User.LastName ?? ""), pattern, esc) ||
                EF.Functions.ILike(o.ShippingAddress.FullName, pattern, esc));
        }

        return core.GetSummariesAsync(query, page, pageSize, includeCustomer: true);
    }

    public async Task<ShopOrderDto> GetAsync(string orderNumber)
    {
        var order = await core.GetByNumberAsync(TenantId, orderNumber, null, tracked: false)
                    ?? throw new KeyNotFoundException("Order not found");
        return ShopOrderCore.ToDto(order, includeCustomer: true);
    }

    public async Task<ShopOrderDto> UpdateStatusAsync(string orderNumber, ShopUpdateOrderStatusRequest request)
    {
        if (!Enum.IsDefined(request.Status)) throw new ArgumentException("Unknown order status.");
        if (request.Status == ShopOrderStatus.Pending) throw new ArgumentException("An order cannot be moved back to Pending.");
        if (request.TrackingNumber is { Length: > 100 }) throw new ArgumentException("Tracking number must be at most 100 characters.");

        var tid = TenantId;
        await core.RunInTransactionWithRetryAsync(async () =>
        {
            var order = await core.GetByNumberAsync(tid, orderNumber, null, tracked: true)
                        ?? throw new KeyNotFoundException("Order not found");

            var tracking = string.IsNullOrWhiteSpace(request.TrackingNumber) ? null : request.TrackingNumber.Trim();
            var target = request.Status;
            var now = DateTime.UtcNow;

            if (target == order.Status)
            {
                if (tracking is null) throw ShopRuleException.Rule($"Order is already {order.Status}");
            }
            else if (target == ShopOrderStatus.Cancelled)
            {
                if (!AdminCancellable.Contains(order.Status))
                    throw ShopRuleException.Rule($"An order that is {order.Status} cannot be cancelled");
                await core.CancelCoreAsync(order);
            }
            else
            {
                var currentIndex = Array.IndexOf(Flow, order.Status);
                var targetIndex = Array.IndexOf(Flow, target);
                if (currentIndex < 0 || targetIndex <= currentIndex)
                    throw ShopRuleException.Rule($"Cannot change order status from {order.Status} to {target}");

                // Forward move: stamp every step reached (including skipped intermediate steps).
                for (var i = currentIndex + 1; i <= targetIndex; i++) StampStatus(order, Flow[i], now);
                order.Status = target;

                if (target == ShopOrderStatus.Delivered
                    && order.Payment is { Method: ShopPaymentMethod.CashOnDelivery, Status: ShopPaymentStatus.Pending } cod)
                {
                    cod.Status = ShopPaymentStatus.Paid;
                    cod.PaidAt = now;
                    cod.TransactionReference ??= $"COD-{order.OrderNumber}";
                    cod.UpdatedAt = now;
                }
            }

            if (tracking is not null) order.TrackingNumber = tracking;
            order.UpdatedAt = now;
            await db.SaveChangesAsync();
            return order.OrderNumber;
        });

        if (request.Status == ShopOrderStatus.Cancelled) await core.RefundCancelledAsync(tid, orderNumber);
        logger.LogInformation("Shop order {OrderNumber} status changed to {Status}", orderNumber, request.Status);
        return await GetAsync(orderNumber);
    }

    private static void StampStatus(ShopOrder order, ShopOrderStatus status, DateTime now)
    {
        switch (status)
        {
            case ShopOrderStatus.Confirmed: order.ConfirmedAt ??= now; break;
            case ShopOrderStatus.Processing: order.ProcessingAt ??= now; break;
            case ShopOrderStatus.Shipped: order.ShippedAt ??= now; break;
            case ShopOrderStatus.OutForDelivery: order.OutForDeliveryAt ??= now; break;
            case ShopOrderStatus.Delivered: order.DeliveredAt ??= now; break;
        }
    }

    // ---------- Customers (people who have shop orders or a cart) ----------

    private IQueryable<User> Buyers(ulong tid) =>
        db.Users.AsNoTracking().Where(u =>
            u.TenantId == tid && u.DeletedAt == null &&
            (db.ShopOrders.Any(o => o.TenantId == tid && o.UserId == u.Id) ||
             db.ShopCarts.Any(c => c.TenantId == tid && c.UserId == u.Id)));

    private sealed class CustomerRow
    {
        public ulong Id { get; init; }
        public string? Email { get; init; }
        public string? FirstName { get; init; }
        public string? LastName { get; init; }
        public string? Phone { get; init; }
        public UserStatus Status { get; init; }
        public string? RoleName { get; init; }
        public int OrdersCount { get; init; }
        public decimal TotalSpent { get; init; }
        public DateTime CreatedAt { get; init; }
        public DateTime? LastOrderAt { get; init; }

        public ShopAdminCustomerDto ToDto() => new()
        {
            Id = Id,
            Email = Email ?? "",
            FirstName = FirstName ?? "",
            LastName = LastName ?? "",
            Phone = Phone,
            IsActive = Status == UserStatus.Active,
            Status = Status,
            Roles = RoleName is null ? [] : [RoleName],
            OrdersCount = OrdersCount,
            TotalSpent = TotalSpent,
            CreatedAt = CreatedAt,
            LastOrderAt = LastOrderAt
        };
    }

    private IQueryable<CustomerRow> Project(IQueryable<User> query, ulong tid) =>
        query.Select(u => new CustomerRow
        {
            Id = u.Id,
            Email = u.Email,
            FirstName = u.FirstName,
            LastName = u.LastName,
            Phone = u.Phone,
            Status = u.Status,
            RoleName = u.Role.Name,
            OrdersCount = db.ShopOrders.Count(o => o.TenantId == tid && o.UserId == u.Id),
            TotalSpent = db.ShopOrders
                .Where(o => o.TenantId == tid && o.UserId == u.Id && o.Status != ShopOrderStatus.Cancelled)
                .Sum(o => (decimal?)o.Total) ?? 0m,
            CreatedAt = u.CreatedAt,
            LastOrderAt = db.ShopOrders.Where(o => o.TenantId == tid && o.UserId == u.Id).Max(o => (DateTime?)o.PlacedAt)
        });

    public async Task<PagedResponse<ShopAdminCustomerDto>> SearchCustomersAsync(string? search, int page, int pageSize)
    {
        if (search is { Length: > 100 }) throw new ArgumentException("Search must be at most 100 characters.");
        var tid = TenantId;
        var (p, size) = ShopSearch.Paging(page, pageSize);

        var query = Buyers(tid);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = ShopSearch.Contains(search);
            const string esc = ShopSearch.EscapeCharacter;
            query = query.Where(u =>
                EF.Functions.ILike(u.Email ?? "", pattern, esc) ||
                EF.Functions.ILike((u.FirstName ?? "") + " " + (u.LastName ?? ""), pattern, esc) ||
                (u.Phone != null && EF.Functions.ILike(u.Phone, pattern, esc)));
        }

        var total = await query.CountAsync();
        var items = total == 0
            ? []
            : await Project(query.OrderByDescending(u => u.CreatedAt).ThenBy(u => u.Id).Skip((p - 1) * size).Take(size), tid)
                .ToListAsync();
        return ShopSearch.Page(items.Select(r => r.ToDto()), p, size, total);
    }

    public async Task<ShopAdminCustomerDetailDto> GetCustomerAsync(ulong id)
    {
        var tid = TenantId;
        var row = await Project(Buyers(tid).Where(u => u.Id == id), tid).FirstOrDefaultAsync()
                  ?? throw new KeyNotFoundException("Customer not found");
        var customer = row.ToDto();

        var addresses = await db.ShopAddresses.AsNoTracking()
            .Where(a => a.TenantId == tid && a.UserId == id && a.DeletedAt == null)
            .OrderByDescending(a => a.IsDefault).ThenByDescending(a => a.CreatedAt)
            .ToListAsync();

        var recentOrders = await core.GetRecentSummariesAsync(core.Query(tid).Where(o => o.UserId == id), 10, includeCustomer: true);

        return new ShopAdminCustomerDetailDto
        {
            Id = customer.Id,
            Email = customer.Email,
            FirstName = customer.FirstName,
            LastName = customer.LastName,
            Phone = customer.Phone,
            IsActive = customer.IsActive,
            Status = customer.Status,
            Roles = customer.Roles,
            OrdersCount = customer.OrdersCount,
            TotalSpent = customer.TotalSpent,
            CreatedAt = customer.CreatedAt,
            LastOrderAt = customer.LastOrderAt,
            Addresses = addresses.Select(ShopAddressService.ToDto).ToList(),
            RecentOrders = recentOrders
        };
    }
}
