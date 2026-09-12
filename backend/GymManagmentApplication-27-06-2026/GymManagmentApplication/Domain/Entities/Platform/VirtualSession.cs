using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.Platform;

public class VirtualSession
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong TrainerId { get; set; }
    public ulong ClientId { get; set; }
    public ulong? PtSessionId { get; set; }
    public VirtualSessionProvider Provider { get; set; } = VirtualSessionProvider.Zoom;
    public string? MeetingId { get; set; }
    public string? MeetingUrl { get; set; }
    public string? Passcode { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
    public string? RecordingUrl { get; set; }
    public VirtualSessionStatus Status { get; set; } = VirtualSessionStatus.Scheduled;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Core.Tenant Tenant { get; set; } = default!;
    public Training.TrainerProfile Trainer { get; set; } = default!;
    public Identity.User Client { get; set; } = default!;
    public Training.PtSession? PtSession { get; set; }
}
