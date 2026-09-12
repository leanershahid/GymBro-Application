namespace GymManagmentApplication.Domain.Entities.Training;

public class WorkoutLogSet
{
    public ulong Id { get; set; }
    public ulong LogId { get; set; }
    public ulong ExerciseId { get; set; }
    public byte SetNo { get; set; }
    public ushort? Reps { get; set; }
    public decimal? WeightKg { get; set; }
    public short? DurationSec { get; set; }
    public decimal? DistanceM { get; set; }
    public byte? Rpe { get; set; }
    public string? Notes { get; set; }

    public WorkoutLog Log { get; set; } = default!;
    public Exercise Exercise { get; set; } = default!;
}
