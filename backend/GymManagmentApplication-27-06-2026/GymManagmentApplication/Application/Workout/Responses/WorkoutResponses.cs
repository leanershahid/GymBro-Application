namespace GymManagmentApplication.Application.Workout.Responses;

public class WorkoutResponse
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public string? Category { get; set; }
    public string Goal { get; set; } = default!;
    public string Difficulty { get; set; } = default!;
    public ushort? DurationMin { get; set; }
    public bool IsPublic { get; set; }
    public bool IsAiGenerated { get; set; }
    public ushort Version { get; set; }
    public List<string> Tags { get; set; } = [];
    public DateTime CreatedAt { get; set; }
}

public class WorkoutProgressResponse
{
    public ulong WorkoutId { get; set; }
    public ulong ClientId { get; set; }
    public int TotalSessions { get; set; }
    public int CompletedSessions { get; set; }
    public double CompletionRate { get; set; }
    public DateTime? LastCompletedAt { get; set; }
}

public class WorkoutScoreResponse
{
    public ulong WorkoutId { get; set; }
    public ulong ClientId { get; set; }
    /// <summary>Null until a session has a real score (no more made-up 75).</summary>
    public decimal? Score { get; set; }
    public string? Grade { get; set; }
    public DateTime ScoredAt { get; set; }
}

public class WorkoutLogResponse
{
    public ulong Id { get; set; }
    public ulong ClientId { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public short? DurationMin { get; set; }
    public decimal? Score { get; set; }
    public ushort? Calories { get; set; }
    public string? Notes { get; set; }
}

/// <summary>POST /workouts/{id}/complete: the old log fields plus the session summary and new PRs.</summary>
public class CompleteWorkoutResponse : WorkoutLogResponse
{
    public ulong LogId { get; set; }
    public ulong? PlanAssignmentId { get; set; }
    public byte? WeekNumber { get; set; }
    public byte? DayNumber { get; set; }
    public ulong? AssignmentId { get; set; }
    public SessionSummaryResponse Summary { get; set; } = new();
    public List<NewRecordResponse> NewRecords { get; set; } = [];
}

public class SessionSummaryResponse
{
    public int Sets { get; set; }
    public int Exercises { get; set; }
    public decimal VolumeKg { get; set; }
    public short? DurationMin { get; set; }
}

public class NewRecordResponse
{
    public ulong ExerciseId { get; set; }
    public string? ExerciseName { get; set; }
    /// <summary>heaviestWeight | estimatedOneRepMax | mostReps | bestSetVolume</summary>
    public string Type { get; set; } = default!;
    public decimal Value { get; set; }
    public decimal? PreviousValue { get; set; }
    public ushort? Reps { get; set; }
    public decimal? WeightKg { get; set; }
}
