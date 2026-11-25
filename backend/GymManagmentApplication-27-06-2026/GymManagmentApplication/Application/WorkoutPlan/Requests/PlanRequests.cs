using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Application.WorkoutPlan.Requests;

public class PlanListRequest
{
    public ulong? TenantId { get; set; }
    public WorkoutGoal? Goal { get; set; }
    /// <summary>Set by the service (never from the request): only plans assigned to this member.</summary>
    [System.Text.Json.Serialization.JsonIgnore]
    public ulong? AssignedToUserId { get; set; }
    /// <summary>Staff: also list members' plan copies (default: masters only).</summary>
    public bool IncludeClientCopies { get; set; }
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
    public byte? DaysPerWeekHint { get; set; }
}

public class UpdatePlanRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public byte? DurationWeeks { get; set; }
    public WorkoutGoal? Goal { get; set; }
    public Difficulty? Difficulty { get; set; }
    public bool? IsActive { get; set; }
    /// <summary>0 clears it.</summary>
    public byte? DaysPerWeekHint { get; set; }
}

public class AssignPlanRequest
{
    public List<ulong> MemberIds { get; set; } = [];
    public ulong? TrainerId { get; set; }
    /// <summary>Calendar date the member starts (on <see cref="StartWeek"/>/<see cref="StartDay"/>).</summary>
    public DateOnly StartDate { get; set; }
    /// <summary>Plan position the member starts at on StartDate (default week 1, day 1).</summary>
    public byte StartWeek { get; set; } = 1;
    public byte StartDay { get; set; } = 1;
    /// <summary>End the member's current active plan instead of answering 409 PLAN_ALREADY_ACTIVE.</summary>
    public bool ReplaceExisting { get; set; }
}
