using GymManagmentApplication.Domain.Entities.Shop;
using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Application.Shop.Orders;

// Request/response shapes of the shop's buying side, ported from the Unique Lights store
// (DTOs/Shopping, DTOs/Orders, DTOs/Customers, DTOs/Admin, DTOs/Store). Field names are kept so the
// store's frontend types carry over; ids are numbers (ulong) instead of GUIDs.

// ---------- Cart ----------

public sealed class ShopCartItemDto
{
    public ulong Id { get; init; }
    public ulong VariantId { get; init; }
    public ulong ProductId { get; init; }
    public string ProductName { get; init; } = string.Empty;
    public string ProductSlug { get; init; } = string.Empty;
    public string VariantName { get; init; } = string.Empty;
    public string? Flavour { get; init; }
    public string? Size { get; init; }
    public string? Colour { get; init; }
    public string? Weight { get; init; }
    public string Sku { get; init; } = string.Empty;
    public string? ImageUrl { get; init; }
    public decimal UnitPrice { get; init; }
    public decimal? CompareAtPrice { get; init; }
    public int Quantity { get; init; }
    public decimal LineTotal { get; init; }
    public int AvailableStock { get; init; }
}

public sealed class ShopCartDto
{
    public ulong Id { get; init; }
    public IReadOnlyList<ShopCartItemDto> Items { get; init; } = [];
    public int ItemCount { get; init; }
    public decimal Subtotal { get; init; }
}

public sealed class ShopAddCartItemRequest
{
    public ulong VariantId { get; init; }
    public int Quantity { get; init; }
}

public sealed class ShopUpdateCartItemRequest
{
    public int Quantity { get; init; }
}

// ---------- Coupons (customer) ----------

public sealed class ShopValidateCouponRequest
{
    public string Code { get; init; } = string.Empty;
    public decimal Subtotal { get; init; }
}

public sealed class ShopCouponValidationDto
{
    public string Code { get; init; } = string.Empty;
    public string? Description { get; init; }
    public decimal DiscountAmount { get; init; }
}

// ---------- Addresses ----------

public sealed class ShopAddressDto
{
    public ulong Id { get; init; }
    public string? Label { get; init; }
    public string FullName { get; init; } = string.Empty;
    public string Phone { get; init; } = string.Empty;
    public string Line1 { get; init; } = string.Empty;
    public string? Line2 { get; init; }
    public string City { get; init; } = string.Empty;
    public string State { get; init; } = string.Empty;
    public string PostalCode { get; init; } = string.Empty;
    public string Country { get; init; } = string.Empty;
    public bool IsDefault { get; init; }
}

public sealed class ShopAddressRequest
{
    public string? Label { get; init; }
    public string FullName { get; init; } = string.Empty;
    public string Phone { get; init; } = string.Empty;
    public string Line1 { get; init; } = string.Empty;
    public string? Line2 { get; init; }
    public string City { get; init; } = string.Empty;
    public string State { get; init; } = string.Empty;
    public string PostalCode { get; init; } = string.Empty;
    public string? Country { get; init; } = "India";
    public bool IsDefault { get; init; }
}

// ---------- Checkout / orders ----------

public sealed class ShopCheckoutQuoteRequest
{
    public ShopDeliveryMethod DeliveryMethod { get; init; }
    public string? CouponCode { get; init; }
}

public sealed class ShopCheckoutQuoteDto
{
    public decimal Subtotal { get; init; }
    public decimal Discount { get; init; }
    public decimal Shipping { get; init; }
    public decimal Tax { get; init; }
    public decimal Total { get; init; }
    public string? CouponCode { get; init; }
    public string? CouponMessage { get; init; }
    public DateTime EstimatedDelivery { get; init; }
}

public sealed class ShopCreateOrderRequest
{
    public ulong AddressId { get; init; }
    public ShopDeliveryMethod DeliveryMethod { get; init; }
    public ShopPaymentMethod PaymentMethod { get; init; }
    public string? CouponCode { get; init; }
    public string? Notes { get; init; }
}

public sealed class ShopOrderItemDto
{
    public ulong Id { get; init; }
    public ulong ProductId { get; init; }
    public ulong VariantId { get; init; }
    public string ProductName { get; init; } = string.Empty;
    public string ProductSlug { get; init; } = string.Empty;
    public string VariantName { get; init; } = string.Empty;
    public string Sku { get; init; } = string.Empty;
    public string? ImageUrl { get; init; }
    public decimal UnitPrice { get; init; }
    public int Quantity { get; init; }
    public decimal LineTotal { get; init; }
}

public sealed class ShopOrderAddressDto
{
    public string FullName { get; init; } = string.Empty;
    public string Phone { get; init; } = string.Empty;
    public string Line1 { get; init; } = string.Empty;
    public string? Line2 { get; init; }
    public string City { get; init; } = string.Empty;
    public string State { get; init; } = string.Empty;
    public string PostalCode { get; init; } = string.Empty;
    public string Country { get; init; } = string.Empty;
}

public sealed class ShopPaymentDto
{
    public ShopPaymentMethod Method { get; init; }
    public ShopPaymentStatus Status { get; init; }
    public decimal Amount { get; init; }
    public string? TransactionReference { get; init; }
    public DateTime? PaidAt { get; init; }
}

public sealed class ShopOrderTimelineEntryDto
{
    public ShopOrderStatus Status { get; init; }
    public DateTime? At { get; init; }
    public bool Completed { get; init; }
}

public sealed class ShopOrderSummaryDto
{
    public ulong Id { get; init; }
    public string OrderNumber { get; init; } = string.Empty;
    public ShopOrderStatus Status { get; init; }
    public decimal Total { get; init; }
    public int ItemCount { get; init; }
    public DateTime PlacedAt { get; init; }
    public IReadOnlyList<string> PreviewImages { get; init; } = [];
    public string? CustomerName { get; init; }
    public string? CustomerEmail { get; init; }
}

public sealed class ShopOrderDto
{
    public ulong Id { get; init; }
    public string OrderNumber { get; init; } = string.Empty;
    public ShopOrderStatus Status { get; init; }
    public decimal Subtotal { get; init; }
    public decimal Discount { get; init; }
    public decimal Shipping { get; init; }
    public decimal Tax { get; init; }
    public decimal Total { get; init; }
    public string? CouponCode { get; init; }
    public ShopDeliveryMethod DeliveryMethod { get; init; }
    public string? Notes { get; init; }
    public string? TrackingNumber { get; init; }
    public DateTime PlacedAt { get; init; }
    public DateTime? ConfirmedAt { get; init; }
    public DateTime? ProcessingAt { get; init; }
    public DateTime? ShippedAt { get; init; }
    public DateTime? OutForDeliveryAt { get; init; }
    public DateTime? DeliveredAt { get; init; }
    public DateTime? CancelledAt { get; init; }
    public DateTime? EstimatedDelivery { get; init; }
    public ShopOrderAddressDto ShippingAddress { get; init; } = null!;
    public ShopPaymentDto Payment { get; init; } = null!;
    public IReadOnlyList<ShopOrderItemDto> Items { get; init; } = [];
    public IReadOnlyList<ShopOrderTimelineEntryDto> Timeline { get; init; } = [];
    public ulong? CustomerId { get; init; }
    public string? CustomerName { get; init; }
    public string? CustomerEmail { get; init; }
    public string? CustomerPhone { get; init; }
}

public sealed class ShopUpdateOrderStatusRequest
{
    public ShopOrderStatus Status { get; init; }
    public string? TrackingNumber { get; init; }
}

// ---------- Admin: customers ----------

public class ShopAdminCustomerDto
{
    public ulong Id { get; init; }
    public string Email { get; init; } = string.Empty;
    public string FirstName { get; init; } = string.Empty;
    public string LastName { get; init; } = string.Empty;
    public string? Phone { get; init; }
    public bool IsActive { get; init; }
    public UserStatus Status { get; init; }
    public IReadOnlyList<string> Roles { get; init; } = [];
    public int OrdersCount { get; init; }
    public decimal TotalSpent { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? LastOrderAt { get; init; }
}

public sealed class ShopAdminCustomerDetailDto : ShopAdminCustomerDto
{
    public IReadOnlyList<ShopAddressDto> Addresses { get; init; } = [];
    public IReadOnlyList<ShopOrderSummaryDto> RecentOrders { get; init; } = [];
}

// ---------- Admin: coupons ----------

public sealed class ShopCouponDto
{
    public ulong Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string? Description { get; init; }
    /// <summary>Percentage (0) or Fixed (1) — the store's FixedAmount.</summary>
    public CouponType DiscountType { get; init; }
    public decimal Value { get; init; }
    public decimal? MinOrderAmount { get; init; }
    public decimal? MaxDiscountAmount { get; init; }
    public DateTime? StartsAt { get; init; }
    public DateTime? EndsAt { get; init; }
    public long? UsageLimit { get; init; }
    public long UsedCount { get; init; }
    public bool IsActive { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class ShopUpsertCouponRequest
{
    public string Code { get; init; } = string.Empty;
    public string? Description { get; init; }
    public CouponType DiscountType { get; init; }
    public decimal Value { get; init; }
    public decimal? MinOrderAmount { get; init; }
    public decimal? MaxDiscountAmount { get; init; }
    public DateTime? StartsAt { get; init; }
    public DateTime? EndsAt { get; init; }
    public int? UsageLimit { get; init; }
    public bool IsActive { get; init; }
}

// ---------- Admin: dashboard ----------

public sealed class ShopDashboardDto
{
    public decimal TotalRevenue { get; init; }
    public int OrdersCount { get; init; }
    /// <summary>People who have placed at least one shop order.</summary>
    public int CustomersCount { get; init; }
    public int ProductsCount { get; init; }
    public decimal AverageOrderValue { get; init; }
    public decimal RevenueLast30Days { get; init; }
    public decimal RevenuePrevious30Days { get; init; }
    public IReadOnlyList<ShopSalesByDayDto> SalesByDay { get; init; } = [];
    public IReadOnlyList<ShopOrdersByStatusDto> OrdersByStatus { get; init; } = [];
    public IReadOnlyList<ShopTopProductDto> TopProducts { get; init; } = [];
    public IReadOnlyList<ShopOrderSummaryDto> RecentOrders { get; init; } = [];
    public IReadOnlyList<ShopLowStockItemDto> LowStock { get; init; } = [];
}

public sealed record ShopSalesByDayDto(string Date, decimal Revenue, int Orders);

public sealed record ShopOrdersByStatusDto(ShopOrderStatus Status, int Count);

public sealed record ShopTopProductDto(ulong ProductId, string Name, string? ImageUrl, int UnitsSold, decimal Revenue);

public sealed class ShopLowStockItemDto
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
    public bool IsLowStock { get; init; }
}

// ---------- Store ----------

/// <summary>Public store settings the shop pages need: pricing rules, delivery promises and contact details.</summary>
public sealed record ShopStoreSettingsDto(
    string Name,
    string? Tagline,
    string Currency,
    decimal TaxRate,
    decimal FreeShippingThreshold,
    decimal StandardShipping,
    decimal ExpressShipping,
    int StandardDeliveryDays,
    int ExpressDeliveryDays,
    int ReturnDays,
    string? SupportEmail,
    string? SupportPhone,
    string? Address,
    string? BusinessHours);
