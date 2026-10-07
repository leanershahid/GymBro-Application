namespace GymManagmentApplication.Domain.Entities.Health;

public class HabitLog
{
    public ulong Id { get; set; }
    /// <summary>Owning gym (nullable: rows written before this was mapped have none).</summary>
    public ulong? TenantId { get; set; }
    public ulong HabitId { get; set; }
    public DateOnly LogDate { get; set; }
    public bool Completed { get; set; } = true;
    public string? Notes { get; set; }

    public HabitTracker Habit { get; set; } = default!;
}
