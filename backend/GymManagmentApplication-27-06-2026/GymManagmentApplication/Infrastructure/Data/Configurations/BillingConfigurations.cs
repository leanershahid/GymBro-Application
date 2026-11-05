using GymManagmentApplication.Domain.Entities.Billing;
using GymManagmentApplication.Domain.Entities.Membership;
using GymManagmentApplication.Domain.Entities.Platform;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymManagmentApplication.Infrastructure.Data.Configurations;

// Membership plans, memberships, invoices, payments, coupons and pricing rules.

public sealed class MembershipPlanConfiguration : IEntityTypeConfiguration<MembershipPlan>
{
    public void Configure(EntityTypeBuilder<MembershipPlan> b) =>
        b.Property(e => e.Price).HasPrecision(18, 2);
}

public sealed class GymMembershipConfiguration : IEntityTypeConfiguration<GymMembership>
{
    public void Configure(EntityTypeBuilder<GymMembership> b)
    {
        b.HasIndex(m => new { m.UserId, m.Status });
        // ARCH-088: expiry / renewal scans ("active memberships of this gym ending before …").
        b.HasIndex(m => new { m.TenantId, m.Status, m.EndsAt });
        b.HasOne(m => m.Tenant).WithMany().HasForeignKey(m => m.TenantId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class InvoiceConfiguration : IEntityTypeConfiguration<Invoice>
{
    public void Configure(EntityTypeBuilder<Invoice> b)
    {
        b.HasIndex(i => new { i.TenantId, i.InvoiceNo }).IsUnique();
        b.HasIndex(i => new { i.TenantId, i.UserId });
        // ARCH-088: a member's open / overdue invoices.
        b.HasIndex(i => new { i.UserId, i.Status });
        b.HasOne(i => i.Tenant).WithMany().HasForeignKey(i => i.TenantId).OnDelete(DeleteBehavior.Restrict);
        b.Property(e => e.Subtotal).HasPrecision(18, 2);
        b.Property(e => e.Tax).HasPrecision(18, 2);
        b.Property(e => e.Discount).HasPrecision(18, 2);
        b.Property(e => e.Total).HasPrecision(18, 2);
    }
}

public sealed class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> b)
    {
        b.HasIndex(p => new { p.TenantId, p.CreatedAt });
        // ARCH-011: one row per gateway payment / per client idempotency key.
        b.HasIndex(p => new { p.TenantId, p.GatewayRef }).IsUnique().HasFilter("\"GatewayRef\" IS NOT NULL");
        b.Property(p => p.IdempotencyKey).HasMaxLength(100);
        b.HasIndex(p => new { p.TenantId, p.IdempotencyKey }).IsUnique().HasFilter("\"IdempotencyKey\" IS NOT NULL");
        b.HasOne(p => p.Tenant).WithMany().HasForeignKey(p => p.TenantId).OnDelete(DeleteBehavior.Restrict);
        b.Property(e => e.Amount).HasPrecision(18, 2);
    }
}

public sealed class CouponConfiguration : IEntityTypeConfiguration<Coupon>
{
    public void Configure(EntityTypeBuilder<Coupon> b)
    {
        b.Property(e => e.Value).HasPrecision(18, 2);
        b.Property(e => e.MinOrder).HasPrecision(18, 2);
        b.Property(e => e.MaxDiscount).HasPrecision(18, 2);
    }
}

public sealed class CouponRedemptionConfiguration : IEntityTypeConfiguration<CouponRedemption>
{
    public void Configure(EntityTypeBuilder<CouponRedemption> b)
    {
        b.Property(e => e.DiscountApplied).HasPrecision(18, 2);
        b.HasTenantForeignKeyRestrict();
    }
}

public sealed class PricingRuleConfiguration : IEntityTypeConfiguration<PricingRule>
{
    public void Configure(EntityTypeBuilder<PricingRule> b) =>
        b.Property(e => e.PriceModifier).HasPrecision(18, 4);
}
