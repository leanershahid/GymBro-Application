namespace GymManagmentApplication.Domain.Entities.Training;

public class TrainerAvailabilitySlot
{
    public ulong Id { get; set; }
    public ulong TrainerId { get; set; }
    public byte DayOfWeek { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public bool IsActive { get; set; } = true;

    public TrainerProfile Trainer { get; set; } = default!;
}
