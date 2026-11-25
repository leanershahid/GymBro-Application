using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Application.Workout.Requests;

public class WorkoutListRequest
{
    /// <summary>Set by the service for members (never from the request): IsPublic library workouts + ones assigned to them.</summary>
    [System.Text.Json.Serialization.JsonIgnore]
    public ulong? VisibleToMemberId { get; set; }
    public ulong? MemberId { get; set; }
    public ulong? TrainerId { get; set; }
    public string? Category { get; set; }
    public Difficulty? Difficulty { get; set; }
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public class CreateWorkoutRequest
{
    public ulong TenantId { get; set; }
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public string? Category { get; set; }
    public WorkoutGoal Goal { get; set; } = WorkoutGoal.General;
    public Difficulty Difficulty { get; set; } = Difficulty.Beginner;
    public ushort? DurationMin { get; set; }
    public bool IsPublic { get; set; }
    public List<string>? Tags { get; set; }
}

public class UpdateWorkoutRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? Category { get; set; }
    public WorkoutGoal? Goal { get; set; }
    public Difficulty? Difficulty { get; set; }
    public ushort? DurationMin { get; set; }
    public bool? IsPublic { get; set; }
}

public class AssignWorkoutRequest
{
    public ulong WorkoutId { get; set; }
    public List<ulong> MemberIds { get; set; } = [];
    public ulong? TrainerId { get; set; }
    public DateOnly AssignedAt { get; set; }
    public DateOnly? DueDate { get; set; }
    public string? Notes { get; set; }
}

public class CompleteWorkoutRequest
{
    /// <summary>The member who trained. 0 / omitted = the caller. Members may only log for themselves.</summary>
    public ulong ClientId { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime EndedAt { get; set; }
    public ushort? Calories { get; set; }
    public string? Notes { get; set; }
    public byte? MoodBefore { get; set; }
    public byte? MoodAfter { get; set; }
    public byte? FatigueLevel { get; set; }
    /// <summary>Whole-session effort 1–10.</summary>
    public byte? SessionRpe { get; set; }
    /// <summary>Direct workout assignment this completes (set to Completed). Inferred when omitted.</summary>
    public ulong? AssignmentId { get; set; }
    /// <summary>Plan assignment + plan position this session was for. Inferred from a plan day workout when omitted.</summary>
    public ulong? PlanAssignmentId { get; set; }
    public byte? Week { get; set; }
    public byte? Day { get; set; }
    public List<CompleteSetRequest> Sets { get; set; } = [];
}

/// <summary>One logged set (was <c>WorkoutSetLog</c>; JSON shape unchanged plus new optional fields).</summary>
public class CompleteSetRequest
{
    public ulong ExerciseId { get; set; }
    /// <summary>The structure row (sections[].exercises[].workoutExerciseId) the set was logged against.</summary>
    public ulong? WorkoutExerciseId { get; set; }
    public byte SetNo { get; set; }
    /// <summary>normal | warmup | drop | failure (default normal).</summary>
    public string? SetType { get; set; }
    public ushort? Reps { get; set; }
    public decimal? WeightKg { get; set; }
    public int? DurationSec { get; set; }
    public decimal? DistanceM { get; set; }
    public decimal? Rpe { get; set; }
    public bool Completed { get; set; } = true;
}
