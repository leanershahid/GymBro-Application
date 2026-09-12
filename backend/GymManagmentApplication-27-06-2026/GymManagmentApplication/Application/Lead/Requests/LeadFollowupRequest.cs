namespace GymManagmentApplication.Application.Lead.Requests;

public class LeadFollowupRequest
{
    public string Description { get; set; } = default!;
    public string? Outcome { get; set; }
    public string ActivityType { get; set; } = "Note";
}
