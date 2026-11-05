using GymManagmentApplication.Domain.Entities.Core;
using GymManagmentApplication.Domain.Entities.Platform;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymManagmentApplication.Infrastructure.Data.Configurations;

// Tenants, branches and per-gym counters.

internal static class ConfigurationExtensions
{
    /// <summary>
    /// FK from the entity's TenantId column to Tenants with ON DELETE RESTRICT, for entities that have
    /// no Tenant navigation (keeps a tenant delete from cascading through member data).
    /// </summary>
    public static void HasTenantForeignKeyRestrict<T>(this EntityTypeBuilder<T> b) where T : class =>
        b.HasOne<Tenant>().WithMany().HasForeignKey("TenantId").OnDelete(DeleteBehavior.Restrict);
}

public sealed class TenantConfiguration : IEntityTypeConfiguration<Tenant>
{
    public void Configure(EntityTypeBuilder<Tenant> b) =>
        b.HasIndex(t => t.Slug).IsUnique();
}

public sealed class BranchConfiguration : IEntityTypeConfiguration<Branch>
{
    public void Configure(EntityTypeBuilder<Branch> b)
    {
        // Per-gym uniqueness: two gyms may each have a "MAIN" branch.
        b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
        b.Property(e => e.Lat).HasPrecision(10, 7);
        b.Property(e => e.Lng).HasPrecision(10, 7);
    }
}

/// <summary>ARCH-006: per-gym running numbers (invoice / shop order).</summary>
public sealed class TenantCounterConfiguration : IEntityTypeConfiguration<TenantCounter>
{
    public void Configure(EntityTypeBuilder<TenantCounter> b)
    {
        b.HasKey(c => new { c.TenantId, c.Key });
        b.Property(c => c.Key).HasMaxLength(64);
    }
}
