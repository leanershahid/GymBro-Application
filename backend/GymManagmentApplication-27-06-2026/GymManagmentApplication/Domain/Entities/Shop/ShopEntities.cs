using System.Text.Json.Serialization;
using GymManagmentApplication.Domain.Entities.Billing;
using GymManagmentApplication.Domain.Entities.Identity;

namespace GymManagmentApplication.Domain.Entities.Shop;

// The gym shop: one per tenant, ported from the Unique Lights store. Every table carries TenantId
// (the global tenant filter applies). Soft-deleted rows keep DeletedAt — shop queries skip them
// explicitly, because an entity can only have one global query filter and that is the tenant's.

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ShopOrderStatus { Pending, Confirmed, Processing, Shipped, OutForDelivery, Delivered, Cancelled }
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ShopDeliveryMethod { Standard, Express }
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ShopPaymentMethod { CashOnDelivery, Card, Upi }
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ShopPaymentStatus { Pending, Paid, Failed, Refunded }

public class ShopCategory : BaseEntity, ISoftDeletable
{
    public ulong TenantId { get; set; }
    public string Name { get; set; } = default!;
    public string Slug { get; set; } = default!;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public ulong? ParentId { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime? DeletedAt { get; set; }

    public ShopCategory? Parent { get; set; }
    public ICollection<ShopCategory> Children { get; set; } = [];
    public ICollection<ShopProduct> Products { get; set; } = [];
}

public class ShopProduct : BaseEntity, ISoftDeletable
{
    public ulong TenantId { get; set; }
    public string Name { get; set; } = default!;
    public string Slug { get; set; } = default!;
    public string Sku { get; set; } = default!;
    public string? ShortDescription { get; set; }
    public string? Description { get; set; }
    public string? Brand { get; set; }
    public decimal BasePrice { get; set; }
    public decimal? CompareAtPrice { get; set; }
    public ulong CategoryId { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsFeatured { get; set; }
    public bool IsNew { get; set; }
    /// <summary>Key/value facts shown in the Specifications tab (e.g. "Serving size": "30 g").</summary>
    public Dictionary<string, string> Specifications { get; set; } = [];
    /// <summary>Kept up to date after every review change, so listings can sort by rating.</summary>
    public decimal AverageRating { get; set; }
    public int ReviewCount { get; set; }
    public DateTime? DeletedAt { get; set; }

    public ShopCategory Category { get; set; } = default!;
    public ICollection<ShopProductImage> Images { get; set; } = [];
    public ICollection<ShopVariant> Variants { get; set; } = [];
    public ICollection<ShopReview> Reviews { get; set; } = [];
}

public class ShopProductImage : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong ProductId { get; set; }
    public string Url { get; set; } = default!;
    public string? AltText { get; set; }
    public int SortOrder { get; set; }
    public bool IsPrimary { get; set; }

    public ShopProduct Product { get; set; } = default!;
}

/// <summary>A buyable option of a product — flavour, size, colour or weight (gym attributes in place of the lighting store's finish / colour temperature / wattage).</summary>
public class ShopVariant : BaseEntity, ISoftDeletable
{
    public ulong TenantId { get; set; }
    public ulong ProductId { get; set; }
    public string Sku { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Flavour { get; set; }
    public string? Size { get; set; }
    public string? Colour { get; set; }
    public string? Weight { get; set; }
    public decimal Price { get; set; }
    public decimal? CompareAtPrice { get; set; }
    public bool IsDefault { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime? DeletedAt { get; set; }

    public ShopProduct Product { get; set; } = default!;
    public ShopInventory? Inventory { get; set; }

    /// <summary>Units that can be sold now (on hand − reserved; 0 without an inventory row). ARCH-084.</summary>
    public int AvailableStock() => Inventory?.Available ?? 0;
}

public class ShopInventory : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong VariantId { get; set; }
    public int QuantityOnHand { get; set; }
    public int ReservedQuantity { get; set; }
    public int LowStockThreshold { get; set; } = 5;
    /// <summary>Postgres xmin — optimistic concurrency for stock changes at checkout.</summary>
    public uint Version { get; set; }

    public ShopVariant Variant { get; set; } = default!;

    public int Available => Math.Max(0, QuantityOnHand - ReservedQuantity);
}

public class ShopReview : BaseEntity, ISoftDeletable
{
    public ulong TenantId { get; set; }
    public ulong ProductId { get; set; }
    public ulong UserId { get; set; }
    public short Rating { get; set; }
    public string? Title { get; set; }
    public string? Comment { get; set; }
    public bool IsVerifiedPurchase { get; set; }
    public DateTime? DeletedAt { get; set; }

    public ShopProduct Product { get; set; } = default!;
    public User User { get; set; } = default!;
}

public class ShopCart : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong UserId { get; set; }

    public ICollection<ShopCartItem> Items { get; set; } = [];
}

public class ShopCartItem : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong CartId { get; set; }
    public ulong VariantId { get; set; }
    public int Quantity { get; set; }

    public ShopCart Cart { get; set; } = default!;
    public ShopVariant Variant { get; set; } = default!;
}

public class ShopWishlist : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong UserId { get; set; }

    public ICollection<ShopWishlistItem> Items { get; set; } = [];
}

public class ShopWishlistItem : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong WishlistId { get; set; }
    public ulong ProductId { get; set; }

    public ShopWishlist Wishlist { get; set; } = default!;
    public ShopProduct Product { get; set; } = default!;
}

public class ShopAddress : BaseEntity, ISoftDeletable
{
    public ulong TenantId { get; set; }
    public ulong UserId { get; set; }
    public string? Label { get; set; }
    public string FullName { get; set; } = default!;
    public string Phone { get; set; } = default!;
    public string Line1 { get; set; } = default!;
    public string? Line2 { get; set; }
    public string City { get; set; } = default!;
    public string State { get; set; } = default!;
    public string PostalCode { get; set; } = default!;
    public string Country { get; set; } = "India";
    public bool IsDefault { get; set; }
    public DateTime? DeletedAt { get; set; }
}

/// <summary>The delivery address as it was when the order was placed.</summary>
public class ShopShippingAddress
{
    public string FullName { get; set; } = default!;
    public string Phone { get; set; } = default!;
    public string Line1 { get; set; } = default!;
    public string? Line2 { get; set; }
    public string City { get; set; } = default!;
    public string State { get; set; } = default!;
    public string PostalCode { get; set; } = default!;
    public string Country { get; set; } = default!;
}

public class ShopOrder : BaseEntity
{
    public ulong TenantId { get; set; }
    /// <summary>e.g. "GB-10001" — the gym's order prefix and its own running number.</summary>
    public string OrderNumber { get; set; } = default!;
    public ulong UserId { get; set; }
    public ShopOrderStatus Status { get; set; } = ShopOrderStatus.Pending;
    public decimal Subtotal { get; set; }
    public decimal Discount { get; set; }
    public decimal Shipping { get; set; }
    public decimal Tax { get; set; }
    public decimal Total { get; set; }
    public ulong? CouponId { get; set; }
    public string? CouponCode { get; set; }
    public ShopDeliveryMethod DeliveryMethod { get; set; }
    public ShopShippingAddress ShippingAddress { get; set; } = new();
    public string? Notes { get; set; }
    public string? TrackingNumber { get; set; }
    public DateTime PlacedAt { get; set; }
    public DateTime? ConfirmedAt { get; set; }
    public DateTime? ProcessingAt { get; set; }
    public DateTime? ShippedAt { get; set; }
    public DateTime? OutForDeliveryAt { get; set; }
    public DateTime? DeliveredAt { get; set; }
    public DateTime? CancelledAt { get; set; }
    public DateTime? EstimatedDelivery { get; set; }

    public User User { get; set; } = default!;
    public Coupon? Coupon { get; set; }
    public ICollection<ShopOrderItem> Items { get; set; } = [];
    public ShopPayment? Payment { get; set; }
}

/// <summary>A line as it was bought — names and prices are copied so later edits don't change past orders.</summary>
public class ShopOrderItem : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong OrderId { get; set; }
    public ulong ProductId { get; set; }
    public ulong VariantId { get; set; }
    public string ProductName { get; set; } = default!;
    public string ProductSlug { get; set; } = default!;
    public string VariantName { get; set; } = default!;
    public string Sku { get; set; } = default!;
    public string? ImageUrl { get; set; }
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; }
    public decimal LineTotal { get; set; }

    public ShopOrder Order { get; set; } = default!;
}

public class ShopPayment : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong OrderId { get; set; }
    public ShopPaymentMethod Method { get; set; }
    public ShopPaymentStatus Status { get; set; }
    public decimal Amount { get; set; }
    public string? TransactionReference { get; set; }
    public DateTime? PaidAt { get; set; }
    public string? FailureReason { get; set; }

    public ShopOrder Order { get; set; } = default!;
}
