using GymManagmentApplication.Domain.Entities.Core;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Entities.Operations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymManagmentApplication.Infrastructure.Data.Configurations;

// Gym operations: opening hours, hours exceptions, branch profile, service status, announcements.
// Every table has a ulong TenantId, so AppDbContext's global tenant filter applies automatically.
// Single-ulong-Id tables get their "{Table}_Id_hilo_seq" sequence from AppDbContext.UseIdSequences.

public sealed class BranchOpeningIntervalConfiguration : IEntityTypeConfiguration<BranchOpeningInterval>
{
    public void Configure(EntityTypeBuilder<BranchOpeningInterval> b)
    {
        b.ToTable("BranchOpeningIntervals");
        b.HasOne<Branch>().WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => new { x.BranchId, x.DayOfWeek });
        b.HasTenantForeignKeyRestrict();
    }
}

public sealed class BranchHoursExceptionConfiguration : IEntityTypeConfiguration<BranchHoursException>
{
    public void Configure(EntityTypeBuilder<BranchHoursException> b)
    {
        b.ToTable("BranchHoursExceptions");
        b.Property(x => x.Intervals).HasMaxLength(200);
        b.Property(x => x.Note).HasMaxLength(200);
        b.HasOne<Branch>().WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.Cascade);
        // One exception per branch per date.
        b.HasIndex(x => new { x.BranchId, x.Date }).IsUnique();
        b.HasTenantForeignKeyRestrict();
    }
}

public sealed class BranchProfileConfiguration : IEntityTypeConfiguration<BranchProfile>
{
    public void Configure(EntityTypeBuilder<BranchProfile> b)
    {
        b.ToTable("BranchProfiles");
        b.Property(x => x.Amenities).HasMaxLength(5000);
        b.Property(x => x.Accessibility).HasMaxLength(5000);
        b.HasOne<Branch>().WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => x.BranchId).IsUnique();
        b.HasTenantForeignKeyRestrict();
    }
}

public sealed class ServiceStatusConfiguration : IEntityTypeConfiguration<ServiceStatus>
{
    public void Configure(EntityTypeBuilder<ServiceStatus> b)
    {
        b.ToTable("ServiceStatuses");
        b.Property(x => x.Area).HasMaxLength(80);
        b.Property(x => x.Message).HasMaxLength(500).IsRequired();
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.Severity).HasConversion<string>().HasMaxLength(20);
        b.HasOne<Branch>().WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => new { x.TenantId, x.BranchId, x.EndsAt });
        b.HasTenantForeignKeyRestrict();
    }
}

public sealed class AnnouncementConfiguration : IEntityTypeConfiguration<Announcement>
{
    public void Configure(EntityTypeBuilder<Announcement> b)
    {
        b.ToTable("Announcements");
        b.Property(x => x.Title).HasMaxLength(150).IsRequired();
        b.Property(x => x.Body).HasMaxLength(10_000).IsRequired();
        b.Property(x => x.ImageUrl).HasMaxLength(1000);
        b.Property(x => x.CtaLabel).HasMaxLength(40);
        b.Property(x => x.CtaRoute).HasMaxLength(200);
        b.Property(x => x.AudienceIds).HasMaxLength(2000);
        b.Property(x => x.Audience).HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
        // The publish job's scan: due scheduled / unfinished announcements.
        b.HasIndex(x => new { x.Status, x.PublishAt });
        b.HasIndex(x => new { x.TenantId, x.Status });
        b.HasTenantForeignKeyRestrict();
    }
}

public sealed class AnnouncementRecipientConfiguration : IEntityTypeConfiguration<AnnouncementRecipient>
{
    public void Configure(EntityTypeBuilder<AnnouncementRecipient> b)
    {
        b.ToTable("AnnouncementRecipients");
        // Composite key = nobody can receive the same announcement twice.
        b.HasKey(x => new { x.AnnouncementId, x.UserId });
        b.HasOne<Announcement>().WithMany().HasForeignKey(x => x.AnnouncementId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        // The member feed: my announcements, unread first.
        b.HasIndex(x => new { x.UserId, x.ReadAt });
        b.HasTenantForeignKeyRestrict();
    }
}
