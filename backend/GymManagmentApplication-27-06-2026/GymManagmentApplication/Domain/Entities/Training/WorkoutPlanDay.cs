namespace GymManagmentApplication.Domain.Entities.Training;

public class WorkoutPlanDay
{
    public ulong Id { get; set; }
    public ulong WeekId { get; set; }
    public byte DayNumber { get; set; }
    public ulong? TemplateId { get; set; }
    public bool IsRestDay { get; set; }

    public WorkoutPlanWeek Week { get; set; } = default!;
    public WorkoutTemplate? Template { get; set; }
}
