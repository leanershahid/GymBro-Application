namespace GymManagmentApplication.Domain.Entities.Gamification;

public class UserAchievement
{
    public ulong Id { get; set; }
    public ulong UserId { get; set; }
    public ulong AchievementId { get; set; }
    public DateTime EarnedAt { get; set; } = DateTime.UtcNow;

    public Identity.User User { get; set; } = default!;
    public Achievement Achievement { get; set; } = default!;
}
