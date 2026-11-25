using GymManagmentApplication.Domain.Enums;
using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Training;

public class WorkoutTemplate : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong CreatedBy { get; set; }
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public string? Category { get; set; }
    public WorkoutGoal Goal { get; set; } = WorkoutGoal.General;
    public Difficulty Difficulty { get; set; } = Difficulty.Beginner;
    public ushort? DurationMin { get; set; }
    public bool IsPublic { get; set; }
    public bool IsAiGenerated { get; set; }
    public JsonDocument? BranchingRules { get; set; }
    public JsonDocument? Tags { get; set; }
    public ushort Version { get; set; } = 1;
    /// <summary>Set on a plan day's own workout ("day workout"); such rows are hidden from the library.</summary>
    public ulong? OwnerPlanDayId { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
    public Identity.User Creator { get; set; } = default!;
    public ICollection<WorkoutSection> Sections { get; set; } = [];
    public ICollection<WorkoutAssignment> Assignments { get; set; } = [];
}
