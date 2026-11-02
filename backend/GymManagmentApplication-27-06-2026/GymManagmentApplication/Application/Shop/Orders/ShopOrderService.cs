using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Shop.Common;
using GymManagmentApplication.Domain.Entities.Shop;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace GymManagmentApplication.Application.Shop.Orders;

public sealed record ShopOrderTotals(decimal Subtotal, decimal Discount, decimal Shipping, decimal Tax, decimal Total);

public interface IShopOrderService
{
    Task<ShopCheckoutQuoteDto> QuoteAsync(ShopCheckoutQuoteRequest request);
    Task<ShopOrderDto> CreateAsync(ShopCreateOrderRequest request);
    Task<PagedResponse<ShopOrderSummaryDto>> GetMyOrdersAsync(int page, int pageSize);
    Task<ShopOrderDto> GetMyOrderAsync(string orderNumber);
    Task<ShopOrderDto> CancelMyOrderAsync(string orderNumber);
}

/// <summary>Checkout and the member's own orders. Ported from the store's OrderService (customer half).</summary>
public sealed class ShopOrderService(
    AppDbContext db,
    ICurrentUser currentUser,
    IShopCartService carts,
    IShopCouponService coupons,
    IShopPaymentGateway paymentGateway,
    IShopSettingsService settingsService,
    ShopOrderCore core,
    ILogger<ShopOrderService> logger) : IShopOrderService
{
    private static readonly ShopOrderStatus[] CustomerCancellable = [ShopOrderStatus.Pending, ShopOrderStatus.Confirmed];

    private ulong TenantId => currentUser.ResolveTenantId();
    private ulong UserId => currentUser.UserId ?? throw new UnauthorizedAccessException("Please sign in again.");

    // ---------- Pricing ----------

    public static ShopOrderTotals CalculateTotals(ShopSettings settings, decimal subtotal, decimal discount, ShopDeliveryMethod method)
    {
        subtotal = ShopPricing.Round(subtotal);
        discount = ShopPricing.Round(Math.Clamp(discount, 0, subtotal));
        var shipping = method == ShopDeliveryMethod.Express
            ? settings.ExpressShipping
            : subtotal >= settings.FreeShippingThreshold ? 0m : settings.StandardShipping;
        shipping = ShopPricing.Round(shipping);
        var taxable = subtotal - discount;
        var tax = ShopPricing.Round(taxable * settings.TaxRate);
        var total = ShopPricing.Round(taxable + shipping + tax);
        return new ShopOrderTotals(subtotal, discount, shipping, tax, total);
    }

    public static DateTime EstimateDelivery(ShopSettings settings, ShopDeliveryMethod method, DateTime from) =>
        from.AddDays(method == ShopDeliveryMethod.Express ? settings.ExpressDeliveryDays : settings.StandardDeliveryDays);

    // ---------- Checkout ----------

    public async Task<ShopCheckoutQuoteDto> QuoteAsync(ShopCheckoutQuoteRequest request)
    {
        if (!Enum.IsDefined(request.DeliveryMethod)) throw new ArgumentException("Choose a delivery method.");
        if (request.CouponCode is { Length: > 40 }) throw new ArgumentException("Coupon code must be at most 40 characters.");

        var tid = TenantId;
        var settings = await settingsService.GetAsync(tid);
        var cartId = await carts.GetOrCreateCartIdAsync(tid, UserId);
        var cart = await carts.GetCartDtoAsync(cartId);
        if (cart.Items.Count == 0) throw ShopRuleException.Rule("Your cart is empty");

        decimal discount = 0;
        string? appliedCode = null;
        string? couponMessage = null;

        if (!string.IsNullOrWhiteSpace(request.CouponCode))
        {
            var evaluation = await coupons.EvaluateAsync(tid, request.CouponCode, cart.Subtotal);
            if (evaluation.IsValid)
            {
                discount = evaluation.Discount;
                appliedCode = evaluation.Coupon!.Code;
                couponMessage = $"Coupon {appliedCode} applied";
            }
            else couponMessage = evaluation.Error;
        }

        var totals = CalculateTotals(settings, cart.Subtotal, discount, request.DeliveryMethod);
        return new ShopCheckoutQuoteDto
        {
            Subtotal = totals.Subtotal,
            Discount = totals.Discount,
            Shipping = totals.Shipping,
            Tax = totals.Tax,
            Total = totals.Total,
            CouponCode = appliedCode,
            CouponMessage = couponMessage,
            EstimatedDelivery = EstimateDelivery(settings, request.DeliveryMethod, DateTime.UtcNow)
        };
    }

    public async Task<ShopOrderDto> CreateAsync(ShopCreateOrderRequest request)
    {
        if (request.AddressId == 0) throw new ArgumentException("Choose a delivery address.");
        if (!Enum.IsDefined(request.DeliveryMethod)) throw new ArgumentException("Choose a delivery method.");
        if (!Enum.IsDefined(request.PaymentMethod)) throw new ArgumentException("Choose a payment method.");
        if (request.CouponCode is { Length: > 40 }) throw new ArgumentException("Coupon code must be at most 40 characters.");
        if (request.Notes is { Length: > 1000 }) throw new ArgumentException("Notes must be at most 1000 characters.");

        var tid = TenantId;
        var uid = UserId;
        var settings = await settingsService.GetAsync(tid);

        // One more full attempt when two orders race for the same order number (unique index).
        string orderNumber;
        try
        {
            orderNumber = await core.RunInTransactionWithRetryAsync(() => PlaceOrderAsync(tid, uid, settings, request));
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            logger.LogInformation("Order number clash for tenant {TenantId}; retrying once", tid);
            orderNumber = await core.RunInTransactionWithRetryAsync(() => PlaceOrderAsync(tid, uid, settings, request));
        }

        logger.LogInformation("Shop order {OrderNumber} placed by user {UserId}", orderNumber, uid);
        return await GetMyOrderAsync(orderNumber);
    }

    private async Task<string> PlaceOrderAsync(ulong tid, ulong uid, ShopSettings settings, ShopCreateOrderRequest request)
    {
        var address = await db.ShopAddresses.AsNoTracking()
                          .FirstOrDefaultAsync(a => a.Id == request.AddressId && a.TenantId == tid && a.UserId == uid && a.DeletedAt == null)
                      ?? throw new KeyNotFoundException("Address not found");

        var cartItems = await carts.GetItemsForCheckoutAsync(tid, uid);
        if (cartItems.Count == 0) throw ShopRuleException.Rule("Your cart is empty");

        var now = DateTime.UtcNow;
        var order = new ShopOrder
        {
            Id = 0,
            TenantId = tid,
            UserId = uid,
            Status = ShopOrderStatus.Pending,
            DeliveryMethod = request.DeliveryMethod,
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            PlacedAt = now,
            EstimatedDelivery = EstimateDelivery(settings, request.DeliveryMethod, now),
            ShippingAddress = new ShopShippingAddress
            {
                FullName = address.FullName,
                Phone = address.Phone,
                Line1 = address.Line1,
                Line2 = address.Line2,
                City = address.City,
                State = address.State,
                PostalCode = address.PostalCode,
                Country = address.Country
            }
        };

        foreach (var item in cartItems)
        {
            var variant = item.Variant;
            var product = variant.Product;
            var displayName = $"{product.Name} ({variant.Name})";

            if (!variant.IsActive || variant.DeletedAt != null
                || !product.IsActive || product.DeletedAt != null
                || !product.Category.IsActive || product.Category.DeletedAt != null)
                throw ShopRuleException.Rule($"{displayName} is no longer available. Please remove it from your cart.");

            var inventory = variant.Inventory;
            var available = inventory?.Available ?? 0;
            if (inventory is null || item.Quantity > available)
                throw ShopRuleException.Conflict(available == 0
                    ? $"{displayName} is out of stock."
                    : $"Only {available} unit{(available == 1 ? "" : "s")} of {displayName} available.");

            inventory.QuantityOnHand -= item.Quantity;
            inventory.UpdatedAt = now;

            order.Items.Add(new ShopOrderItem
            {
                Id = 0,
                TenantId = tid,
                ProductId = product.Id,
                VariantId = variant.Id,
                ProductName = product.Name,
                ProductSlug = product.Slug,
                VariantName = variant.Name,
                Sku = variant.Sku,
                ImageUrl = product.Images
                    .OrderByDescending(i => i.IsPrimary).ThenBy(i => i.SortOrder).ThenBy(i => i.CreatedAt)
                    .Select(i => i.Url).FirstOrDefault(),
                UnitPrice = variant.Price,
                Quantity = item.Quantity,
                LineTotal = ShopPricing.Round(variant.Price * item.Quantity)
            });
        }

        var subtotal = order.Items.Sum(i => i.LineTotal);
        decimal discount = 0;

        if (!string.IsNullOrWhiteSpace(request.CouponCode))
        {
            var evaluation = await coupons.EvaluateAsync(tid, request.CouponCode, subtotal);
            if (!evaluation.IsValid) throw ShopRuleException.Rule(evaluation.Error!);

            var coupon = evaluation.Coupon!;
            // Atomic usage increment guarded by the usage limit (part of the surrounding transaction).
            var updated = await db.Coupons
                .Where(c => c.Id == coupon.Id && c.TenantId == tid && c.IsActive && (c.MaxUses == null || c.UsesCount < c.MaxUses))
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.UsesCount, c => c.UsesCount + 1u));
            if (updated == 0) throw ShopRuleException.Rule("This coupon has reached its usage limit");

            discount = evaluation.Discount;
            order.CouponId = coupon.Id;
            order.CouponCode = coupon.Code;
        }

        var totals = CalculateTotals(settings, subtotal, discount, request.DeliveryMethod);
        order.Subtotal = totals.Subtotal;
        order.Discount = totals.Discount;
        order.Shipping = totals.Shipping;
        order.Tax = totals.Tax;
        order.Total = totals.Total;

        var payment = await paymentGateway.ChargeAsync(
            new ShopPaymentRequest(order.Id, request.PaymentMethod, order.Total, settings.Currency));
        if (payment.Status == ShopPaymentStatus.Failed)
            throw ShopRuleException.Rule($"Payment failed: {payment.FailureReason ?? "the payment was declined"}");

        order.Payment = new ShopPayment
        {
            Id = 0,
            TenantId = tid,
            Method = request.PaymentMethod,
            Status = payment.Status,
            Amount = order.Total,
            TransactionReference = payment.TransactionReference,
            PaidAt = payment.PaidAt,
            FailureReason = payment.FailureReason
        };

        if (payment.Status == ShopPaymentStatus.Paid)
        {
            // Prepaid orders are confirmed immediately; COD orders wait for the gym to confirm.
            order.Status = ShopOrderStatus.Confirmed;
            order.ConfirmedAt = now;
        }

        order.OrderNumber = await ShopOrderNumbers.NextAsync(db, tid, settings.OrderPrefix);
        db.ShopOrders.Add(order);
        db.ShopCartItems.RemoveRange(cartItems);
        await db.SaveChangesAsync();
        return order.OrderNumber;
    }

    // ---------- The member's orders ----------

    public Task<PagedResponse<ShopOrderSummaryDto>> GetMyOrdersAsync(int page, int pageSize)
    {
        var tid = TenantId;
        var uid = UserId;
        return core.GetSummariesAsync(core.Query(tid).Where(o => o.UserId == uid), page, pageSize, includeCustomer: false);
    }

    public async Task<ShopOrderDto> GetMyOrderAsync(string orderNumber)
    {
        var order = await core.GetByNumberAsync(TenantId, orderNumber, UserId, tracked: false)
                    ?? throw new KeyNotFoundException("Order not found");
        return ShopOrderCore.ToDto(order, includeCustomer: false);
    }

    public async Task<ShopOrderDto> CancelMyOrderAsync(string orderNumber)
    {
        var tid = TenantId;
        var uid = UserId;
        await core.RunInTransactionWithRetryAsync(async () =>
        {
            var order = await core.GetByNumberAsync(tid, orderNumber, uid, tracked: true)
                        ?? throw new KeyNotFoundException("Order not found");
            if (!CustomerCancellable.Contains(order.Status))
                throw ShopRuleException.Rule("This order can no longer be cancelled");

            await core.CancelCoreAsync(order);
            await db.SaveChangesAsync();
            return order.OrderNumber;
        });

        logger.LogInformation("Shop order {OrderNumber} cancelled by customer {UserId}", orderNumber, uid);
        return await GetMyOrderAsync(orderNumber);
    }
}

/// <summary>
/// Order loading, mapping, cancelling and the transaction/retry wrapper shared by the member and
/// admin order services (the store's OrderRepository + the shared parts of OrderService/Mappers).
/// </summary>
public sealed class ShopOrderCore(AppDbContext db, IShopPaymentGateway paymentGateway, ILogger<ShopOrderCore> logger)
{
    private const int MaxConcurrencyAttempts = 3;

    public IQueryable<ShopOrder> Query(ulong tenantId) => db.ShopOrders.AsNoTracking().Where(o => o.TenantId == tenantId);

    /// <summary>Loads an order aggregate (items, payment, user) by number, optionally restricted to an owner.</summary>
    public Task<ShopOrder?> GetByNumberAsync(ulong tenantId, string orderNumber, ulong? ownerId, bool tracked)
    {
        IQueryable<ShopOrder> query = db.ShopOrders
            .Include(o => o.Items)
            .Include(o => o.Payment)
            .Include(o => o.User)
            .AsSplitQuery()
            .Where(o => o.TenantId == tenantId);

        if (!tracked) query = query.AsNoTracking();
        if (ownerId.HasValue)
        {
            var owner = ownerId.Value;
            query = query.Where(o => o.UserId == owner);
        }

        var normalized = (orderNumber ?? string.Empty).Trim().ToUpperInvariant();
        return query.FirstOrDefaultAsync(o => o.OrderNumber == normalized);
    }

    private static IQueryable<ShopOrderSummaryDto> Project(IQueryable<ShopOrder> query, bool includeCustomer) =>
        query.Select(o => new ShopOrderSummaryDto
        {
            Id = o.Id,
            OrderNumber = o.OrderNumber,
            Status = o.Status,
            Total = o.Total,
            ItemCount = o.Items.Sum(i => i.Quantity),
            PlacedAt = o.PlacedAt,
            PreviewImages = o.Items
                .Where(i => i.ImageUrl != null)
                .OrderBy(i => i.ProductName)
                .Select(i => i.ImageUrl!)
                .Take(3)
                .ToList(),
            CustomerName = includeCustomer ? ((o.User.FirstName ?? "") + " " + (o.User.LastName ?? "")).Trim() : null,
            CustomerEmail = includeCustomer ? o.User.Email : null
        });

    public async Task<PagedResponse<ShopOrderSummaryDto>> GetSummariesAsync(IQueryable<ShopOrder> query, int page, int pageSize, bool includeCustomer)
    {
        var (p, size) = ShopSearch.Paging(page, pageSize);
        var total = await query.CountAsync();
        var items = total == 0
            ? []
            : await Project(query.OrderByDescending(o => o.PlacedAt).ThenBy(o => o.Id).Skip((p - 1) * size).Take(size), includeCustomer)
                .ToListAsync();
        return ShopSearch.Page(items, p, size, total);
    }

    public Task<List<ShopOrderSummaryDto>> GetRecentSummariesAsync(IQueryable<ShopOrder> query, int take, bool includeCustomer) =>
        Project(query.OrderByDescending(o => o.PlacedAt).ThenBy(o => o.Id).Take(take), includeCustomer).ToListAsync();

    /// <summary>Marks the order cancelled, restocks inventory, releases coupon usage and refunds prepaid payments.</summary>
    public async Task CancelCoreAsync(ShopOrder order)
    {
        var now = DateTime.UtcNow;
        var quantities = order.Items.GroupBy(i => i.VariantId).ToDictionary(g => g.Key, g => g.Sum(i => i.Quantity));
        var variantIds = quantities.Keys.ToList();
        var inventories = await db.ShopInventories
            .Where(i => i.TenantId == order.TenantId && variantIds.Contains(i.VariantId))
            .ToListAsync();
        foreach (var inventory in inventories)
        {
            inventory.QuantityOnHand += quantities[inventory.VariantId];
            inventory.UpdatedAt = now;
        }

        if (order.CouponId.HasValue)
        {
            var couponId = order.CouponId.Value;
            await db.Coupons
                .Where(c => c.Id == couponId && c.UsesCount > 0)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.UsesCount, c => c.UsesCount - 1u));
        }

        if (order.Payment is { Status: ShopPaymentStatus.Paid } payment)
        {
            var refund = await paymentGateway.RefundAsync(payment);
            payment.Status = refund.Status;
            payment.UpdatedAt = now;
        }

        order.Status = ShopOrderStatus.Cancelled;
        order.CancelledAt = now;
        order.UpdatedAt = now;
    }

    /// <summary>
    /// Runs the operation in a DB transaction (inside the execution strategy), retrying up to 3 times
    /// when an optimistic concurrency conflict on inventory (xmin) is detected; then 409.
    /// </summary>
    public async Task<T> RunInTransactionWithRetryAsync<T>(Func<Task<T>> operation)
    {
        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            for (var attempt = 1; ; attempt++)
            {
                db.ChangeTracker.Clear();
                await using var transaction = await db.Database.BeginTransactionAsync();
                try
                {
                    var result = await operation();
                    await transaction.CommitAsync();
                    return result;
                }
                catch (DbUpdateConcurrencyException ex)
                {
                    await transaction.RollbackAsync(CancellationToken.None);
                    if (attempt >= MaxConcurrencyAttempts)
                    {
                        logger.LogWarning(ex, "Giving up after {Attempts} concurrency conflicts", attempt);
                        throw ShopRuleException.Conflict("Stock levels changed while placing your order. Please review your cart and try again.");
                    }
                    logger.LogInformation("Concurrency conflict (attempt {Attempt}); retrying", attempt);
                }
                catch
                {
                    db.ChangeTracker.Clear();
                    throw;
                }
            }
        });
    }

    // ---------- Mapping ----------

    /// <summary>Requires Items and Payment loaded; User loaded when includeCustomer is true.</summary>
    public static ShopOrderDto ToDto(ShopOrder o, bool includeCustomer)
    {
        var payment = o.Payment;
        return new ShopOrderDto
        {
            Id = o.Id,
            OrderNumber = o.OrderNumber,
            Status = o.Status,
            Subtotal = o.Subtotal,
            Discount = o.Discount,
            Shipping = o.Shipping,
            Tax = o.Tax,
            Total = o.Total,
            CouponCode = o.CouponCode,
            DeliveryMethod = o.DeliveryMethod,
            Notes = o.Notes,
            TrackingNumber = o.TrackingNumber,
            PlacedAt = o.PlacedAt,
            ConfirmedAt = o.ConfirmedAt,
            ProcessingAt = o.ProcessingAt,
            ShippedAt = o.ShippedAt,
            OutForDeliveryAt = o.OutForDeliveryAt,
            DeliveredAt = o.DeliveredAt,
            CancelledAt = o.CancelledAt,
            EstimatedDelivery = o.EstimatedDelivery,
            ShippingAddress = new ShopOrderAddressDto
            {
                FullName = o.ShippingAddress.FullName,
                Phone = o.ShippingAddress.Phone,
                Line1 = o.ShippingAddress.Line1,
                Line2 = o.ShippingAddress.Line2,
                City = o.ShippingAddress.City,
                State = o.ShippingAddress.State,
                PostalCode = o.ShippingAddress.PostalCode,
                Country = o.ShippingAddress.Country
            },
            Payment = payment is null
                ? new ShopPaymentDto { Method = ShopPaymentMethod.CashOnDelivery, Status = ShopPaymentStatus.Pending, Amount = o.Total }
                : new ShopPaymentDto
                {
                    Method = payment.Method,
                    Status = payment.Status,
                    Amount = payment.Amount,
                    TransactionReference = payment.TransactionReference,
                    PaidAt = payment.PaidAt
                },
            Items = o.Items.OrderBy(i => i.ProductName).ThenBy(i => i.VariantName).Select(i => new ShopOrderItemDto
            {
                Id = i.Id,
                ProductId = i.ProductId,
                VariantId = i.VariantId,
                ProductName = i.ProductName,
                ProductSlug = i.ProductSlug,
                VariantName = i.VariantName,
                Sku = i.Sku,
                ImageUrl = i.ImageUrl,
                UnitPrice = i.UnitPrice,
                Quantity = i.Quantity,
                LineTotal = i.LineTotal
            }).ToList(),
            Timeline = BuildTimeline(o),
            CustomerId = includeCustomer ? o.UserId : null,
            CustomerName = includeCustomer && o.User is not null ? $"{o.User.FirstName} {o.User.LastName}".Trim() : null,
            CustomerEmail = includeCustomer ? o.User?.Email : null,
            CustomerPhone = includeCustomer ? o.User?.Phone : null
        };
    }

    /// <summary>
    /// Pending ("placed") → Confirmed → Shipped → OutForDelivery → Delivered (Processing is internal and
    /// only exposed as processingAt). A cancelled order shows the steps that happened, then Cancelled.
    /// </summary>
    public static IReadOnlyList<ShopOrderTimelineEntryDto> BuildTimeline(ShopOrder o)
    {
        var steps = new (ShopOrderStatus Status, DateTime? At)[]
        {
            (ShopOrderStatus.Pending, o.PlacedAt),
            (ShopOrderStatus.Confirmed, o.ConfirmedAt),
            (ShopOrderStatus.Shipped, o.ShippedAt),
            (ShopOrderStatus.OutForDelivery, o.OutForDeliveryAt),
            (ShopOrderStatus.Delivered, o.DeliveredAt)
        };

        if (o.Status == ShopOrderStatus.Cancelled)
        {
            var happened = steps.Where(s => s.At.HasValue)
                .Select(s => new ShopOrderTimelineEntryDto { Status = s.Status, At = s.At, Completed = true })
                .ToList();
            happened.Add(new ShopOrderTimelineEntryDto { Status = ShopOrderStatus.Cancelled, At = o.CancelledAt, Completed = true });
            return happened;
        }

        return steps.Select(s => new ShopOrderTimelineEntryDto { Status = s.Status, At = s.At, Completed = s.At.HasValue }).ToList();
    }
}
