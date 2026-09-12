using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.AI;

public class PoseLog
{
    public ulong Id { get; set; }
    public ulong LogId { get; set; }
    public ulong ExerciseId { get; set; }
    public DateTime CapturedAt { get; set; }
    public JsonDocument? Keypoints { get; set; }
    public JsonDocument? Corrections { get; set; }
    public decimal? Score { get; set; }

    public Training.WorkoutLog Log { get; set; } = default!;
    public Training.Exercise Exercise { get; set; } = default!;
}
