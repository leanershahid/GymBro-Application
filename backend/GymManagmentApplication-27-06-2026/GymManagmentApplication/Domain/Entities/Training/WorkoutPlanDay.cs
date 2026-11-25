namespace GymManagmentApplication.Domain.Entities.Training;

public class WorkoutPlanDay
{
    public ulong Id { get; set; }
    public ulong WeekId { get; set; }
    public byte DayNumber { get; set; }
    /// <summary>The day's own workout (a WorkoutTemplate with OwnerPlanDayId = this day). Older days may still point at a library workout until first edited.</summary>
    public ulong? TemplateId { get; set; }
    /// <summary>"Push", "Legs"…</summary>
    public string? Title { get; set; }
    public string? Notes { get; set; }
    public bool IsRestDay { get; set; }

    public WorkoutPlanWeek Week { get; set; } = default!;
    public WorkoutTemplate? Template { get; set; }
}
