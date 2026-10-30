namespace GymManagmentApplication.Domain.Entities.Identity;

/// <summary>
/// A role's grant on one <see cref="Module"/>. Every user holding the role (as primary or
/// additional role) gets the module, unless a per-user <see cref="UserModuleAccess"/> overrides it.
/// </summary>
public class RoleModuleGrant
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong RoleId { get; set; }
    public ulong ModuleId { get; set; }

    public bool CanView { get; set; } = true;
    public bool CanCreate { get; set; }
    public bool CanEdit { get; set; }
    public bool CanDelete { get; set; }
    public bool CanExport { get; set; }

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Role Role { get; set; } = default!;
    public Module Module { get; set; } = default!;
}
