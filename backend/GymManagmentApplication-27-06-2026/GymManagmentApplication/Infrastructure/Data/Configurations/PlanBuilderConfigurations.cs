using GymManagmentApplication.Domain.Entities.Core;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Entities.Training;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymManagmentApplication.Infrastructure.Data.Configurations;

// Weekly plan builder (migration WeeklyPlanBuilder): plan days with their own workout, per-set
// targets, logged sets, personal records and skip/move overrides.
// IsTemplate's "true for existing plans" is a migration-only column default: the model has no
// store default, so EF always writes the CLR value (a bool default of true would make EF skip
// inserting false).

public sealed class WorkoutPlanDayConfiguration : IEntityTypeConfiguration<WorkoutPlanDay>
{
    public void Configure(EntityTypeBuilder<WorkoutPlanDay> b)
    {
        b.Property(d => d.Title).HasMaxLength(100);
        b.Property(d => d.Notes).HasMaxLength(2000);
    }
}

public sealed class WorkoutSetLogConfiguration : IEntityTypeConfiguration<WorkoutSetLog>
{
    public void Configure(EntityTypeBuilder<WorkoutSetLog> b)
    {
        b.HasOne<Tenant>().WithMany().HasForeignKey(s => s.TenantId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(s => s.WorkoutLog).WithMany(l => l.Sets).HasForeignKey(s => s.WorkoutLogId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<User>().WithMany().HasForeignKey(s => s.ClientId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(s => s.Exercise).WithMany().HasForeignKey(s => s.ExerciseId).OnDelete(DeleteBehavior.Restrict);
        // Workout rows are replaced on every structure save; the logged set stays.
        b.HasOne<WorkoutExercise>().WithMany().HasForeignKey(s => s.WorkoutExerciseId).OnDelete(DeleteBehavior.SetNull);
        b.Property(s => s.WeightKg).HasPrecision(7, 2);
        b.Property(s => s.Rpe).HasPrecision(3, 1);
        b.Property(s => s.DistanceM).HasPrecision(9, 2);
        b.HasIndex(s => new { s.ClientId, s.ExerciseId, s.PerformedAt });
    }
}

public sealed class PersonalRecordConfiguration : IEntityTypeConfiguration<PersonalRecord>
{
    public void Configure(EntityTypeBuilder<PersonalRecord> b)
    {
        b.HasOne<Tenant>().WithMany().HasForeignKey(r => r.TenantId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(r => r.ClientId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(r => r.Exercise).WithMany().HasForeignKey(r => r.ExerciseId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<WorkoutSetLog>().WithMany().HasForeignKey(r => r.WorkoutSetLogId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne<WorkoutLog>().WithMany().HasForeignKey(r => r.WorkoutLogId).OnDelete(DeleteBehavior.SetNull);
        b.Property(r => r.Value).HasPrecision(10, 2);
        b.Property(r => r.WeightKg).HasPrecision(7, 2);
        b.HasIndex(r => new { r.ClientId, r.ExerciseId, r.Type }).IsUnique();
    }
}

public sealed class PlanDayOverrideConfiguration : IEntityTypeConfiguration<PlanDayOverride>
{
    public void Configure(EntityTypeBuilder<PlanDayOverride> b)
    {
        b.HasOne<Tenant>().WithMany().HasForeignKey(o => o.TenantId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(o => o.PlanAssignment).WithMany().HasForeignKey(o => o.PlanAssignmentId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<User>().WithMany().HasForeignKey(o => o.ByUserId).OnDelete(DeleteBehavior.SetNull);
        b.HasIndex(o => new { o.PlanAssignmentId, o.Date }).IsUnique();
    }
}
