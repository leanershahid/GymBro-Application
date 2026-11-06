using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Entities.Safety;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymManagmentApplication.Infrastructure.Data.Configurations;

// Member safety & compliance: waivers, health screening, emergency contacts, consents, gate overrides.
// Every table has a ulong TenantId, so AppDbContext's global tenant filter applies automatically.

public sealed class WaiverDocumentConfiguration : IEntityTypeConfiguration<WaiverDocument>
{
    public void Configure(EntityTypeBuilder<WaiverDocument> b)
    {
        b.ToTable("WaiverDocuments");
        b.Property(x => x.Title).HasMaxLength(200).IsRequired();
        b.HasMany(x => x.Versions).WithOne(v => v.Waiver).HasForeignKey(v => v.WaiverId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.TenantId, x.IsActive });
        b.HasTenantForeignKeyRestrict();
    }
}

public sealed class WaiverVersionConfiguration : IEntityTypeConfiguration<WaiverVersion>
{
    public void Configure(EntityTypeBuilder<WaiverVersion> b)
    {
        b.ToTable("WaiverVersions");
        b.Property(x => x.Title).HasMaxLength(200).IsRequired();
        b.Property(x => x.Body).HasMaxLength(50_000).IsRequired();
        b.Property(x => x.BodyHash).HasMaxLength(64).IsRequired();
        b.HasIndex(x => new { x.WaiverId, x.Version }).IsUnique();
        b.HasTenantForeignKeyRestrict();
    }
}

public sealed class WaiverSignatureConfiguration : IEntityTypeConfiguration<WaiverSignature>
{
    public void Configure(EntityTypeBuilder<WaiverSignature> b)
    {
        b.ToTable("WaiverSignatures");
        b.Property(x => x.SignedName).HasMaxLength(200).IsRequired();
        b.Property(x => x.Ip).HasMaxLength(64);
        b.Property(x => x.UserAgent).HasMaxLength(512);
        b.Property(x => x.BodyHash).HasMaxLength(64).IsRequired();
        b.HasOne(x => x.WaiverVersion).WithMany().HasForeignKey(x => x.WaiverVersionId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<WaiverDocument>().WithMany().HasForeignKey(x => x.WaiverId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        // One signature per member per version (a double-tap can't sign twice).
        b.HasIndex(x => new { x.UserId, x.WaiverVersionId }).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.UserId });
        b.HasTenantForeignKeyRestrict();
    }
}

public sealed class HealthScreeningConfiguration : IEntityTypeConfiguration<HealthScreening>
{
    public void Configure(EntityTypeBuilder<HealthScreening> b)
    {
        b.ToTable("HealthScreenings");
        b.Property(x => x.FormVersion).HasMaxLength(40).IsRequired();
        b.Property(x => x.Conditions).HasMaxLength(2000);
        b.Property(x => x.Medications).HasMaxLength(2000);
        b.Property(x => x.Injuries).HasMaxLength(2000);
        b.Property(x => x.Pregnancy).HasMaxLength(500);
        b.Property(x => x.ClearanceNote).HasMaxLength(1000);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.TenantId, x.UserId, x.SubmittedAt });
        b.HasTenantForeignKeyRestrict();
    }
}

public sealed class MemberEmergencyContactConfiguration : IEntityTypeConfiguration<MemberEmergencyContact>
{
    public void Configure(EntityTypeBuilder<MemberEmergencyContact> b)
    {
        b.ToTable("MemberEmergencyContacts");
        b.Property(x => x.Name).HasMaxLength(150).IsRequired();
        b.Property(x => x.Relationship).HasMaxLength(60);
        b.Property(x => x.Phone).HasMaxLength(30).IsRequired();
        b.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => x.UserId).IsUnique();
        b.HasTenantForeignKeyRestrict();
    }
}

public sealed class ConsentRecordConfiguration : IEntityTypeConfiguration<ConsentRecord>
{
    public void Configure(EntityTypeBuilder<ConsentRecord> b)
    {
        b.ToTable("ConsentRecords");
        b.Property(x => x.Type).HasMaxLength(40).IsRequired();
        b.Property(x => x.Version).HasMaxLength(40).IsRequired();
        b.Property(x => x.Source).HasMaxLength(40).IsRequired();
        b.Property(x => x.Ip).HasMaxLength(64);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.TenantId, x.UserId, x.Type, x.At });
        b.HasTenantForeignKeyRestrict();
    }
}

public sealed class SafetyGateOverrideConfiguration : IEntityTypeConfiguration<SafetyGateOverride>
{
    public void Configure(EntityTypeBuilder<SafetyGateOverride> b)
    {
        b.ToTable("SafetyGateOverrides");
        b.Property(x => x.Context).HasMaxLength(40).IsRequired();
        b.Property(x => x.Missing).HasMaxLength(200).IsRequired();
        b.Property(x => x.Reason).HasMaxLength(500);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.TenantId, x.UserId, x.At });
        b.HasTenantForeignKeyRestrict();
    }
}

/// <summary>
/// Refuses to save an update or delete of an <see cref="IAppendOnly"/> row (signed waivers, consent
/// records, gate overrides): those are legal records. Called from AppDbContext.SaveChanges.
/// </summary>
public static class AppendOnlyGuard
{
    public static void Check(ChangeTracker tracker)
    {
        foreach (var entry in tracker.Entries())
        {
            ClosedIncidentGuard.Check(entry); // facilities: closed incidents are sealed too
            if (entry.Entity is not IAppendOnly) continue;
            if (entry.State is EntityState.Modified or EntityState.Deleted)
                throw new InvalidOperationException(
                    $"{entry.Metadata.ClrType.Name} rows are append-only records and cannot be changed or deleted.");
        }
    }
}
