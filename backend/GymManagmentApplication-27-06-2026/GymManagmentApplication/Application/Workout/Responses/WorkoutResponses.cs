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
    public decimal Score { get; set; }
    public string Grade { get; set; } = default!;
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
