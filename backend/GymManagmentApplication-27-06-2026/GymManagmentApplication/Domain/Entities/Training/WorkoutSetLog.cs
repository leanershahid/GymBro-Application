using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.Training;

/// <summary>One logged set of a completed session (actual numbers, vs the prescribed targets).</summary>
public class WorkoutSetLog
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong WorkoutLogId { get; set; }
    /// <summary>Denormalised from the log, for "last time" and PR queries.</summary>
    public ulong ClientId { get; set; }
    public ulong ExerciseId { get; set; }
    /// <summary>The prescription row it was logged against (null once the workout is re-edited).</summary>
    public ulong? WorkoutExerciseId { get; set; }
    public byte SetNo { get; set; }
    public SetType SetType { get; set; } = SetType.Normal;
    public ushort? Reps { get; set; }
    public decimal? WeightKg { get; set; }
    public decimal? Rpe { get; set; }
    public int? DurationSec { get; set; }
    public decimal? DistanceM { get; set; }
    public bool Completed { get; set; } = true;
    public DateTime PerformedAt { get; set; } = DateTime.UtcNow;

    public WorkoutLog WorkoutLog { get; set; } = default!;
    public Exercise Exercise { get; set; } = default!;
}
