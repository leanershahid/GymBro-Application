using GymManagmentApplication.Domain.Entities.Core;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Entities.Scheduling;
using GymManagmentApplication.Domain.Entities.Support;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymManagmentApplication.Infrastructure.Data.Configurations;

// Help & feedback (feature 6): support requests + their thread, FAQ, canned replies, class
// feedback. All have a ulong TenantId, so AppDbContext's global tenant filter applies; ids come
// from the per-table HiLo sequences like every other ulong Id.

public sealed class SupportRequestConfiguration : IEntityTypeConfiguration<SupportRequest>
{
    public void Configure(EntityTypeBuilder<SupportRequest> b)
    {
        b.ToTable("SupportRequests");
        b.Property(x => x.Category).HasMaxLength(30).IsRequired();
        b.Property(x => x.Subject).HasMaxLength(150).IsRequired();
        b.Property(x => x.Status).HasMaxLength(20).IsRequired();
        b.Property(x => x.Priority).HasMaxLength(20).IsRequired();
        b.Property(x => x.ContactMethod).HasMaxLength(20);
        b.Property(x => x.LastMessageBy).HasMaxLength(20);
        b.Property(x => x.RatingComment).HasMaxLength(1000);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.AssigneeId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne<Branch>().WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.SetNull);
        b.HasMany(x => x.Messages).WithOne(m => m.Request).HasForeignKey(m => m.RequestId).OnDelete(DeleteBehavior.Cascade);
        // Staff queue (status, newest activity), "my requests", assignee views and the digest scan.
        b.HasIndex(x => new { x.TenantId, x.Status, x.LastMessageAt });
        b.HasIndex(x => new { x.TenantId, x.UserId, x.CreatedAt });
        b.HasIndex(x => new { x.TenantId, x.AssigneeId, x.Status });
        b.HasTenantForeignKeyRestrict();
    }
}

public sealed class SupportMessageConfiguration : IEntityTypeConfiguration<SupportMessage>
{
    public void Configure(EntityTypeBuilder<SupportMessage> b)
    {
        b.ToTable("SupportMessages");
        b.Property(x => x.AuthorRole).HasMaxLength(20).IsRequired();
        b.Property(x => x.Kind).HasMaxLength(20).IsRequired();
        b.Property(x => x.Body).HasMaxLength(4000).IsRequired();
        b.HasOne<User>().WithMany().HasForeignKey(x => x.AuthorId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.RequestId, x.CreatedAt });
        b.HasTenantForeignKeyRestrict();
    }
}

public sealed class SupportFaqConfiguration : IEntityTypeConfiguration<SupportFaq>
{
    public void Configure(EntityTypeBuilder<SupportFaq> b)
    {
        b.ToTable("SupportFaqs");
        b.Property(x => x.Question).HasMaxLength(300).IsRequired();
        b.Property(x => x.Answer).HasMaxLength(4000).IsRequired();
        b.Property(x => x.Category).HasMaxLength(30);
        b.HasIndex(x => new { x.TenantId, x.SortOrder });
        b.HasTenantForeignKeyRestrict();
    }
}

public sealed class SupportCannedReplyConfiguration : IEntityTypeConfiguration<SupportCannedReply>
{
    public void Configure(EntityTypeBuilder<SupportCannedReply> b)
    {
        b.ToTable("SupportCannedReplies");
        b.Property(x => x.Title).HasMaxLength(100).IsRequired();
        b.Property(x => x.Body).HasMaxLength(4000).IsRequired();
        b.HasIndex(x => new { x.TenantId, x.SortOrder });
        b.HasTenantForeignKeyRestrict();
    }
}

public sealed class ClassFeedbackConfiguration : IEntityTypeConfiguration<ClassFeedback>
{
    public void Configure(EntityTypeBuilder<ClassFeedback> b)
    {
        b.ToTable("ClassFeedbacks");
        b.Property(x => x.Comment).HasMaxLength(1000);
        b.HasOne<ClassBooking>().WithMany().HasForeignKey(x => x.BookingId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        // Once per booking (also the double-tap guard).
        b.HasIndex(x => x.BookingId).IsUnique();
        // Averages per class type / per trainer.
        b.HasIndex(x => new { x.TenantId, x.ClassTypeId });
        b.HasIndex(x => new { x.TenantId, x.TrainerId });
        b.HasIndex(x => new { x.TenantId, x.UserId });
        b.HasTenantForeignKeyRestrict();
    }
}
