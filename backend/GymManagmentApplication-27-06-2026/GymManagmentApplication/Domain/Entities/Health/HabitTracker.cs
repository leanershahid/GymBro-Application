using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.Health;

public class HabitTracker
{
    public ulong Id { get; set; }
    public ulong ClientId { get; set; }
    public string Name { get; set; } = default!;
    public HabitFrequency Frequency { get; set; } = HabitFrequency.Daily;
    public byte Target { get; set; } = 1;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Identity.User Client { get; set; } = default!;
    public ICollection<HabitLog> Logs { get; set; } = [];
}
