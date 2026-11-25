using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Training;
using Microsoft.EntityFrameworkCore;
using Plan = GymManagmentApplication.Domain.Entities.Training.WorkoutPlan;

namespace GymManagmentApplication.Application.Training;

/// <summary>A read-only (untracked) copy of a plan with its days and every day workout's structure.</summary>
public sealed class PlanSnapshot
{
    public Plan Plan { get; init; } = default!;
    public List<WorkoutPlanWeek> Weeks { get; init; } = [];
    public List<WorkoutPlanDay> Days { get; init; } = [];
    public Dictionary<ulong, WorkoutTemplate> Workouts { get; init; } = [];

    public IEnumerable<WorkoutPlanDay> DaysOf(byte week) =>
        Days.Where(d => Weeks.Any(w => w.Id == d.WeekId && w.WeekNumber == week)).OrderBy(d => d.DayNumber);
}

/// <summary>
/// Deep copies. Every copy gets new rows for weeks, days, workouts, sections and exercises, so editing
/// a copy never changes the source (and vice versa). New ids are known as soon as a row is added
/// (HiLo on Postgres), so one SaveChanges stores a whole copy.
/// </summary>
public static class PlanCopy
{
    public static async Task<PlanSnapshot> LoadAsync(IAppDbContext db, Plan plan)
    {
        var weeks = await db.WorkoutPlanWeeks.AsNoTracking().Where(w => w.PlanId == plan.Id && w.WeekNumber >= 1 && w.WeekNumber <= plan.DurationWeeks)
            .OrderBy(w => w.WeekNumber).ToListAsync();
        var weekIds = weeks.Select(w => w.Id).ToList();
        var days = await db.WorkoutPlanDays.AsNoTracking().Where(d => weekIds.Contains(d.WeekId) && d.DayNumber >= 1 && d.DayNumber <= 7)
            .OrderBy(d => d.DayNumber).ToListAsync();
        var workoutIds = days.Where(d => d.TemplateId != null).Select(d => d.TemplateId!.Value).Distinct().ToList();
        return new PlanSnapshot { Plan = plan, Weeks = weeks, Days = days, Workouts = await LoadWorkoutsAsync(db, workoutIds) };
    }

    /// <summary>Workouts with sections and exercises, untracked.</summary>
    public static async Task<Dictionary<ulong, WorkoutTemplate>> LoadWorkoutsAsync(IAppDbContext db, ICollection<ulong> ids)
    {
        if (ids.Count == 0) return [];
        var workouts = await db.WorkoutTemplates.AsNoTracking().Where(w => ids.Contains(w.Id))
            .Include(w => w.Sections).ThenInclude(s => s.Exercises).AsSplitQuery().ToListAsync();
        return workouts.ToDictionary(w => w.Id);
    }

    /// <summary>Adds a new plan (weeks, days, day workouts) copied from the snapshot.</summary>
    public static Plan AddPlanCopy(IAppDbContext db, PlanSnapshot src, ulong createdBy, Action<Plan>? customize = null)
    {
        var s = src.Plan;
        var copy = new Plan
        {
            TenantId = s.TenantId, CreatedBy = createdBy, Name = s.Name, Description = s.Description,
            DurationWeeks = s.DurationWeeks, Goal = s.Goal, Difficulty = s.Difficulty, IsActive = true, Tags = s.Tags,
            DaysPerWeekHint = s.DaysPerWeekHint, IsTemplate = true, SourcePlanId = s.Id,
        };
        customize?.Invoke(copy);
        db.WorkoutPlans.Add(copy);
        foreach (var w in src.Weeks)
        {
            var week = new WorkoutPlanWeek { Plan = copy, WeekNumber = w.WeekNumber, Notes = w.Notes };
            db.WorkoutPlanWeeks.Add(week);
            foreach (var d in src.DaysOf(w.WeekNumber))
                AddDayCopy(db, src.Workouts, week, d.DayNumber, d, copy.TenantId, createdBy);
        }
        return copy;
    }

    /// <summary>Adds a new day to <paramref name="week"/> holding a copy of <paramref name="source"/> (title, notes, rest flag, workout).</summary>
    public static WorkoutPlanDay AddDayCopy(IAppDbContext db, IReadOnlyDictionary<ulong, WorkoutTemplate> workouts, WorkoutPlanWeek week,
        byte dayNumber, WorkoutPlanDay source, ulong tenantId, ulong createdBy)
    {
        var day = new WorkoutPlanDay { Week = week, DayNumber = dayNumber };
        db.WorkoutPlanDays.Add(day);
        CopyDayContent(db, workouts, source, day, tenantId, createdBy);
        return day;
    }

    /// <summary>Overwrites <paramref name="target"/>'s title, notes, rest flag and workout with a copy of the source day's.</summary>
    public static void CopyDayContent(IAppDbContext db, IReadOnlyDictionary<ulong, WorkoutTemplate> workouts, WorkoutPlanDay source,
        WorkoutPlanDay target, ulong tenantId, ulong createdBy)
    {
        target.Title = source.Title;
        target.Notes = source.Notes;
        target.IsRestDay = source.IsRestDay;
        if (source.TemplateId is { } wid && workouts.TryGetValue(wid, out var w))
        {
            var copy = AddWorkoutCopy(db, w, tenantId, createdBy, ownerPlanDayId: target.Id);
            target.Template = copy;
            target.TemplateId = copy.Id;
        }
        else
        {
            target.Template = null;
            target.TemplateId = null;
        }
    }

    /// <summary>Adds a new workout with a copy of the source's sections and exercises.</summary>
    public static WorkoutTemplate AddWorkoutCopy(IAppDbContext db, WorkoutTemplate src, ulong tenantId, ulong createdBy, ulong? ownerPlanDayId, string? name = null)
    {
        var copy = new WorkoutTemplate
        {
            TenantId = tenantId, CreatedBy = createdBy, Name = name ?? src.Name, Description = src.Description, Category = src.Category,
            Goal = src.Goal, Difficulty = src.Difficulty, DurationMin = src.DurationMin, IsPublic = false, Tags = src.Tags,
            OwnerPlanDayId = ownerPlanDayId,
        };
        db.WorkoutTemplates.Add(copy);
        AddSectionsCopy(db, src, copy, 0);
        return copy;
    }

    /// <summary>Adds copies of the source's sections (and exercises) to <paramref name="target"/>, numbered from <paramref name="firstSortOrder"/>.</summary>
    public static void AddSectionsCopy(IAppDbContext db, WorkoutTemplate src, WorkoutTemplate target, int firstSortOrder)
    {
        var order = firstSortOrder;
        foreach (var s in src.Sections.OrderBy(s => s.SortOrder))
        {
            var section = new WorkoutSection
            {
                Template = target, Name = s.Name, Type = s.Type, SortOrder = (byte)Math.Min(order++, 255), RestSeconds = s.RestSeconds, Rounds = s.Rounds,
            };
            db.WorkoutSections.Add(section);
            foreach (var e in s.Exercises.OrderBy(e => e.SortOrder))
                db.WorkoutExercises.Add(new WorkoutExercise
                {
                    Section = section, ExerciseId = e.ExerciseId, SortOrder = e.SortOrder, Sets = e.Sets, Reps = e.Reps,
                    DurationSeconds = e.DurationSeconds, RestSeconds = e.RestSeconds, Tempo = e.Tempo, WeightSuggestion = e.WeightSuggestion,
                    Intensity = e.Intensity, Notes = e.Notes, ConditionRules = e.ConditionRules, AiSubstitutionOk = e.AiSubstitutionOk,
                    SetTargets = e.SetTargets,
                });
        }
    }

    /// <summary>
    /// Deletes day workouts nothing points at any more (no plan day, assignment or log). Ones that
    /// were logged stay (hidden from the library) so history keeps its name and structure.
    /// </summary>
    public static async Task PurgeUnusedDayWorkoutsAsync(IAppDbContext db, IEnumerable<ulong> candidateIds)
    {
        var ids = candidateIds.Distinct().ToList();
        if (ids.Count == 0) return;
        var unused = await db.WorkoutTemplates
            .Where(w => ids.Contains(w.Id) && w.OwnerPlanDayId != null
                        && !db.WorkoutPlanDays.Any(d => d.TemplateId == w.Id)
                        && !db.WorkoutAssignments.Any(a => a.TemplateId == w.Id)
                        && !db.WorkoutLogs.Any(l => l.TemplateId == w.Id))
            .Select(w => w.Id).ToListAsync();
        if (unused.Count == 0) return;
        var sectionIds = await db.WorkoutSections.Where(s => unused.Contains(s.TemplateId)).Select(s => s.Id).ToListAsync();
        await db.WorkoutExercises.Where(e => sectionIds.Contains(e.SectionId)).ExecuteDeleteAsync();
        await db.WorkoutSections.Where(s => unused.Contains(s.TemplateId)).ExecuteDeleteAsync();
        await db.WorkoutBookmarks.Where(b => unused.Contains(b.WorkoutTemplateId)).ExecuteDeleteAsync();
        await db.WorkoutTemplates.Where(w => unused.Contains(w.Id)).ExecuteDeleteAsync();
    }
}
