using GymManagmentApplication.Domain.Entities.Scheduling;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymManagmentApplication.Infrastructure.Data.Configurations;

// Cancellation & no-show rules (roadmap feature 9): penalties and booking blocks.
// Both tables have a ulong TenantId, so AppDbContext's global tenant filter applies automatically.

public sealed class BookingPenaltyConfiguration : IEntityTypeConfiguration<BookingPenalty>
{
    public void Configure(EntityTypeBuilder<BookingPenalty> b)
    {
        b.ToTable("BookingPenalties");
        b.Property(x => x.Type).HasMaxLength(20).IsRequired();
        b.Property(x => x.FeeAmount).HasPrecision(18, 2);
        b.Property(x => x.WaiveReason).HasMaxLength(500);
        b.HasOne(x => x.Client).WithMany().HasForeignKey(x => x.ClientId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.FeeInvoice).WithMany().HasForeignKey(x => x.FeeInvoiceId).OnDelete(DeleteBehavior.Restrict);
        // Idempotency: one penalty per booking / PT session and type, whatever retries or double taps do.
        b.HasIndex(x => new { x.TenantId, x.Type, x.BookingId }).IsUnique().HasFilter("\"BookingId\" IS NOT NULL");
        b.HasIndex(x => new { x.TenantId, x.Type, x.PtSessionId }).IsUnique().HasFilter("\"PtSessionId\" IS NOT NULL");
        b.HasIndex(x => new { x.TenantId, x.ClientId, x.CreatedAt });
        b.HasIndex(x => new { x.TenantId, x.ClassId });
        b.HasTenantForeignKeyRestrict();
    }
}

public sealed class BookingBlockConfiguration : IEntityTypeConfiguration<BookingBlock>
{
    public void Configure(EntityTypeBuilder<BookingBlock> b)
    {
        b.ToTable("BookingBlocks");
        b.Property(x => x.Reason).HasMaxLength(300).IsRequired();
        b.Property(x => x.LiftReason).HasMaxLength(500);
        b.HasOne(x => x.Client).WithMany().HasForeignKey(x => x.ClientId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.TenantId, x.ClientId, x.Until });
        b.HasTenantForeignKeyRestrict();
    }
}
