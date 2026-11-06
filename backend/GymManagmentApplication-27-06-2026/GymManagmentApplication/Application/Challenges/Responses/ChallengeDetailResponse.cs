namespace GymManagmentApplication.Application.Challenges.Responses;

public class LeaderboardEntry
{
    public int Rank { get; set; }
    public ulong UserId { get; set; }
    public string Name { get; set; } = default!;
    public decimal Progress { get; set; }
    public double ProgressPct { get; set; }
    public bool IsMe { get; set; }
}

public class ChallengeDetailResponse
{
    public ulong Id { get; set; }
    public string Title { get; set; } = default!;
    public string? Description { get; set; }
    public string? Metric { get; set; }
    public decimal? TargetValue { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    public string Status { get; set; } = default!;
    public int ParticipantCount { get; set; }
    public bool IsJoined { get; set; }
    public decimal MyProgress { get; set; }
    public int? MyRank { get; set; }
    public List<LeaderboardEntry> Leaderboard { get; set; } = [];
}
