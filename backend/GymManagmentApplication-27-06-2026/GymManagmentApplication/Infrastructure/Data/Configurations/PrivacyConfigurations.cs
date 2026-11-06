using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Entities.Privacy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymManagmentApplication.Infrastructure.Data.Configurations;

// Privacy controls: account deletion requests and data exports. Both have a ulong TenantId, so
// AppDbContext's global tenant filter applies automatically.

public sealed class AccountDeletionRequestConfiguration : IEntityTypeConfiguration<AccountDeletionRequest>
{
    public void Configure(EntityTypeBuilder<AccountDeletionRequest> b)
    {
        b.ToTable("AccountDeletionRequests");
        b.Property(x => x.Status).HasMaxLength(20).IsRequired();
        b.Property(x => x.Source).HasMaxLength(20).IsRequired();
        b.Property(x => x.BlockedReason).HasMaxLength(500);
        b.Property(x => x.Reason).HasMaxLength(500);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.TenantId, x.Status, x.ScheduledFor });
        b.HasIndex(x => new { x.TenantId, x.UserId });
        b.HasTenantForeignKeyRestrict();
    }
}

public sealed class DataExportRequestConfiguration : IEntityTypeConfiguration<DataExportRequest>
{
    public void Configure(EntityTypeBuilder<DataExportRequest> b)
    {
        b.ToTable("DataExportRequests");
        b.Property(x => x.Status).HasMaxLength(20).IsRequired();
        b.Property(x => x.FileUrl).HasMaxLength(1000);
        b.Property(x => x.Error).HasMaxLength(500);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.TenantId, x.UserId, x.RequestedAt });
        b.HasIndex(x => new { x.Status, x.RequestedAt });
        b.HasTenantForeignKeyRestrict();
    }
}
