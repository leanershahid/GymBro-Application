using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.Training;

public class WorkoutPlanAssignment
{
    public ulong Id { get; set; }
    public ulong PlanId { get; set; }
    public ulong ClientId { get; set; }
    public ulong? TrainerId { get; set; }
    public DateOnly StartDate { get; set; }
    public AssignmentStatus Status { get; set; } = AssignmentStatus.Assigned;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public WorkoutPlan Plan { get; set; } = default!;
    public Identity.User Client { get; set; } = default!;
}
