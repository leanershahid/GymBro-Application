using GymManagmentApplication.Domain.Entities.Core;
using GymManagmentApplication.Domain.Entities.Facilities;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Entities.Operations;
using GymManagmentApplication.Domain.Entities.Training;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymManagmentApplication.Infrastructure.Data.Configurations;

// Facilities (roadmap feature 7): equipment register, maintenance history, problem reports and the
// incident log. Every table has a ulong TenantId, so AppDbContext's global tenant filter applies.
// Single-ulong-Id tables get their "{Table}_Id_hilo_seq" sequence from AppDbContext.UseIdSequences.
// Incidents and their people / addenda use Restrict deletes: they are legal records.

public sealed class FacilityAssetConfiguration : IEntityTypeConfiguration<FacilityAsset>
{
    public void Configure(EntityTypeBuilder<FacilityAsset> b)
    {
        b.ToTable("FacilityAssets");
        b.Property(x => x.Name).HasMaxLength(120).IsRequired();
        b.Property(x => x.AssetType).HasMaxLength(80);
        b.Property(x => x.Zone).HasMaxLength(80);
        b.Property(x => x.PhotoUrl).HasMaxLength(1000);
        b.Property(x => x.SerialNumber).HasMaxLength(120);
        b.Property(x => x.AssetCode).HasMaxLength(40).IsRequired();
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.StatusReason).HasMaxLength(500);
        b.Property(x => x.Notes).HasMaxLength(2000);
        b.HasOne<Branch>().WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Equipment>().WithMany().HasForeignKey(x => x.EquipmentId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne<ServiceStatus>().WithMany().HasForeignKey(x => x.ServiceStatusId).OnDelete(DeleteBehavior.SetNull);
        // The QR label resolves to one asset of the gym.
        b.HasIndex(x => new { x.TenantId, x.AssetCode }).IsUnique();
        // Register list / member picker: a branch's floor by zone; out-of-service list.
        b.HasIndex(x => new { x.TenantId, x.BranchId, x.Zone });
        b.HasIndex(x => new { x.TenantId, x.BranchId, x.Status });
        b.HasTenantForeignKeyRestrict();
    }
}

public sealed class FacilityMaintenanceConfiguration : IEntityTypeConfiguration<FacilityMaintenance>
{
    public void Configure(EntityTypeBuilder<FacilityMaintenance> b)
    {
        b.ToTable("FacilityMaintenances");
        b.Property(x => x.Work).HasMaxLength(2000).IsRequired();
        b.Property(x => x.PerformedBy).HasMaxLength(150);
        b.Property(x => x.Cost).HasPrecision(18, 2);
        b.HasOne<FacilityAsset>().WithMany().HasForeignKey(x => x.AssetId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => new { x.AssetId, x.PerformedOn });
        b.HasTenantForeignKeyRestrict();
    }
}

public sealed class FacilityReportConfiguration : IEntityTypeConfiguration<FacilityReport>
{
    public void Configure(EntityTypeBuilder<FacilityReport> b)
    {
        b.ToTable("FacilityReports");
        b.Property(x => x.OtherLocation).HasMaxLength(200);
        b.Property(x => x.ProblemType).HasMaxLength(20).IsRequired();
        b.Property(x => x.Description).HasMaxLength(2000);
        b.Property(x => x.PhotoUrls).HasMaxLength(3100);
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.ResolutionNote).HasMaxLength(1000);
        b.HasOne<Branch>().WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<FacilityAsset>().WithMany().HasForeignKey(x => x.AssetId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.ReporterUserId).OnDelete(DeleteBehavior.Restrict);
        // Staff queue (open first) and the duplicate guard (open report for this asset).
        b.HasIndex(x => new { x.TenantId, x.Status, x.IsUrgent });
        b.HasIndex(x => new { x.TenantId, x.AssetId, x.Status });
        b.HasIndex(x => new { x.ReporterUserId, x.CreatedAt });
        b.HasTenantForeignKeyRestrict();
    }
}

public sealed class FacilityReportFollowerConfiguration : IEntityTypeConfiguration<FacilityReportFollower>
{
    public void Configure(EntityTypeBuilder<FacilityReportFollower> b)
    {
        b.ToTable("FacilityReportFollowers");
        // Composite key = one +1 per person per report.
        b.HasKey(x => new { x.ReportId, x.UserId });
        b.HasOne<FacilityReport>().WithMany().HasForeignKey(x => x.ReportId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => x.UserId);
        b.HasTenantForeignKeyRestrict();
    }
}

public sealed class FacilityReportCommentConfiguration : IEntityTypeConfiguration<FacilityReportComment>
{
    public void Configure(EntityTypeBuilder<FacilityReportComment> b)
    {
        b.ToTable("FacilityReportComments");
        b.Property(x => x.Body).HasMaxLength(1000).IsRequired();
        b.HasOne<FacilityReport>().WithMany().HasForeignKey(x => x.ReportId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.ReportId, x.CreatedAt });
        b.HasTenantForeignKeyRestrict();
    }
}

public sealed class IncidentConfiguration : IEntityTypeConfiguration<Incident>
{
    public void Configure(EntityTypeBuilder<Incident> b)
    {
        b.ToTable("Incidents");
        b.Property(x => x.Location).HasMaxLength(200).IsRequired();
        b.Property(x => x.Type).HasMaxLength(30).IsRequired();
        b.Property(x => x.Severity).HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.Description).HasMaxLength(10_000).IsRequired();
        b.Property(x => x.FirstAidBy).HasMaxLength(150);
        b.Property(x => x.Witnesses).HasMaxLength(2000);
        b.Property(x => x.FollowUpActions).HasMaxLength(4000);
        b.Property(x => x.AttachmentUrls).HasMaxLength(10_000);
        b.Property(x => x.ClosureNote).HasMaxLength(2000);
        b.HasOne<Branch>().WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<FacilityAsset>().WithMany().HasForeignKey(x => x.AssetId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.ReportedByUserId).OnDelete(DeleteBehavior.Restrict);
        b.HasMany(x => x.People).WithOne().HasForeignKey(p => p.IncidentId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.TenantId, x.Status, x.OccurredAt });
        b.HasIndex(x => new { x.TenantId, x.BranchId, x.OccurredAt });
        b.HasTenantForeignKeyRestrict();
    }
}

public sealed class IncidentPersonConfiguration : IEntityTypeConfiguration<IncidentPerson>
{
    public void Configure(EntityTypeBuilder<IncidentPerson> b)
    {
        b.ToTable("IncidentPeople");
        b.Property(x => x.Kind).HasMaxLength(20).IsRequired();
        b.Property(x => x.Name).HasMaxLength(150).IsRequired();
        b.Property(x => x.Contact).HasMaxLength(200);
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        // Export / anonymisation: incidents a member is part of.
        b.HasIndex(x => new { x.TenantId, x.UserId });
        b.HasTenantForeignKeyRestrict();
    }
}

public sealed class IncidentAddendumConfiguration : IEntityTypeConfiguration<IncidentAddendum>
{
    public void Configure(EntityTypeBuilder<IncidentAddendum> b)
    {
        b.ToTable("IncidentAddenda");
        b.Property(x => x.Body).HasMaxLength(5000).IsRequired();
        b.HasOne<Incident>().WithMany().HasForeignKey(x => x.IncidentId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.AuthorUserId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.IncidentId, x.CreatedAt });
        b.HasTenantForeignKeyRestrict();
    }
}

/// <summary>
/// Closed incidents are legal records: a row whose stored status is Closed may not be updated or
/// deleted (called from <see cref="AppendOnlyGuard"/> on every SaveChanges). Corrections go into an
/// IncidentAddendum. Set-based updates (anonymisation) bypass this on purpose.
/// </summary>
public static class ClosedIncidentGuard
{
    public static void Check(Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry entry)
    {
        if (entry.Entity is not Incident || entry.State is not (EntityState.Modified or EntityState.Deleted)) return;
        if (entry.OriginalValues[nameof(Incident.Status)] is IncidentStatus.Closed)
            throw new InvalidOperationException("A closed incident can't be changed. Add an addendum instead.");
    }
}
