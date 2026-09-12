namespace GymManagmentApplication.Domain.Entities.Gamification;

public class ChallengeParticipant
{
    public ulong Id { get; set; }
    public ulong ChallengeId { get; set; }
    public ulong UserId { get; set; }
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    public decimal Progress { get; set; }
    public ushort? Rank { get; set; }

    public Challenge Challenge { get; set; } = default!;
    public Identity.User User { get; set; } = default!;
}
