namespace GymManagmentApplication.Application.Challenges.Responses;

public class ChallengeAdminResponse
{
    public ulong Id { get; set; }
    public string Title { get; set; } = default!;
    public string? Description { get; set; }
    public string Status { get; set; } = default!;
    public int ParticipantCount { get; set; }
    public string? PrizeLabel { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
}
