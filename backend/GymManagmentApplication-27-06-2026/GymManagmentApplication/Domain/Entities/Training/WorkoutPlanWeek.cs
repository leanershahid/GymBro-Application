namespace GymManagmentApplication.Domain.Entities.Training;

public class WorkoutPlanWeek
{
    public ulong Id { get; set; }
    public ulong PlanId { get; set; }
    public byte WeekNumber { get; set; }
    public string? Notes { get; set; }

    public WorkoutPlan Plan { get; set; } = default!;
    public ICollection<WorkoutPlanDay> Days { get; set; } = [];
}
