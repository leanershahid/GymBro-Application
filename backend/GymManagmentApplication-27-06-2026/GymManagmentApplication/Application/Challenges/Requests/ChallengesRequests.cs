namespace GymManagmentApplication.Application.Challenges.Requests;

public class CreateChallengeRequest
{
    public ulong TenantId { get; set; }
    public string Title { get; set; } = default!;
    public string? Description { get; set; }
    public decimal? TargetValue { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    public string? PrizeLabel { get; set; }
}

public class UpdateChallengeStatusRequest
{
    public string Status { get; set; } = default!; // Draft | Active | Completed | Cancelled
}
