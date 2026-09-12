namespace GymManagmentApplication.Domain.Entities.Health;

public class HabitLog
{
    public ulong Id { get; set; }
    public ulong HabitId { get; set; }
    public DateOnly LogDate { get; set; }
    public bool Completed { get; set; } = true;
    public string? Notes { get; set; }

    public HabitTracker Habit { get; set; } = default!;
}
