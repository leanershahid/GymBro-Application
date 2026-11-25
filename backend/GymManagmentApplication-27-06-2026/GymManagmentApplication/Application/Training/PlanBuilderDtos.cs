namespace GymManagmentApplication.Application.Training;

// ── Builder (GET /plans/{id}/builder) ────────────────────────────────────────

public class PlanBuilderDto
{
    public ulong PlanId { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string Goal { get; set; } = "";
    public string Difficulty { get; set; } = "";
    public byte DurationWeeks { get; set; }
    public byte? DaysPerWeekHint { get; set; }
    public bool IsTemplate { get; set; }
    public bool IsActive { get; set; }
    public ulong? SourcePlanId { get; set; }
    public ulong? OwnerClientId { get; set; }
    public string? OwnerClientName { get; set; }
    public ulong CreatedBy { get; set; }
    /// <summary>Whether the caller may change this plan.</summary>
    public bool CanEdit { get; set; }
    /// <summary>Set on a member's copy: the assignment it belongs to.</summary>
    public PlanMemberDto? ClientAssignment { get; set; }
    public List<BuilderWeekDto> Weeks { get; set; } = [];
}

public class BuilderWeekDto
{
    public byte WeekNumber { get; set; }
    public string? Notes { get; set; }
    /// <summary>Always 7 entries, day 1 … 7.</summary>
    public List<BuilderDayDto> Days { get; set; } = [];
}

public class BuilderDayDto
{
    /// <summary>Null until the day is first saved (PUT …/weeks/{w}/days/{d}).</summary>
    public ulong? DayId { get; set; }
    public byte WeekNumber { get; set; }
    public byte DayNumber { get; set; }
    public string? Title { get; set; }
    public string? Notes { get; set; }
    public bool IsRestDay { get; set; }
    /// <summary>The day's workout; edit it with PUT /workouts/{workoutId}/structure once <see cref="OwnsWorkout"/> is true.</summary>
    public ulong? WorkoutId { get; set; }
    public string? WorkoutName { get; set; }
    /// <summary>False for an older day still pointing at a shared library workout: call PUT day first (copy-on-write).</summary>
    public bool OwnsWorkout { get; set; }
    public int SectionCount { get; set; }
    public int ExerciseCount { get; set; }
    public List<string> ExerciseNames { get; set; } = [];
    public bool HasSuperset { get; set; }
    public int? EstimatedMinutes { get; set; }
}

// ── Requests ────────────────────────────────────────────────────────────────

public class UpsertPlanDayRequest
{
    public string? Title { get; set; }
    public string? Notes { get; set; }
    public bool IsRestDay { get; set; }
}

public class PlanDayRef
{
    public byte Week { get; set; }
    public byte Day { get; set; }
}

public class CopyDayRequest
{
    public List<PlanDayRef> Targets { get; set; } = [];
}

public class FromLibraryRequest
{
    public ulong WorkoutId { get; set; }
    /// <summary>Add the library workout's blocks after the day's existing ones instead of replacing them.</summary>
    public bool Append { get; set; }
}

public class AddWeekRequest
{
    /// <summary>Copy this week's days into the new week (blank when null).</summary>
    public byte? CopyFrom { get; set; }
}

public class CopyWeekRequest
{
    /// <summary>Target weeks; their days are replaced. Weeks past the end extend the plan (max 52).</summary>
    public List<byte> ToWeeks { get; set; } = [];
}

public class DuplicatePlanRequest
{
    public string? Name { get; set; }
}

public class DayOverrideRequest
{
    /// <summary>The calendar date the plan day is scheduled on.</summary>
    public DateOnly Date { get; set; }
    /// <summary>Move only: the date to train it instead.</summary>
    public DateOnly? ToDate { get; set; }
}

// ── Responses ───────────────────────────────────────────────────────────────

/// <summary>A member on a plan (assign result and GET /plans/{id}/members).</summary>
public class PlanMemberDto
{
    public ulong AssignmentId { get; set; }
    public ulong ClientId { get; set; }
    public string? ClientName { get; set; }
    /// <summary>The member's own copy of the plan.</summary>
    public ulong PlanId { get; set; }
    public string? PlanName { get; set; }
    public ulong? SourcePlanId { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string Status { get; set; } = "";
    public byte? CurrentWeek { get; set; }
    public byte? CurrentDay { get; set; }
    public AdherenceDto? Adherence { get; set; }
    public DateTime? LastWorkoutAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class PlanCalendarDto
{
    public ulong AssignmentId { get; set; }
    public ulong PlanId { get; set; }
    public string PlanName { get; set; } = "";
    public byte DurationWeeks { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string Status { get; set; } = "";
    public DateOnly From { get; set; }
    public DateOnly To { get; set; }
    public AdherenceDto Adherence { get; set; } = new();
    public List<CalendarEntryDto> Entries { get; set; } = [];
}

public class PlanDayOverrideDto
{
    public ulong Id { get; set; }
    public ulong AssignmentId { get; set; }
    public DateOnly Date { get; set; }
    /// <summary>skip | moved</summary>
    public string Action { get; set; } = "";
    public DateOnly? MovedToDate { get; set; }
}

/// <summary>Body of the 409 PLAN_ALREADY_ACTIVE answer (envelope <c>data</c>).</summary>
public class ActivePlanConflictDto
{
    public ulong ClientId { get; set; }
    public string? ClientName { get; set; }
    public ulong AssignmentId { get; set; }
    public string PlanName { get; set; } = "";
    public DateOnly StartDate { get; set; }
}
