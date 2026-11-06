using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Entities.Messaging;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymManagmentApplication.Infrastructure.Data.Configurations;

// Trainer ↔ member messaging (feature 8). All tables have a ulong TenantId, so AppDbContext's
// global tenant filter applies; ids come from the per-table HiLo sequences like every other ulong Id.

public sealed class ConversationConfiguration : IEntityTypeConfiguration<Conversation>
{
    public void Configure(EntityTypeBuilder<Conversation> b)
    {
        b.ToTable("Conversations");
        b.Property(x => x.LastMessagePreview).HasMaxLength(200);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.TrainerUserId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.MemberUserId).OnDelete(DeleteBehavior.Restrict);
        b.HasMany(x => x.Messages).WithOne(m => m.Conversation).HasForeignKey(m => m.ConversationId).OnDelete(DeleteBehavior.Cascade);
        // One thread per pair per gym (also the race guard when both open it at once).
        b.HasIndex(x => new { x.TenantId, x.TrainerUserId, x.MemberUserId }).IsUnique();
        // Each side's inbox, newest first; the admin review list.
        b.HasIndex(x => new { x.TenantId, x.MemberUserId, x.LastMessageAt });
        b.HasIndex(x => new { x.TenantId, x.LastMessageAt });
        b.HasTenantForeignKeyRestrict();
    }
}

public sealed class DirectMessageConfiguration : IEntityTypeConfiguration<DirectMessage>
{
    public void Configure(EntityTypeBuilder<DirectMessage> b)
    {
        b.ToTable("DirectMessages");
        b.Property(x => x.ClientMessageId).HasMaxLength(64).IsRequired();
        b.Property(x => x.Body).HasMaxLength(2000).IsRequired();
        b.Property(x => x.PhotoUrl).HasMaxLength(1000);
        b.Property(x => x.AttachmentType).HasMaxLength(20);
        b.Property(x => x.AttachmentTitle).HasMaxLength(200);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.SenderId).OnDelete(DeleteBehavior.Restrict);
        // Idempotent send: a retried clientMessageId is stored once.
        b.HasIndex(x => new { x.SenderId, x.ClientMessageId }).IsUnique();
        // Thread paging and unread counts.
        b.HasIndex(x => new { x.ConversationId, x.CreatedAt });
        // Rate limit (sender's last minute) and the reported-messages filter.
        b.HasIndex(x => new { x.SenderId, x.CreatedAt });
        b.HasIndex(x => new { x.TenantId, x.ReportedAt });
        b.HasTenantForeignKeyRestrict();
    }
}

public sealed class MessagingUserSettingConfiguration : IEntityTypeConfiguration<MessagingUserSetting>
{
    public void Configure(EntityTypeBuilder<MessagingUserSetting> b)
    {
        b.ToTable("MessagingUserSettings");
        b.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => x.UserId).IsUnique();
        b.HasTenantForeignKeyRestrict();
    }
}
