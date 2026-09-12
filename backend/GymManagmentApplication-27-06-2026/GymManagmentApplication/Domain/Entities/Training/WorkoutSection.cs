using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.Training;

public class WorkoutSection
{
    public ulong Id { get; set; }
    public ulong TemplateId { get; set; }
    public string? Name { get; set; }
    public SectionType Type { get; set; } = SectionType.Main;
    public byte SortOrder { get; set; }
    public ushort? RestSeconds { get; set; }
    public byte Rounds { get; set; } = 1;

    public WorkoutTemplate Template { get; set; } = default!;
    public ICollection<WorkoutExercise> Exercises { get; set; } = [];
}
