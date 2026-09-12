using GymManagmentApplication.Domain.Enums;
using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Gamification;

public class Challenge
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong? CreatedBy { get; set; }
    public string Title { get; set; } = default!;
    public string? Description { get; set; }
    public ChallengeType Type { get; set; } = ChallengeType.Individual;
    public string? Metric { get; set; }
    public decimal? TargetValue { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    public ChallengeStatus Status { get; set; } = ChallengeStatus.Draft;
    public bool IsAutomated { get; set; }
    public JsonDocument? Prizes { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
    public ICollection<ChallengeParticipant> Participants { get; set; } = [];
}
