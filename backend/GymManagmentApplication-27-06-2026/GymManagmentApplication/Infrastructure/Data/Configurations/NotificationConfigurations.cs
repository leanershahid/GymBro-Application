using GymManagmentApplication.Domain.Entities.Communication;
using GymManagmentApplication.Domain.Entities.Scheduling;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymManagmentApplication.Infrastructure.Data.Configurations;

// Push notifications, notification preferences and class waitlist offers (roadmap feature 3).
// Ids come from per-table HiLo sequences like every other single-Id table (AppDbContext.UseIdSequences):
// the migration must create "PushDevices_Id_hilo_seq", "NotificationPreferences_Id_hilo_seq" and
// "WaitlistOffers_Id_hilo_seq" (INCREMENT BY 10). CommunicationLogs gains Meta (jsonb) and NotBefore.

public sealed class PushDeviceConfiguration : IEntityTypeConfiguration<PushDevice>
{
    public void Configure(EntityTypeBuilder<PushDevice> e)
    {
        e.ToTable("PushDevices");
        e.Property(x => x.Token).HasMaxLength(255).IsRequired();
        e.Property(x => x.Platform).HasMaxLength(16).IsRequired();
        e.Property(x => x.DeviceName).HasMaxLength(120);
        e.Property(x => x.DisabledReason).HasMaxLength(64);
        e.HasIndex(x => x.Token).IsUnique();             // one owner per device token
        e.HasIndex(x => new { x.UserId, x.DisabledAt }); // "active devices of this user"
        e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        e.HasOne<Domain.Entities.Core.Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class NotificationPreferenceConfiguration : IEntityTypeConfiguration<NotificationPreference>
{
    public void Configure(EntityTypeBuilder<NotificationPreference> e)
    {
        e.ToTable("NotificationPreferences");
        e.HasIndex(x => x.UserId).IsUnique();            // one row per user
        e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        e.HasOne<Domain.Entities.Core.Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class WaitlistOfferConfiguration : IEntityTypeConfiguration<WaitlistOffer>
{
    public void Configure(EntityTypeBuilder<WaitlistOffer> e)
    {
        e.ToTable("WaitlistOffers");
        e.Property(x => x.Status).HasMaxLength(16).IsRequired();
        e.HasIndex(x => new { x.ClassId, x.Status });      // held seats of a class
        e.HasIndex(x => new { x.Status, x.ExpiresAt });    // scheduler: expired pending offers
        e.HasIndex(x => new { x.ClientId, x.Status });
        e.HasOne(x => x.Class).WithMany().HasForeignKey(x => x.ClassId).OnDelete(DeleteBehavior.Cascade);
        e.HasOne(x => x.Booking).WithMany().HasForeignKey(x => x.BookingId).OnDelete(DeleteBehavior.Cascade);
        e.HasOne<Domain.Entities.Identity.User>().WithMany().HasForeignKey(x => x.ClientId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne<Domain.Entities.Core.Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);
    }
}
