namespace GymManagmentApplication.Domain.Entities.Training;

public class Equipment
{
    public ushort Id { get; set; }
    public ulong? TenantId { get; set; }
    public string Name { get; set; } = default!;
    public string? Category { get; set; }

    public ICollection<ExerciseEquipment> ExerciseEquipments { get; set; } = [];
}
