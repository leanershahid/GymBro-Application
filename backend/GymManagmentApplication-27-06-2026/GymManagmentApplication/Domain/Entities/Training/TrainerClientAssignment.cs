using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.Training;

public class TrainerClientAssignment
{
    public ulong Id { get; set; }
    public ulong TrainerId { get; set; }
    public ulong ClientId { get; set; }
    public ulong BranchId { get; set; }
    public TrainerAssignmentStatus Status { get; set; } = TrainerAssignmentStatus.Active;
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
    public DateTime? EndedAt { get; set; }
    public string? Notes { get; set; }

    public TrainerProfile Trainer { get; set; } = default!;
    public Identity.User Client { get; set; } = default!;
    public Core.Branch Branch { get; set; } = default!;
}
