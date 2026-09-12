namespace GymManagmentApplication.Application.Trainer.Requests;

public class SetScheduleRequest
{
    public List<ScheduleSlotRequest> Slots { get; set; } = [];
}

public class ScheduleSlotRequest
{
    public byte DayOfWeek { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public bool IsActive { get; set; } = true;
}
