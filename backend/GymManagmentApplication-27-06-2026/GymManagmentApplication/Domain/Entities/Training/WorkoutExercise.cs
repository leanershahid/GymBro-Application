using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Training;

public class WorkoutExercise
{
    public ulong Id { get; set; }
    public ulong SectionId { get; set; }
    public ulong ExerciseId { get; set; }
    public byte SortOrder { get; set; }
    public byte? Sets { get; set; }
    public string? Reps { get; set; }
    public short? DurationSeconds { get; set; }
    public short? RestSeconds { get; set; }
    public string? Tempo { get; set; }
    public string? WeightSuggestion { get; set; }
    public byte? Intensity { get; set; }
    public string? Notes { get; set; }
    public JsonDocument? ConditionRules { get; set; }
    public bool AiSubstitutionOk { get; set; } = true;

    public WorkoutSection Section { get; set; } = default!;
    public Exercise Exercise { get; set; } = default!;
}
