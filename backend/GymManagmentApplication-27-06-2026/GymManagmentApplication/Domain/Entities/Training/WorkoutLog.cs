using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Training;

public class WorkoutLog
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong? AssignmentId { get; set; }
    public ulong ClientId { get; set; }
    public ulong? TemplateId { get; set; }
    public ulong? BranchId { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public short? DurationMin { get; set; }
    public decimal? Score { get; set; }
    public ushort? Calories { get; set; }
    public string? Notes { get; set; }
    public JsonDocument? PostureData { get; set; }
    public byte? MoodBefore { get; set; }
    public byte? MoodAfter { get; set; }
    public byte? FatigueLevel { get; set; }
    /// <summary>The plan assignment and plan position this session was for (null for library / one-off workouts).</summary>
    public ulong? PlanAssignmentId { get; set; }
    public byte? WeekNumber { get; set; }
    public byte? DayNumber { get; set; }
    /// <summary>Whole-session effort, 1–10.</summary>
    public byte? SessionRpe { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public WorkoutAssignment? Assignment { get; set; }
    public Identity.User Client { get; set; } = default!;
    public WorkoutTemplate? Template { get; set; }
    public WorkoutPlanAssignment? PlanAssignment { get; set; }
    public ICollection<WorkoutSetLog> Sets { get; set; } = [];

    public Core.Tenant Tenant { get; set; } = default!;
}
