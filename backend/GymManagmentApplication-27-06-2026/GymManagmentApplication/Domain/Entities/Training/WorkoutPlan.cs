using System.Text.Json;
using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.Training;

public class WorkoutPlan : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong CreatedBy { get; set; }
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public byte DurationWeeks { get; set; }
    public WorkoutGoal Goal { get; set; } = WorkoutGoal.General;
    public Difficulty Difficulty { get; set; } = Difficulty.Beginner;
    public bool IsActive { get; set; } = true;
    public JsonDocument? ProgressionRules { get; set; }
    public JsonDocument? Tags { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
    public Identity.User Creator { get; set; } = default!;
    public ICollection<WorkoutPlanWeek> Weeks { get; set; } = [];
    public ICollection<WorkoutPlanAssignment> PlanAssignments { get; set; } = [];
    public ICollection<WorkoutPlanBranch> Branches { get; set; } = [];
}
