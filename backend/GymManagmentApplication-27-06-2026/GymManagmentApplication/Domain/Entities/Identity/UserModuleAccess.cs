namespace GymManagmentApplication.Domain.Entities.Identity;

/// <summary>
/// Per-user override deciding whether a specific <see cref="Module"/> is
/// visible/usable for a given Trainer or Client, in addition to their role.
/// </summary>
public class UserModuleAccess
{
    public ulong Id { get; set; }
    public ulong UserId { get; set; }
    public ulong ModuleId { get; set; }
    public bool IsEnabled { get; set; }
    public ulong? GrantedByAdminId { get; set; }
    public DateTime GrantedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = default!;
    public Module Module { get; set; } = default!;
}
