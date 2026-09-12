namespace GymManagmentApplication.Domain.Entities.Training;

public class ExerciseEquipment
{
    public ulong ExerciseId { get; set; }
    public ushort EquipmentId { get; set; }

    public Exercise Exercise { get; set; } = default!;
    public Equipment Equipment { get; set; } = default!;
}
