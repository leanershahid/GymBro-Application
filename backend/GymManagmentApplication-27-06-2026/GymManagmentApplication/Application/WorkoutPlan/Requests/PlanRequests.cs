using GymManagmentApplication.Domain.Enums;
using System.Text.Json;

namespace GymManagmentApplication.Application.WorkoutPlan.Requests;

public class PlanListRequest
{
    public ulong? TenantId { get; set; }
    public WorkoutGoal? Goal { get; set; }
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public class CreatePlanRequest
{
    public ulong TenantId { get; set; }
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public byte DurationWeeks { get; set; }
    public WorkoutGoal Goal { get; set; } = WorkoutGoal.General;
    public Difficulty Difficulty { get; set; } = Difficulty.Beginner;
}

public class UpdatePlanRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public byte? DurationWeeks { get; set; }
    public WorkoutGoal? Goal { get; set; }
    public Difficulty? Difficulty { get; set; }
    public bool? IsActive { get; set; }
}

public class AddBranchRequest
{
    public string Name { get; set; } = default!;
    public JsonDocument Condition { get; set; } = default!;
    public ulong? NextPlanId { get; set; }
    public byte SortOrder { get; set; }
}

public class UpdateProgressionRequest
{
    public JsonDocument Rules { get; set; } = default!;
}

public class AssignPlanRequest
{
    public List<ulong> MemberIds { get; set; } = [];
    public ulong? TrainerId { get; set; }
    public DateOnly StartDate { get; set; }
}
