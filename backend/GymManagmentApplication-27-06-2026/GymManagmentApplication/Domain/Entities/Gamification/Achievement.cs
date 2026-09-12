using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Gamification;

public class Achievement
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public string? IconUrl { get; set; }
    public Enums.AchievementType Type { get; set; }
    public JsonDocument Criteria { get; set; } = default!;
    public ushort Points { get; set; }
    public bool IsActive { get; set; } = true;

    public Core.Tenant Tenant { get; set; } = default!;
    public ICollection<UserAchievement> UserAchievements { get; set; } = [];
}
