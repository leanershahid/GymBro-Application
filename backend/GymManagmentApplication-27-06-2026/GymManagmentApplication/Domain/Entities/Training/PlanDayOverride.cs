using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.Training;

/// <summary>
/// A change to one calendar date of a plan assignment: the day is skipped, or moved to another date.
/// One row per assignment and original date. Shifting the whole plan is done by moving StartDate instead.
/// </summary>
public class PlanDayOverride
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong PlanAssignmentId { get; set; }
    /// <summary>The calendar date the plan day was originally scheduled on.</summary>
    public DateOnly Date { get; set; }
    public PlanDayOverrideAction Action { get; set; }
    public DateOnly? MovedToDate { get; set; }
    public ulong? ByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public WorkoutPlanAssignment PlanAssignment { get; set; } = default!;
}
