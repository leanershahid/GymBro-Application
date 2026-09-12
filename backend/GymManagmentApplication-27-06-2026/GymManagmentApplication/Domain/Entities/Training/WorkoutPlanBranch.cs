using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Training;

public class WorkoutPlanBranch
{
    public ulong Id { get; set; }
    public ulong PlanId { get; set; }
    public string Name { get; set; } = default!;
    public JsonDocument Condition { get; set; } = default!;
    public ulong? NextPlanId { get; set; }
    public byte SortOrder { get; set; }

    public WorkoutPlan Plan { get; set; } = default!;
    public WorkoutPlan? NextPlan { get; set; }
}
