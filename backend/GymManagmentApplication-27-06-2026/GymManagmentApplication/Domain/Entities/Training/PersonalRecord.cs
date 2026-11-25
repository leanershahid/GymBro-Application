using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.Training;

/// <summary>A member's current best for one exercise and record type (one row per client/exercise/type).</summary>
public class PersonalRecord
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong ClientId { get; set; }
    public ulong ExerciseId { get; set; }
    public PersonalRecordType Type { get; set; }
    /// <summary>kg for weight / est. 1RM, reps for MostReps, kg×reps for BestSetVolume.</summary>
    public decimal Value { get; set; }
    /// <summary>The set that set the record.</summary>
    public ushort? Reps { get; set; }
    public decimal? WeightKg { get; set; }
    public ulong? WorkoutSetLogId { get; set; }
    public ulong? WorkoutLogId { get; set; }
    public DateTime AchievedAt { get; set; } = DateTime.UtcNow;

    public Exercise Exercise { get; set; } = default!;
}
