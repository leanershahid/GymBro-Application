namespace GymManagmentApplication.Application.Challenges.Requests;

public class ChallengeProgressRequest
{
    /// <summary>Adds to the member's progress (e.g. km run today). Use Set to overwrite instead.</summary>
    public decimal Value { get; set; }
    public bool Set { get; set; }
}

public class UpdateChallengeRequest
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string? Metric { get; set; }
    public decimal? TargetValue { get; set; }
    public DateTime? StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
}
