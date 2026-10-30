namespace GymManagmentApplication.Domain.Entities.Identity;

/// <summary>
/// Per-user override on one <see cref="Module"/>. It wins over the user's role grants either way:
/// <see cref="IsEnabled"/> true grants the module with exactly these flags, false removes it.
/// No row means the user's roles decide.
/// </summary>
public class UserModuleAccess
{
    public ulong Id { get; set; }
    public ulong UserId { get; set; }
    public ulong ModuleId { get; set; }
    /// <summary>Allow (true) or deny (false) this module for the user.</summary>
    public bool IsEnabled { get; set; }
    /// <summary>Sub-permissions within the module. Meaningless unless <see cref="IsEnabled"/> is true.</summary>
    public bool CanAdd { get; set; } = true;
    public bool CanEdit { get; set; } = true;
    public bool CanDelete { get; set; } = true;
    public ulong? GrantedByAdminId { get; set; }
    public DateTime GrantedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = default!;
    public Module Module { get; set; } = default!;
}
