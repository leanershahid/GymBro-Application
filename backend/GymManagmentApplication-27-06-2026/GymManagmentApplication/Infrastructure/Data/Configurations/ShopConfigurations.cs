using GymManagmentApplication.Domain.Entities.Core;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Entities.Shop;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymManagmentApplication.Infrastructure.Data.Configurations;

// Indexes, keys, money precision and relations of the shop tables.

public sealed class ShopCategoryConfiguration : IEntityTypeConfiguration<ShopCategory>
{
    public void Configure(EntityTypeBuilder<ShopCategory> b)
    {
        b.HasIndex(c => new { c.TenantId, c.Slug });
        b.HasOne(c => c.Parent).WithMany(c => c.Children).HasForeignKey(c => c.ParentId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Tenant>().WithMany().HasForeignKey(c => c.TenantId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class ShopProductConfiguration : IEntityTypeConfiguration<ShopProduct>
{
    public void Configure(EntityTypeBuilder<ShopProduct> b)
    {
        b.HasIndex(p => new { p.TenantId, p.Slug });
        b.HasIndex(p => new { p.TenantId, p.Sku });
        b.Property(p => p.Specifications).HasColumnType("jsonb");
        b.Property(p => p.BasePrice).HasPrecision(12, 2);
        b.Property(p => p.CompareAtPrice).HasPrecision(12, 2);
        b.Property(p => p.AverageRating).HasPrecision(3, 2);
        b.HasOne(p => p.Category).WithMany(c => c.Products).HasForeignKey(p => p.CategoryId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Tenant>().WithMany().HasForeignKey(p => p.TenantId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class ShopProductImageConfiguration : IEntityTypeConfiguration<ShopProductImage>
{
    public void Configure(EntityTypeBuilder<ShopProductImage> b) =>
        b.HasOne(i => i.Product).WithMany(p => p.Images).HasForeignKey(i => i.ProductId).OnDelete(DeleteBehavior.Cascade);
}

public sealed class ShopVariantConfiguration : IEntityTypeConfiguration<ShopVariant>
{
    public void Configure(EntityTypeBuilder<ShopVariant> b)
    {
        b.HasIndex(v => new { v.TenantId, v.Sku });
        b.Property(v => v.Price).HasPrecision(12, 2);
        b.Property(v => v.CompareAtPrice).HasPrecision(12, 2);
        b.HasOne(v => v.Product).WithMany(p => p.Variants).HasForeignKey(v => v.ProductId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class ShopInventoryConfiguration : IEntityTypeConfiguration<ShopInventory>
{
    public void Configure(EntityTypeBuilder<ShopInventory> b)
    {
        b.HasIndex(i => i.VariantId).IsUnique();
        b.HasOne(i => i.Variant).WithOne(v => v.Inventory).HasForeignKey<ShopInventory>(i => i.VariantId).OnDelete(DeleteBehavior.Cascade);
        b.Property(i => i.Version).IsRowVersion();
        b.Ignore(i => i.Available);
    }
}

public sealed class ShopReviewConfiguration : IEntityTypeConfiguration<ShopReview>
{
    public void Configure(EntityTypeBuilder<ShopReview> b)
    {
        b.HasIndex(r => new { r.ProductId, r.UserId }).IsUnique().HasFilter("\"DeletedAt\" IS NULL");
        b.HasOne(r => r.Product).WithMany(p => p.Reviews).HasForeignKey(r => r.ProductId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(r => r.User).WithMany().HasForeignKey(r => r.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class ShopCartConfiguration : IEntityTypeConfiguration<ShopCart>
{
    public void Configure(EntityTypeBuilder<ShopCart> b)
    {
        b.HasIndex(c => new { c.TenantId, c.UserId }).IsUnique();
        b.HasOne<User>().WithMany().HasForeignKey(c => c.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class ShopCartItemConfiguration : IEntityTypeConfiguration<ShopCartItem>
{
    public void Configure(EntityTypeBuilder<ShopCartItem> b)
    {
        b.HasIndex(i => new { i.CartId, i.VariantId }).IsUnique();
        b.HasOne(i => i.Cart).WithMany(c => c.Items).HasForeignKey(i => i.CartId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(i => i.Variant).WithMany().HasForeignKey(i => i.VariantId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class ShopWishlistConfiguration : IEntityTypeConfiguration<ShopWishlist>
{
    public void Configure(EntityTypeBuilder<ShopWishlist> b)
    {
        b.HasIndex(w => new { w.TenantId, w.UserId }).IsUnique();
        b.HasOne<User>().WithMany().HasForeignKey(w => w.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class ShopWishlistItemConfiguration : IEntityTypeConfiguration<ShopWishlistItem>
{
    public void Configure(EntityTypeBuilder<ShopWishlistItem> b)
    {
        b.HasIndex(i => new { i.WishlistId, i.ProductId }).IsUnique();
        b.HasOne(i => i.Wishlist).WithMany(w => w.Items).HasForeignKey(i => i.WishlistId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(i => i.Product).WithMany().HasForeignKey(i => i.ProductId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class ShopAddressConfiguration : IEntityTypeConfiguration<ShopAddress>
{
    public void Configure(EntityTypeBuilder<ShopAddress> b)
    {
        b.HasIndex(a => new { a.TenantId, a.UserId });
        b.HasOne<User>().WithMany().HasForeignKey(a => a.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class ShopOrderConfiguration : IEntityTypeConfiguration<ShopOrder>
{
    public void Configure(EntityTypeBuilder<ShopOrder> b)
    {
        b.HasIndex(o => new { o.TenantId, o.OrderNumber }).IsUnique();
        b.HasIndex(o => new { o.TenantId, o.UserId });
        b.HasIndex(o => new { o.TenantId, o.Status });
        b.OwnsOne(o => o.ShippingAddress);
        foreach (var money in new[] { "Subtotal", "Discount", "Shipping", "Tax", "Total" })
            b.Property(money).HasPrecision(12, 2);
        b.HasOne(o => o.User).WithMany().HasForeignKey(o => o.UserId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(o => o.Coupon).WithMany().HasForeignKey(o => o.CouponId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne<Tenant>().WithMany().HasForeignKey(o => o.TenantId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class ShopOrderItemConfiguration : IEntityTypeConfiguration<ShopOrderItem>
{
    public void Configure(EntityTypeBuilder<ShopOrderItem> b)
    {
        b.Property(i => i.UnitPrice).HasPrecision(12, 2);
        b.Property(i => i.LineTotal).HasPrecision(12, 2);
        b.HasOne(i => i.Order).WithMany(o => o.Items).HasForeignKey(i => i.OrderId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class ShopPaymentConfiguration : IEntityTypeConfiguration<ShopPayment>
{
    public void Configure(EntityTypeBuilder<ShopPayment> b)
    {
        b.HasIndex(p => p.OrderId).IsUnique();
        b.Property(p => p.Amount).HasPrecision(12, 2);
        b.HasOne(p => p.Order).WithOne(o => o.Payment).HasForeignKey<ShopPayment>(p => p.OrderId).OnDelete(DeleteBehavior.Cascade);
    }
}
