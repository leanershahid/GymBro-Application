using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Training;

public class WorkoutProgression
{
    public ulong Id { get; set; }
    public ulong TemplateId { get; set; }
    public ulong NextTemplate { get; set; }
    public JsonDocument Condition { get; set; } = default!;
    public byte SortOrder { get; set; }

    public WorkoutTemplate Template { get; set; } = default!;
    public WorkoutTemplate NextWorkoutTemplate { get; set; } = default!;
}
