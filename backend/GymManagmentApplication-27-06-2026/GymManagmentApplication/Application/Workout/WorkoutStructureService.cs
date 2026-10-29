using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Training;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Workout;

// ── DTOs ────────────────────────────────────────────────────────────────────
public class WorkoutStructureDto
{
    public ulong WorkoutId { get; set; }
    public string? WorkoutName { get; set; }
    public List<SectionDto> Sections { get; set; } = [];
}

public class SectionDto
{
    public string? Name { get; set; }
    /// <summary>warmup | main | cooldown | circuit | superset …  (SectionType names, case-insensitive)</summary>
    public string Type { get; set; } = "Main";
    public byte Rounds { get; set; } = 1;
    public ushort? RestSeconds { get; set; }
    public List<SectionExerciseDto> Exercises { get; set; } = [];
}

public class SectionExerciseDto
{
    public ulong ExerciseId { get; set; }
    public string? ExerciseName { get; set; }
    public byte? Sets { get; set; }
    /// <summary>"10", "8-12", "AMRAP"…</summary>
    public string? Reps { get; set; }
    public short? DurationSeconds { get; set; }
    public short? RestSeconds { get; set; }
    public string? Tempo { get; set; }
    public string? WeightSuggestion { get; set; }
    public string? Notes { get; set; }
}

public class PlanScheduleDto
{
    public ulong PlanId { get; set; }
    public string? PlanName { get; set; }
    public byte DurationWeeks { get; set; }
    public List<PlanWeekDto> Weeks { get; set; } = [];
}

public class PlanWeekDto
{
    public byte WeekNumber { get; set; }
    public string? Notes { get; set; }
    public List<PlanDayDto> Days { get; set; } = [];
}

public class PlanDayDto
{
    /// <summary>1 = first day of the week … 7.</summary>
    public byte DayNumber { get; set; }
    public ulong? WorkoutId { get; set; }
    public string? WorkoutName { get; set; }
    public bool IsRestDay { get; set; }
}

public class MyAssignmentsDto
{
    public List<AssignedWorkoutDto> Workouts { get; set; } = [];
    public List<AssignedPlanDto> Plans { get; set; } = [];
}

public class AssignedWorkoutDto
{
    public ulong AssignmentId { get; set; }
    public ulong WorkoutId { get; set; }
    public string WorkoutName { get; set; } = default!;
    public string? TrainerName { get; set; }
    public DateOnly AssignedAt { get; set; }
    public DateOnly? DueDate { get; set; }
    public string Status { get; set; } = default!;
    public string? Notes { get; set; }
}

public class AssignedPlanDto
{
    public ulong AssignmentId { get; set; }
    public ulong PlanId { get; set; }
    public string PlanName { get; set; } = default!;
    public byte DurationWeeks { get; set; }
    public DateOnly StartDate { get; set; }
    public string Status { get; set; } = default!;
    /// <summary>Position in the plan today (null before it starts / after it ends).</summary>
    public byte? CurrentWeek { get; set; }
    public byte? CurrentDay { get; set; }
    public ulong? TodayWorkoutId { get; set; }
    public string? TodayWorkoutName { get; set; }
    public bool TodayIsRest { get; set; }
}

/// <summary>
/// Workout contents (sections → exercises with sets/reps), a plan's week-by-week schedule of
/// workouts, and the signed-in member's assigned workouts/plans with "today's workout".
/// </summary>
public class WorkoutStructureService(AppDbContext db, ICurrentUser currentUser)
{
    private const int MaxSections = 20;
    private const int MaxExercisesPerSection = 40;

    public async Task<WorkoutStructureDto> GetStructureAsync(ulong workoutId)
    {
        var w = await db.WorkoutTemplates.FirstOrDefaultAsync(x => x.Id == workoutId) ?? throw new KeyNotFoundException("Workout not found.");
        var sections = await db.WorkoutSections.Where(s => s.TemplateId == workoutId).OrderBy(s => s.SortOrder).ToListAsync();
        var sectionIds = sections.Select(s => s.Id).ToList();
        var exercises = await db.WorkoutExercises.Include(e => e.Exercise)
            .Where(e => sectionIds.Contains(e.SectionId)).OrderBy(e => e.SortOrder).ToListAsync();
        return new WorkoutStructureDto
        {
            WorkoutId = w.Id, WorkoutName = w.Name,
            Sections = sections.Select(s => new SectionDto
            {
                Name = s.Name, Type = s.Type.ToString(), Rounds = s.Rounds, RestSeconds = s.RestSeconds,
                Exercises = exercises.Where(e => e.SectionId == s.Id).Select(e => new SectionExerciseDto
                {
                    ExerciseId = e.ExerciseId, ExerciseName = e.Exercise?.Name, Sets = e.Sets, Reps = e.Reps,
                    DurationSeconds = e.DurationSeconds, RestSeconds = e.RestSeconds, Tempo = e.Tempo,
                    WeightSuggestion = e.WeightSuggestion, Notes = e.Notes,
                }).ToList(),
            }).ToList(),
        };
    }

    /// <summary>Replaces the workout's sections and exercises.</summary>
    public async Task<WorkoutStructureDto> SaveStructureAsync(ulong workoutId, WorkoutStructureDto request)
    {
        var w = await db.WorkoutTemplates.FirstOrDefaultAsync(x => x.Id == workoutId) ?? throw new KeyNotFoundException("Workout not found.");
        if (currentUser.IsClient()) throw new UnauthorizedAccessException("Only trainers and staff can edit workouts.");
        if (currentUser.IsTrainer() && w.CreatedBy != currentUser.UserId)
            throw new UnauthorizedAccessException("You can only edit workouts you created.");
        if (request.Sections.Count > MaxSections) throw new ArgumentException($"At most {MaxSections} sections.");
        if (request.Sections.Any(s => s.Exercises.Count > MaxExercisesPerSection))
            throw new ArgumentException($"At most {MaxExercisesPerSection} exercises per section.");

        var ids = request.Sections.SelectMany(s => s.Exercises).Select(e => e.ExerciseId).Distinct().ToList();
        var known = await db.Exercises.Where(e => ids.Contains(e.Id)).Select(e => e.Id).ToListAsync(); // tenant + shared library
        if (ids.Except(known).FirstOrDefault() is var missing and > 0)
            throw new ArgumentException($"Exercise {missing} isn't in this gym's library.");

        await using var tx = await db.Database.BeginTransactionAsync();
        var oldSections = await db.WorkoutSections.Where(s => s.TemplateId == workoutId).Select(s => s.Id).ToListAsync();
        await db.WorkoutExercises.Where(e => oldSections.Contains(e.SectionId)).ExecuteDeleteAsync();
        await db.WorkoutSections.Where(s => s.TemplateId == workoutId).ExecuteDeleteAsync();

        byte order = 0;
        foreach (var s in request.Sections)
        {
            var section = new WorkoutSection
            {
                TemplateId = workoutId, Name = s.Name?.Trim(), SortOrder = order++,
                Type = Enum.TryParse<SectionType>(s.Type, true, out var t) ? t : SectionType.Main,
                Rounds = Math.Max((byte)1, s.Rounds), RestSeconds = s.RestSeconds,
            };
            db.WorkoutSections.Add(section);
            await db.SaveChangesAsync();
            byte eo = 0;
            foreach (var e in s.Exercises)
            {
                if (e.Sets is 0 || (e.Reps is null && e.DurationSeconds is null))
                    throw new ArgumentException("Every exercise needs reps or a duration.");
                db.WorkoutExercises.Add(new WorkoutExercise
                {
                    SectionId = section.Id, ExerciseId = e.ExerciseId, SortOrder = eo++, Sets = e.Sets,
                    Reps = e.Reps?.Trim(), DurationSeconds = e.DurationSeconds, RestSeconds = e.RestSeconds,
                    Tempo = e.Tempo?.Trim(), WeightSuggestion = e.WeightSuggestion?.Trim(), Notes = e.Notes?.Trim(),
                });
            }
        }
        w.Version++;
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return await GetStructureAsync(workoutId);
    }

    public async Task<PlanScheduleDto> GetScheduleAsync(ulong planId)
    {
        var p = await db.WorkoutPlans.FirstOrDefaultAsync(x => x.Id == planId) ?? throw new KeyNotFoundException("Plan not found.");
        var weeks = await db.WorkoutPlanWeeks.Where(w => w.PlanId == planId).OrderBy(w => w.WeekNumber).ToListAsync();
        var weekIds = weeks.Select(w => w.Id).ToList();
        var days = await db.WorkoutPlanDays.Include(d => d.Template).Where(d => weekIds.Contains(d.WeekId)).OrderBy(d => d.DayNumber).ToListAsync();
        return new PlanScheduleDto
        {
            PlanId = p.Id, PlanName = p.Name, DurationWeeks = p.DurationWeeks,
            Weeks = weeks.Select(w => new PlanWeekDto
            {
                WeekNumber = w.WeekNumber, Notes = w.Notes,
                Days = days.Where(d => d.WeekId == w.Id).Select(d => new PlanDayDto
                {
                    DayNumber = d.DayNumber, IsRestDay = d.IsRestDay, WorkoutId = d.TemplateId, WorkoutName = d.Template?.Name,
                }).ToList(),
            }).ToList(),
        };
    }

    /// <summary>Replaces the plan's week/day schedule. Days without a workout are rest days.</summary>
    public async Task<PlanScheduleDto> SaveScheduleAsync(ulong planId, PlanScheduleDto request)
    {
        var p = await db.WorkoutPlans.FirstOrDefaultAsync(x => x.Id == planId) ?? throw new KeyNotFoundException("Plan not found.");
        if (currentUser.IsClient()) throw new UnauthorizedAccessException("Only trainers and staff can edit plans.");
        if (currentUser.IsTrainer() && p.CreatedBy != currentUser.UserId)
            throw new UnauthorizedAccessException("You can only edit plans you created.");
        if (request.Weeks.Any(w => w.WeekNumber < 1 || w.WeekNumber > p.DurationWeeks))
            throw new ArgumentException($"Weeks must be between 1 and {p.DurationWeeks}.");
        if (request.Weeks.SelectMany(w => w.Days).Any(d => d.DayNumber is < 1 or > 7))
            throw new ArgumentException("Days must be between 1 and 7.");
        var workoutIds = request.Weeks.SelectMany(w => w.Days).Where(d => d.WorkoutId is > 0).Select(d => d.WorkoutId!.Value).Distinct().ToList();
        var known = await db.WorkoutTemplates.Where(w => workoutIds.Contains(w.Id)).Select(w => w.Id).ToListAsync();
        if (workoutIds.Except(known).FirstOrDefault() is var missing and > 0)
            throw new ArgumentException($"Workout {missing} isn't in this gym.");

        await using var tx = await db.Database.BeginTransactionAsync();
        var oldWeeks = await db.WorkoutPlanWeeks.Where(w => w.PlanId == planId).Select(w => w.Id).ToListAsync();
        await db.WorkoutPlanDays.Where(d => oldWeeks.Contains(d.WeekId)).ExecuteDeleteAsync();
        await db.WorkoutPlanWeeks.Where(w => w.PlanId == planId).ExecuteDeleteAsync();
        foreach (var w in request.Weeks.GroupBy(w => w.WeekNumber).Select(g => g.First()).OrderBy(w => w.WeekNumber))
        {
            var week = new WorkoutPlanWeek { PlanId = planId, WeekNumber = w.WeekNumber, Notes = w.Notes?.Trim() };
            db.WorkoutPlanWeeks.Add(week);
            await db.SaveChangesAsync();
            foreach (var d in w.Days.GroupBy(d => d.DayNumber).Select(g => g.First()))
                db.WorkoutPlanDays.Add(new WorkoutPlanDay
                {
                    WeekId = week.Id, DayNumber = d.DayNumber,
                    TemplateId = d.WorkoutId is > 0 ? d.WorkoutId : null,
                    IsRestDay = d.IsRestDay || d.WorkoutId is null or 0,
                });
        }
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return await GetScheduleAsync(planId);
    }

    public async Task<MyAssignmentsDto> GetMyAssignmentsAsync()
    {
        var me = currentUser.UserId ?? throw new UnauthorizedAccessException("Please sign in again.");
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var workouts = await db.WorkoutAssignments.Include(a => a.Template).Include(a => a.Trainer)
            .Where(a => a.ClientId == me).OrderByDescending(a => a.AssignedAt).Take(50).ToListAsync();
        var plans = await db.WorkoutPlanAssignments.Include(a => a.Plan)
            .Where(a => a.ClientId == me).OrderByDescending(a => a.StartDate).Take(20).ToListAsync();

        var result = new MyAssignmentsDto
        {
            Workouts = workouts.Select(a => new AssignedWorkoutDto
            {
                AssignmentId = a.Id, WorkoutId = a.TemplateId, WorkoutName = a.Template.Name,
                TrainerName = a.Trainer?.DisplayName, AssignedAt = a.AssignedAt, DueDate = a.DueDate,
                Status = a.Status.ToString(), Notes = a.Notes,
            }).ToList(),
        };

        foreach (var a in plans)
        {
            var dto = new AssignedPlanDto
            {
                AssignmentId = a.Id, PlanId = a.PlanId, PlanName = a.Plan.Name, DurationWeeks = a.Plan.DurationWeeks,
                StartDate = a.StartDate, Status = a.Status.ToString(),
            };
            var dayIndex = today.DayNumber - a.StartDate.DayNumber;
            if (dayIndex >= 0 && dayIndex < a.Plan.DurationWeeks * 7)
            {
                dto.CurrentWeek = (byte)(dayIndex / 7 + 1);
                dto.CurrentDay = (byte)(dayIndex % 7 + 1);
                var day = await db.WorkoutPlanDays.Include(d => d.Template).Include(d => d.Week)
                    .FirstOrDefaultAsync(d => d.Week.PlanId == a.PlanId && d.Week.WeekNumber == dto.CurrentWeek && d.DayNumber == dto.CurrentDay);
                dto.TodayWorkoutId = day?.TemplateId;
                dto.TodayWorkoutName = day?.Template?.Name;
                dto.TodayIsRest = day is null || day.IsRestDay;
            }
            result.Plans.Add(dto);
        }
        return result;
    }
}
