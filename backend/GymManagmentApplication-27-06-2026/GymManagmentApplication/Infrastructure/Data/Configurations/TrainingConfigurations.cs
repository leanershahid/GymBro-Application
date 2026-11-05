using GymManagmentApplication.Domain.Entities.Core;
using GymManagmentApplication.Domain.Entities.Training;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymManagmentApplication.Infrastructure.Data.Configurations;

// Exercises, workouts, workout plans, trainers and PT sessions.
// Several Client/Tenant relations are RESTRICT to prevent cascade-delete cycles.

public sealed class ExerciseConfiguration : IEntityTypeConfiguration<Exercise>
{
    public void Configure(EntityTypeBuilder<Exercise> b)
    {
        // Per-gym uniqueness: two gyms may each have a "squat" exercise.
        b.HasIndex(e => new { e.TenantId, e.Slug }).IsUnique();
        b.HasOne(w => w.Creator).WithMany().HasForeignKey(w => w.CreatedBy).OnDelete(DeleteBehavior.SetNull);
    }
}

public sealed class ExerciseMuscleConfiguration : IEntityTypeConfiguration<ExerciseMuscle>
{
    public void Configure(EntityTypeBuilder<ExerciseMuscle> b) =>
        b.HasKey(e => new { e.ExerciseId, e.MuscleId });
}

public sealed class ExerciseEquipmentConfiguration : IEntityTypeConfiguration<ExerciseEquipment>
{
    public void Configure(EntityTypeBuilder<ExerciseEquipment> b) =>
        b.HasKey(e => new { e.ExerciseId, e.EquipmentId });
}

public sealed class EquipmentConfiguration : IEntityTypeConfiguration<Equipment>
{
    public void Configure(EntityTypeBuilder<Equipment> b) =>
        b.HasOne<Tenant>().WithMany().HasForeignKey(e => e.TenantId).OnDelete(DeleteBehavior.Cascade);
}

// The Creator navigations must use the CreatedBy column the services fill in. Without this EF invents
// a separate CreatorId column that is always 0, so every insert failed its foreign key (HTTP 409).
public sealed class WorkoutTemplateConfiguration : IEntityTypeConfiguration<WorkoutTemplate>
{
    public void Configure(EntityTypeBuilder<WorkoutTemplate> b)
    {
        b.HasOne(w => w.Creator).WithMany().HasForeignKey(w => w.CreatedBy).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(w => w.Tenant).WithMany().HasForeignKey(w => w.TenantId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class WorkoutAssignmentConfiguration : IEntityTypeConfiguration<WorkoutAssignment>
{
    public void Configure(EntityTypeBuilder<WorkoutAssignment> b)
    {
        b.HasOne(wa => wa.Tenant).WithMany().HasForeignKey(wa => wa.TenantId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(wa => wa.Client).WithMany().HasForeignKey(wa => wa.ClientId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class WorkoutLogConfiguration : IEntityTypeConfiguration<WorkoutLog>
{
    public void Configure(EntityTypeBuilder<WorkoutLog> b)
    {
        // History survives branch removal.
        b.HasOne<Branch>().WithMany().HasForeignKey(l => l.BranchId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(l => l.Client).WithMany().HasForeignKey(l => l.ClientId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(l => l.Tenant).WithMany().HasForeignKey(l => l.TenantId).OnDelete(DeleteBehavior.Restrict);
        b.Property(e => e.Score).HasPrecision(10, 4);
    }
}

public sealed class WorkoutPlanConfiguration : IEntityTypeConfiguration<WorkoutPlan>
{
    public void Configure(EntityTypeBuilder<WorkoutPlan> b)
    {
        b.HasOne(w => w.Creator).WithMany().HasForeignKey(w => w.CreatedBy).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(w => w.Tenant).WithMany().HasForeignKey(w => w.TenantId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class WorkoutPlanBranchConfiguration : IEntityTypeConfiguration<WorkoutPlanBranch>
{
    public void Configure(EntityTypeBuilder<WorkoutPlanBranch> b) =>
        b.HasOne(x => x.NextPlan).WithMany().HasForeignKey(x => x.NextPlanId).OnDelete(DeleteBehavior.Restrict);
}

public sealed class WorkoutPlanAssignmentConfiguration : IEntityTypeConfiguration<WorkoutPlanAssignment>
{
    public void Configure(EntityTypeBuilder<WorkoutPlanAssignment> b)
    {
        b.HasOne(a => a.Client).WithMany().HasForeignKey(a => a.ClientId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(a => a.Tenant).WithMany().HasForeignKey(a => a.TenantId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class WorkoutAutomationRuleConfiguration : IEntityTypeConfiguration<WorkoutAutomationRule>
{
    public void Configure(EntityTypeBuilder<WorkoutAutomationRule> b) =>
        b.HasOne(w => w.Tenant).WithMany().HasForeignKey(w => w.TenantId).OnDelete(DeleteBehavior.Restrict);
}

public sealed class TrainerProfileConfiguration : IEntityTypeConfiguration<TrainerProfile>
{
    public void Configure(EntityTypeBuilder<TrainerProfile> b)
    {
        b.HasOne(t => t.Tenant).WithMany().HasForeignKey(t => t.TenantId).OnDelete(DeleteBehavior.Restrict);
        b.Property(e => e.Rating).HasPrecision(10, 4);
    }
}

public sealed class TrainerClientAssignmentConfiguration : IEntityTypeConfiguration<TrainerClientAssignment>
{
    public void Configure(EntityTypeBuilder<TrainerClientAssignment> b) =>
        b.HasOne(t => t.Tenant).WithMany().HasForeignKey(t => t.TenantId).OnDelete(DeleteBehavior.Restrict);
}

public sealed class PtSessionConfiguration : IEntityTypeConfiguration<PtSession>
{
    public void Configure(EntityTypeBuilder<PtSession> b)
    {
        // History survives branch removal.
        b.HasOne<Branch>().WithMany().HasForeignKey(p => p.BranchId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(p => p.Tenant).WithMany().HasForeignKey(p => p.TenantId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(p => p.Client).WithMany().HasForeignKey(p => p.ClientId).OnDelete(DeleteBehavior.Restrict);
        b.Property(e => e.Price).HasPrecision(18, 2);
    }
}

public sealed class PtSessionTypeConfiguration : IEntityTypeConfiguration<PtSessionType>
{
    public void Configure(EntityTypeBuilder<PtSessionType> b) =>
        b.Property(e => e.Price).HasPrecision(18, 2);
}

/// <summary>ARCH-026: bookmarks used to live in a static in-memory set.</summary>
public sealed class WorkoutBookmarkConfiguration : IEntityTypeConfiguration<WorkoutBookmark>
{
    public void Configure(EntityTypeBuilder<WorkoutBookmark> b)
    {
        b.HasIndex(x => new { x.UserId, x.WorkoutTemplateId }).IsUnique();
        b.HasOne<WorkoutTemplate>().WithMany().HasForeignKey(x => x.WorkoutTemplateId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<Domain.Entities.Identity.User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);
    }
}
