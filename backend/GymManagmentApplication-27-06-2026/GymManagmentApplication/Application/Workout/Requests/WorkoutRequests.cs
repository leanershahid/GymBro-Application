using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Application.Workout.Requests;

public class WorkoutListRequest
{
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
    public ulong ClientId { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime EndedAt { get; set; }
    public ushort? Calories { get; set; }
    public string? Notes { get; set; }
    public byte? MoodBefore { get; set; }
    public byte? MoodAfter { get; set; }
    public byte? FatigueLevel { get; set; }
    public List<WorkoutSetLog> Sets { get; set; } = [];
}

public class WorkoutSetLog
{
    public ulong ExerciseId { get; set; }
    public byte SetNo { get; set; }
    public ushort? Reps { get; set; }
    public decimal? WeightKg { get; set; }
    public short? DurationSec { get; set; }
    public byte? Rpe { get; set; }
}
