using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.Identity;

public class UserSession
{
    public ulong Id { get; set; }
    public ulong UserId { get; set; }
    public string TokenHash { get; set; } = default!;
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public DeviceType DeviceType { get; set; } = DeviceType.Web;
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = default!;
}
