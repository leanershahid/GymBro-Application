using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.Training;

public class TrainerTimeOff
{
    public ulong Id { get; set; }
    public ulong TrainerId { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    public string? Reason { get; set; }
    public TimeOffStatus Status { get; set; } = TimeOffStatus.Pending;
    public ulong? ApprovedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public TrainerProfile Trainer { get; set; } = default!;
    public Identity.User? Approver { get; set; }
}
