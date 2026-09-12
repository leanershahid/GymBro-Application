namespace GymManagmentApplication.Application.Challenges.Responses;

public class ActiveChallengeResponse
{
    public ulong Id { get; set; }
    public string Title { get; set; } = default!;
    public int ParticipantCount { get; set; }
    public string? PrizeLabel { get; set; }
    public double ProgressPct { get; set; }
    public bool IsJoined { get; set; }
}
