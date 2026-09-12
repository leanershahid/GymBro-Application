using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.Training;

public class ExerciseMuscle
{
    public ulong ExerciseId { get; set; }
    public ushort MuscleId { get; set; }
    public MuscleRole Role { get; set; } = MuscleRole.Primary;

    public Exercise Exercise { get; set; } = default!;
    public MuscleGroup Muscle { get; set; } = default!;
}
