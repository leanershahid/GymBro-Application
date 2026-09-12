namespace GymManagmentApplication.Application.Member.Responses;

public class MemberTimelineResponse
{
    public string EventType { get; set; } = default!;
    public string Description { get; set; } = default!;
    public DateTime OccurredAt { get; set; }
}
