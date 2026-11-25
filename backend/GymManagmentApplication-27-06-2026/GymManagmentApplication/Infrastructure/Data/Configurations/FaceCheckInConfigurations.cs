using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Entities.Scheduling;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymManagmentApplication.Infrastructure.Data.Configurations;

// Face check-in: reference photos (one per member and gym) and the log of face checks at self
// check-in. Both have a ulong TenantId, so AppDbContext's global tenant filter applies.

public sealed class FaceEnrollmentConfiguration : IEntityTypeConfiguration<FaceEnrollment>
{
    public void Configure(EntityTypeBuilder<FaceEnrollment> b)
    {
        b.ToTable("FaceEnrollments");
        b.Property(x => x.PhotoUrl).HasMaxLength(1000);
        b.Property(x => x.Status).HasMaxLength(20).IsRequired();
        b.Property(x => x.Source).HasMaxLength(10).IsRequired();
        b.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => new { x.TenantId, x.UserId }).IsUnique();
        b.HasTenantForeignKeyRestrict();
    }
}

public sealed class FaceCheckInAttemptConfiguration : IEntityTypeConfiguration<FaceCheckInAttempt>
{
    public void Configure(EntityTypeBuilder<FaceCheckInAttempt> b)
    {
        b.ToTable("FaceCheckInAttempts");
        b.Property(x => x.Outcome).HasMaxLength(20).IsRequired();
        b.Property(x => x.Detail).HasMaxLength(40);
        b.Property(x => x.Similarity).HasPrecision(5, 2);
        b.Property(x => x.SelfieUrl).HasMaxLength(1000);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        // Rate limit (recent mismatches of a member) and the staff log (a gym's attempts by day).
        b.HasIndex(x => new { x.TenantId, x.UserId, x.At });
        b.HasIndex(x => new { x.TenantId, x.At });
        b.HasTenantForeignKeyRestrict();
    }
}
