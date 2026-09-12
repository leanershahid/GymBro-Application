using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.Facility;

public class AccessEvent
{
    public ulong Id { get; set; }
    public ulong DeviceId { get; set; }
    public ulong? UserId { get; set; }
    public AccessEventType EventType { get; set; }
    public AccessMethod Method { get; set; }
    public decimal? Confidence { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public AccessDevice Device { get; set; } = default!;
    public Identity.User? User { get; set; }
}
