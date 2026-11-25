using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Training;
using GymManagmentApplication.Domain.Enums;
using System.Text.Json;
using GymManagmentApplication.Application.Training;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Workout;

// ── DTOs ────────────────────────────────────────────────────────────────────
public class WorkoutStructureDto
{
    public ulong WorkoutId { get; set; }
    public string? WorkoutName { get; set; }
    /// <summary>Set when this is a plan day's own workout (read-only; ignored on save).</summary>
    public ulong? OwnerPlanDayId { get; set; }
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
    /// <summary>Row id (read-only; rows are replaced on every save). Send it back as sets[].workoutExerciseId when completing.</summary>
    public ulong? WorkoutExerciseId { get; set; }
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
    /// <summary>Optional per-set targets (max 20). When null, Sets/Reps/RestSeconds apply to every set.</summary>
    public List<SetTargetDto>? SetTargets { get; set; }
}

/// <summary>One prescribed set.</summary>
public class SetTargetDto
{
    public byte SetNo { get; set; }
    /// <summary>normal | warmup | drop | failure</summary>
    public string Type { get; set; } = "normal";
    public ushort? RepsMin { get; set; }
    public ushort? RepsMax { get; set; }
    public decimal? WeightKg { get; set; }
    public decimal? Rpe { get; set; }
    public int? DurationSec { get; set; }
    public decimal? DistanceM { get; set; }
    public short? RestSec { get; set; }
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
    /// <summary>Day title from the plan builder (null on older days).</summary>
    public string? Title { get; set; }
}

public class MyAssignmentsDto
{
    /// <summary>The member's one active plan assignment (in <see cref="Plans"/>), if any.</summary>
    public ulong? ActivePlanAssignmentId { get; set; }
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
    /// <summary>Today's day title ("Push"), falling back to the workout name. Skips/moves applied.</summary>
    public string? TodayTitle { get; set; }
    /// <summary>Plan position of today's workout (differs from CurrentWeek/Day when a day was moved onto today). Send with /complete.</summary>
    public byte? TodayWeekNumber { get; set; }
    public byte? TodayDayNumber { get; set; }
    public bool TodayDone { get; set; }
    public bool TodaySkipped { get; set; }
    public DateOnly EndDate { get; set; }
    /// <summary>Mon-Sun of the current week (empty for plans that are not active).</summary>
    public List<GymManagmentApplication.Application.Training.WeekStripDayDto> WeekStrip { get; set; } = [];
    public GymManagmentApplication.Application.Training.AdherenceDto? Adherence { get; set; }
}


/// <summary>
/// Workout contents: sections (blocks: single, superset, circuit…) → exercises with sets/reps and
/// optional per-set targets. Plan schedules live in <see cref="PlanBuilderService"/>, the member's
/// training in <see cref="MemberTrainingService"/>.
/// </summary>
public class WorkoutStructureService(IAppDbContext db, ICurrentUser currentUser)
{
    private const int MaxSections = 20;
    private const int MaxExercisesPerSection = 40;
    private const int MaxSetTargets = 20;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<WorkoutStructureDto> GetStructureAsync(ulong workoutId)
    {
        var w = await db.WorkoutTemplates.FirstOrDefaultAsync(x => x.Id == workoutId) ?? throw new KeyNotFoundException("Workout not found.");
        if (currentUser.IsClient() && !await PlanAccess.MemberCanSeeWorkoutAsync(db, currentUser.UserId ?? 0, workoutId))
            throw new KeyNotFoundException("Workout not found.");
        var sections = await db.WorkoutSections.AsNoTracking().Where(s => s.TemplateId == workoutId).OrderBy(s => s.SortOrder).ToListAsync();
        var sectionIds = sections.Select(s => s.Id).ToList();
        var exercises = await db.WorkoutExercises.AsNoTracking().Include(e => e.Exercise)
            .Where(e => sectionIds.Contains(e.SectionId)).OrderBy(e => e.SortOrder).ToListAsync();
        return new WorkoutStructureDto
        {
            WorkoutId = w.Id, WorkoutName = w.Name, OwnerPlanDayId = w.OwnerPlanDayId,
            Sections = sections.Select(s => new SectionDto
            {
                Name = s.Name, Type = s.Type.ToString(), Rounds = s.Rounds, RestSeconds = s.RestSeconds,
                Exercises = exercises.Where(e => e.SectionId == s.Id).Select(e => new SectionExerciseDto
                {
                    WorkoutExerciseId = e.Id, ExerciseId = e.ExerciseId, ExerciseName = e.Exercise?.Name, Sets = e.Sets, Reps = e.Reps,
                    DurationSeconds = e.DurationSeconds, RestSeconds = e.RestSeconds, Tempo = e.Tempo,
                    WeightSuggestion = e.WeightSuggestion, Notes = e.Notes, SetTargets = ReadTargets(e.SetTargets),
                }).ToList(),
            }).ToList(),
        };
    }

    private static List<SetTargetDto>? ReadTargets(JsonDocument? doc)
    {
        if (doc is null || doc.RootElement.ValueKind != JsonValueKind.Array) return null;
        try { return doc.RootElement.Deserialize<List<SetTargetDto>>(Json); }
        catch (JsonException) { return null; }
    }

    /// <summary>Checks and normalises per-set targets (numbered 1…n in order).</summary>
    private static List<SetTargetDto>? CheckTargets(List<SetTargetDto>? targets)
    {
        if (targets is null || targets.Count == 0) return null;
        if (targets.Count > MaxSetTargets) throw new ArgumentException($"At most {MaxSetTargets} sets per exercise.");
        byte n = 1;
        foreach (var t in targets)
        {
            if (!SetTypes.TryParse(t.Type, out var type)) throw new ArgumentException("Set type must be normal, warmup, drop or failure.");
            t.Type = SetTypes.Name(type);
            t.SetNo = n++;
            if (t.RepsMin > 1000 || t.RepsMax > 1000) throw new ArgumentException("Reps must be at most 1000.");
            if (t.RepsMin is { } min && t.RepsMax is { } max && min > max) throw new ArgumentException("Minimum reps can't be more than maximum reps.");
            if (t.WeightKg is < 0 or > 1000) throw new ArgumentException("Weight must be between 0 and 1000 kg.");
            if (t.Rpe is < 1 or > 10) throw new ArgumentException("RPE must be between 1 and 10.");
            if (t.DurationSec is < 0 or > 36000) throw new ArgumentException("Duration must be between 0 and 36000 seconds.");
            if (t.DistanceM is < 0 or > 100000) throw new ArgumentException("Distance must be between 0 and 100 km.");
            if (t.RestSec is < 0 or > 3600) throw new ArgumentException("Rest must be between 0 and 3600 seconds.");
        }
        return targets;
    }

    private static string? RepsFrom(SetTargetDto t) =>
        t.RepsMin is { } min && t.RepsMax is { } max && max != min ? $"{min}-{max}"
        : (t.RepsMax ?? t.RepsMin)?.ToString();

    /// <summary>Replaces the workout's sections and exercises (a plan day's workout follows the plan's edit rules).</summary>
    public async Task<WorkoutStructureDto> SaveStructureAsync(ulong workoutId, WorkoutStructureDto request)
    {
        var w = await db.WorkoutTemplates.FirstOrDefaultAsync(x => x.Id == workoutId) ?? throw new KeyNotFoundException("Workout not found.");
        await PlanAccess.EnsureCanEditWorkoutAsync(db, currentUser, w);
        if (request.Sections.Count > MaxSections) throw new ArgumentException($"At most {MaxSections} sections.");
        if (request.Sections.Any(s => s.Exercises.Count > MaxExercisesPerSection))
            throw new ArgumentException($"At most {MaxExercisesPerSection} exercises per section.");
        foreach (var e in request.Sections.SelectMany(s => s.Exercises))
        {
            e.SetTargets = CheckTargets(e.SetTargets);
            if (e.SetTargets is { } targets)
            {
                e.Sets ??= (byte)targets.Count;
                e.Reps ??= targets.Select(RepsFrom).FirstOrDefault(r => r is not null);
                e.DurationSeconds ??= (short?)targets.FirstOrDefault(t => t.DurationSec is > 0)?.DurationSec;
                e.RestSeconds ??= targets.FirstOrDefault(t => t.RestSec is not null)?.RestSec;
            }
            if (e.Sets is 0 || (e.Reps is null && e.DurationSeconds is null && e.SetTargets is null))
                throw new ArgumentException("Every exercise needs reps or a duration.");
            if (e.Sets > MaxSetTargets) throw new ArgumentException($"At most {MaxSetTargets} sets per exercise.");
        }

        var ids = request.Sections.SelectMany(s => s.Exercises).Select(e => e.ExerciseId).Distinct().ToList();
        var known = await db.Exercises.Where(e => ids.Contains(e.Id)).Select(e => e.Id).ToListAsync(); // tenant + shared library
        if (ids.Except(known).FirstOrDefault() is var missing and > 0)
            throw new ArgumentException($"Exercise {missing} isn't in this gym's library.");

        // Execution strategy + one transaction (ARCH-092).
        await db.InTransactionAsync(async () =>
        {
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
                byte eo = 0;
                foreach (var e in s.Exercises)
                    db.WorkoutExercises.Add(new WorkoutExercise
                    {
                        Section = section, ExerciseId = e.ExerciseId, SortOrder = eo++, Sets = e.Sets,
                        Reps = e.Reps?.Trim(), DurationSeconds = e.DurationSeconds, RestSeconds = e.RestSeconds,
                        Tempo = e.Tempo?.Trim(), WeightSuggestion = e.WeightSuggestion?.Trim(), Notes = e.Notes?.Trim(),
                        SetTargets = e.SetTargets is null ? null : JsonSerializer.SerializeToDocument(e.SetTargets, Json),
                    });
            }
            w.Version++;
            await db.SaveChangesAsync();
        });
        return await GetStructureAsync(workoutId);
    }
}
