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
    /// <summary>Unused since the weekly plan builder (column kept).</summary>
    public JsonDocument? ProgressionRules { get; set; }
    /// <summary>True for a master plan (the library); false for a member's own copy made on assign.</summary>
    public bool IsTemplate { get; set; } = true;
    /// <summary>The plan this one was copied from (assign / duplicate).</summary>
    public ulong? SourcePlanId { get; set; }
    /// <summary>The member a client copy belongs to (null on masters).</summary>
    public ulong? OwnerClientId { get; set; }
    /// <summary>How many training days a week the plan is meant for (display hint only).</summary>
    public byte? DaysPerWeekHint { get; set; }
    public JsonDocument? Tags { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
    public Identity.User Creator { get; set; } = default!;
    public ICollection<WorkoutPlanWeek> Weeks { get; set; } = [];
    public ICollection<WorkoutPlanAssignment> PlanAssignments { get; set; } = [];
    public ICollection<WorkoutPlanBranch> Branches { get; set; } = [];
}
