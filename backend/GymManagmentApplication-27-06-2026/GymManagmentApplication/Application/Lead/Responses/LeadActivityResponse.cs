namespace GymManagmentApplication.Application.Lead.Responses;

public class LeadActivityResponse
{
    public ulong Id { get; set; }
    public string ActivityType { get; set; } = default!;
    public string? Description { get; set; }
    public string? Outcome { get; set; }
    public DateTime CreatedAt { get; set; }
}
