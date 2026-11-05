using GymManagmentApplication.Domain.Entities.Communication;
using GymManagmentApplication.Domain.Entities.Core;
using GymManagmentApplication.Domain.Entities.CRM;
using GymManagmentApplication.Domain.Entities.Facility;
using GymManagmentApplication.Domain.Entities.Gamification;
using GymManagmentApplication.Domain.Entities.Health;
using GymManagmentApplication.Domain.Entities.Platform;
using GymManagmentApplication.Domain.Entities.Scheduling;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymManagmentApplication.Infrastructure.Data.Configurations;

// Scheduling, attendance, health, CRM, engagement, communication and platform tables.

// ── Scheduling ───────────────────────────────────────────────────────────────

public sealed class GymClassConfiguration : IEntityTypeConfiguration<GymClass>
{
    public void Configure(EntityTypeBuilder<GymClass> b)
    {
        b.HasOne(g => g.Tenant).WithMany().HasForeignKey(g => g.TenantId).OnDelete(DeleteBehavior.Restrict);
        // ARCH-088: timetable / upcoming-class queries.
        b.HasIndex(g => new { g.TenantId, g.StartsAt });
    }
}

public sealed class ClassBookingConfiguration : IEntityTypeConfiguration<ClassBooking>
{
    public void Configure(EntityTypeBuilder<ClassBooking> b) =>
        b.HasOne(x => x.Tenant).WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);
}

public sealed class AttendanceConfiguration : IEntityTypeConfiguration<Attendance>
{
    public void Configure(EntityTypeBuilder<Attendance> b)
    {
        b.HasOne(a => a.Tenant).WithMany().HasForeignKey(a => a.TenantId).OnDelete(DeleteBehavior.Restrict);
        b.Property(e => e.CheckInLat).HasPrecision(10, 7);
        b.Property(e => e.CheckInLng).HasPrecision(10, 7);
        b.HasIndex(a => new { a.UserId, a.CheckInAt });
    }
}

public sealed class AccessEventConfiguration : IEntityTypeConfiguration<AccessEvent>
{
    public void Configure(EntityTypeBuilder<AccessEvent> b) =>
        b.Property(e => e.Confidence).HasPrecision(10, 4);
}

// ── Health ───────────────────────────────────────────────────────────────────

public sealed class ClientProfileConfiguration : IEntityTypeConfiguration<ClientProfile>
{
    public void Configure(EntityTypeBuilder<ClientProfile> b)
    {
        b.Property(e => e.WeightKg).HasPrecision(10, 3);
        b.Property(e => e.HeightCm).HasPrecision(10, 3);
        b.Property(e => e.BodyFatPct).HasPrecision(10, 3);
        b.Property(e => e.MuscleMassKg).HasPrecision(10, 3);
        b.HasTenantForeignKeyRestrict();
    }
}

public sealed class HealthMetricConfiguration : IEntityTypeConfiguration<HealthMetric>
{
    public void Configure(EntityTypeBuilder<HealthMetric> b)
    {
        b.Property(e => e.WeightKg).HasPrecision(10, 3);
        b.Property(e => e.BodyFatPct).HasPrecision(10, 3);
        b.Property(e => e.Bmi).HasPrecision(10, 4);
        b.Property(e => e.SleepHours).HasPrecision(10, 2);
        b.HasTenantForeignKeyRestrict();
    }
}

public sealed class HabitTrackerConfiguration : IEntityTypeConfiguration<HabitTracker>
{
    public void Configure(EntityTypeBuilder<HabitTracker> b) => b.HasTenantForeignKeyRestrict();
}

public sealed class HabitLogConfiguration : IEntityTypeConfiguration<HabitLog>
{
    public void Configure(EntityTypeBuilder<HabitLog> b) => b.HasTenantForeignKeyRestrict();
}

public sealed class TransformationJournalConfiguration : IEntityTypeConfiguration<TransformationJournal>
{
    public void Configure(EntityTypeBuilder<TransformationJournal> b) => b.HasTenantForeignKeyRestrict();
}

public sealed class ClientAssessmentConfiguration : IEntityTypeConfiguration<ClientAssessment>
{
    public void Configure(EntityTypeBuilder<ClientAssessment> b)
    {
        b.Property(e => e.Score).HasPrecision(10, 4);
        b.HasTenantForeignKeyRestrict();
    }
}

// ── CRM / engagement ─────────────────────────────────────────────────────────

public sealed class LeadConfiguration : IEntityTypeConfiguration<Lead>
{
    public void Configure(EntityTypeBuilder<Lead> b)
    {
        b.HasOne(l => l.Tenant).WithMany().HasForeignKey(l => l.TenantId).OnDelete(DeleteBehavior.Restrict);
        b.Property(e => e.ConversionProb).HasPrecision(10, 4);
    }
}

public sealed class LeadActivityConfiguration : IEntityTypeConfiguration<LeadActivity>
{
    public void Configure(EntityTypeBuilder<LeadActivity> b) => b.HasTenantForeignKeyRestrict();
}

public sealed class ChallengeConfiguration : IEntityTypeConfiguration<Challenge>
{
    public void Configure(EntityTypeBuilder<Challenge> b) =>
        b.Property(e => e.TargetValue).HasPrecision(18, 4);
}

public sealed class ChallengeParticipantConfiguration : IEntityTypeConfiguration<ChallengeParticipant>
{
    public void Configure(EntityTypeBuilder<ChallengeParticipant> b)
    {
        b.Property(e => e.Progress).HasPrecision(18, 4);
        b.HasTenantForeignKeyRestrict();
    }
}

// ── Communication ────────────────────────────────────────────────────────────

public sealed class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> b)
    {
        b.HasOne(n => n.Tenant).WithMany().HasForeignKey(n => n.TenantId).OnDelete(DeleteBehavior.Restrict);
        // ARCH-088: a user's unread notifications.
        b.HasIndex(n => new { n.UserId, n.ReadAt });
    }
}

public sealed class CommunicationLogConfiguration : IEntityTypeConfiguration<CommunicationLog>
{
    public void Configure(EntityTypeBuilder<CommunicationLog> b)
    {
        b.Property(e => e.Cost).HasPrecision(18, 6);
        // ARCH-003/046: outbox lookups (queued emails, reminder dedupe key in ProviderRef).
        b.HasIndex(l => new { l.Status, l.Channel, l.CreatedAt });
        b.HasIndex(l => new { l.TenantId, l.ProviderRef });
    }
}

// ── Platform ─────────────────────────────────────────────────────────────────

public sealed class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> b) =>
        b.HasOne<Tenant>().WithMany().HasForeignKey(a => a.TenantId).OnDelete(DeleteBehavior.SetNull);
}

public sealed class OnboardingStepConfiguration : IEntityTypeConfiguration<OnboardingStep>
{
    public void Configure(EntityTypeBuilder<OnboardingStep> b)
    {
        b.HasOne(s => s.User).WithMany().HasForeignKey(s => s.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(s => new { s.UserId, s.StepKey }).IsUnique();
    }
}

public sealed class RatingConfiguration : IEntityTypeConfiguration<Rating>
{
    public void Configure(EntityTypeBuilder<Rating> b) =>
        b.HasOne(r => r.Tenant).WithMany().HasForeignKey(r => r.TenantId).OnDelete(DeleteBehavior.Restrict);
}

public sealed class MediaLibraryConfiguration : IEntityTypeConfiguration<MediaLibrary>
{
    public void Configure(EntityTypeBuilder<MediaLibrary> b) =>
        b.HasOne(m => m.Tenant).WithMany().HasForeignKey(m => m.TenantId).OnDelete(DeleteBehavior.Restrict);
}
