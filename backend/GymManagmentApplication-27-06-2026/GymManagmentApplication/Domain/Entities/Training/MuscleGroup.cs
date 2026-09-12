namespace GymManagmentApplication.Domain.Entities.Training;

public class MuscleGroup
{
    public ushort Id { get; set; }
    public string Name { get; set; } = default!;

    public ICollection<ExerciseMuscle> ExerciseMuscles { get; set; } = [];
}
