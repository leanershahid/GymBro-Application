using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.Training;

public class WorkoutAssignment
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong? TrainerId { get; set; }
    public ulong ClientId { get; set; }
    public ulong TemplateId { get; set; }
    public DateOnly AssignedAt { get; set; }
    public DateOnly? DueDate { get; set; }
    public AssignmentStatus Status { get; set; } = AssignmentStatus.Assigned;
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Core.Tenant Tenant { get; set; } = default!;
    public TrainerProfile? Trainer { get; set; }
    public Identity.User Client { get; set; } = default!;
    public WorkoutTemplate Template { get; set; } = default!;
    public ICollection<WorkoutLog> Logs { get; set; } = [];
}
