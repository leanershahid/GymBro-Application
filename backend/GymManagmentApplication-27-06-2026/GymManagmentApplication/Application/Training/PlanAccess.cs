using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Training;
using GymManagmentApplication.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Plan = GymManagmentApplication.Domain.Entities.Training.WorkoutPlan;

namespace GymManagmentApplication.Application.Training;

/// <summary>
/// Who may see or change plans and workouts (on top of the tenant query filter):
/// <list type="bullet">
///   <item>admin / staff — any plan or workout of their gym</item>
///   <item>trainer — edits plans they created and the plan copies of clients assigned to them; library workouts they created</item>
///   <item>member — reads plans assigned to them and workouts that are public, assigned, in their plan, or already logged</item>
/// </list>
/// </summary>
public static class PlanAccess
{
    public static readonly AssignmentStatus[] OpenStatuses = [AssignmentStatus.Assigned, AssignmentStatus.InProgress];

    public static Task<bool> MemberIsAssignedAsync(IAppDbContext db, ulong memberId, ulong planId) =>
        db.WorkoutPlanAssignments.AnyAsync(a => a.PlanId == planId && a.ClientId == memberId);

    public static async Task<bool> CanEditAsync(IAppDbContext db, ICurrentUser me, Plan plan)
    {
        if (me.IsClient()) return false;
        if (!me.IsTrainer()) return true;
        if (plan.CreatedBy == me.UserId) return true;
        return plan.OwnerClientId is { } client
               && await db.AssignedClientIds(me.UserId ?? 0).AnyAsync(id => id == client);
    }

    public static async Task EnsureCanEditAsync(IAppDbContext db, ICurrentUser me, Plan plan)
    {
        if (me.IsClient()) throw new UnauthorizedAccessException("Only trainers and staff can edit plans.");
        if (!await CanEditAsync(db, me, plan))
            throw new UnauthorizedAccessException("You can only edit plans you created or your own clients' plans.");
    }

    /// <summary>Members: only plans assigned to them (404 otherwise). Trainers: masters, plus copies they may edit.</summary>
    public static async Task EnsureCanViewAsync(IAppDbContext db, ICurrentUser me, Plan plan)
    {
        if (me.IsClient())
        {
            if (!await MemberIsAssignedAsync(db, me.UserId ?? 0, plan.Id)) throw new KeyNotFoundException("Plan not found.");
            return;
        }
        if (me.IsTrainer() && !plan.IsTemplate && !await CanEditAsync(db, me, plan))
            throw new UnauthorizedAccessException("This plan belongs to a member who isn't assigned to you.");
    }

    /// <summary>
    /// A member sees a workout when it is a public library workout, assigned to them, part of a plan
    /// assigned to them, or one they have logged before.
    /// </summary>
    public static async Task<bool> MemberCanSeeWorkoutAsync(IAppDbContext db, ulong memberId, ulong workoutId)
    {
        if (await db.WorkoutTemplates.AnyAsync(w => w.Id == workoutId && w.IsPublic && w.OwnerPlanDayId == null)) return true;
        if (await db.WorkoutAssignments.AnyAsync(a => a.TemplateId == workoutId && a.ClientId == memberId)) return true;
        if (await db.WorkoutPlanDays.AnyAsync(d => d.TemplateId == workoutId &&
                db.WorkoutPlanAssignments.Any(a => a.PlanId == d.Week.PlanId && a.ClientId == memberId))) return true;
        return await db.WorkoutLogs.AnyAsync(l => l.TemplateId == workoutId && l.ClientId == memberId);
    }

    /// <summary>The plan a day workout belongs to (null for library workouts or orphaned day workouts).</summary>
    public static async Task<Plan?> OwningPlanAsync(IAppDbContext db, WorkoutTemplate workout)
    {
        if (workout.OwnerPlanDayId is not { } dayId) return null;
        var planId = await db.WorkoutPlanDays.Where(d => d.Id == dayId).Select(d => (ulong?)d.Week.PlanId).FirstOrDefaultAsync();
        return planId is null ? null : await db.WorkoutPlans.FirstOrDefaultAsync(p => p.Id == planId);
    }

    /// <summary>Structure edits: a day workout follows its plan's rules; a library workout its creator's.</summary>
    public static async Task EnsureCanEditWorkoutAsync(IAppDbContext db, ICurrentUser me, WorkoutTemplate workout)
    {
        if (me.IsClient()) throw new UnauthorizedAccessException("Only trainers and staff can edit workouts.");
        if (await OwningPlanAsync(db, workout) is { } plan)
        {
            await EnsureCanEditAsync(db, me, plan);
            return;
        }
        if (me.IsTrainer() && workout.CreatedBy != me.UserId)
            throw new UnauthorizedAccessException("You can only edit workouts you created.");
    }
}

/// <summary>Set types as the API spells them.</summary>
public static class SetTypes
{
    public static bool TryParse(string? value, out SetType type)
    {
        type = SetType.Normal;
        if (string.IsNullOrWhiteSpace(value)) return true;
        return Enum.TryParse(value.Trim(), true, out type) && Enum.IsDefined(type);
    }

    public static string Name(SetType t) => t.ToString().ToLowerInvariant();
}

/// <summary>Record types as the API spells them.</summary>
public static class RecordTypes
{
    public static string Name(PersonalRecordType t) => t switch
    {
        PersonalRecordType.HeaviestWeight => "heaviestWeight",
        PersonalRecordType.EstimatedOneRepMax => "estimatedOneRepMax",
        PersonalRecordType.MostReps => "mostReps",
        _ => "bestSetVolume",
    };
}
