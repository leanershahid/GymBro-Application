using GymManagmentApplication.Domain.Enums;
using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Identity;

public class User : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong? BranchId { get; set; }
    public ulong RoleId { get; set; }
    public string? Uuid { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? PasswordHash { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? AvatarUrl { get; set; }
    public UserGender? Gender { get; set; }
    public DateOnly? Dob { get; set; }
    public UserStatus Status { get; set; } = UserStatus.Pending;
    public DateTime? EmailVerifiedAt { get; set; }
    public DateTime? PhoneVerifiedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public uint LoginCount { get; set; }
    public JsonDocument? FaceEncoding { get; set; }
    public string? BiometricHash { get; set; }
    public string PreferredLanguage { get; set; } = "en";
    public JsonDocument? NotificationPrefs { get; set; }
    public string? Notes { get; set; }
    public JsonDocument? CustomFields { get; set; }
    public DateTime? DeletedAt { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
    public Core.Branch? Branch { get; set; }
    public Role Role { get; set; } = default!;
    public ICollection<UserSession> Sessions { get; set; } = [];
}
