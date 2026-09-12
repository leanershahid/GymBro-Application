namespace GymManagmentApplication.Application.Trainer.Responses;

public class TrainerScheduleResponse
{
    public byte DayOfWeek { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public bool IsActive { get; set; }
}
