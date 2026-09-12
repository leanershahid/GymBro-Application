namespace GymManagmentApplication.Domain.Entities.Identity;

/// <summary>
/// Defines which platform modules a role can access within a tenant,
/// with a granular action-level permission set (view, create, edit, delete).
/// </summary>
public class ModuleAccess
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong RoleId { get; set; }

    /// <summary>Module key — e.g. "members", "trainers", "billing", "reports"</summary>
    public string Module { get; set; } = default!;

    public bool CanView { get; set; } = false;
    public bool CanCreate { get; set; } = false;
    public bool CanEdit { get; set; } = false;
    public bool CanDelete { get; set; } = false;

    /// <summary>Export permission (CSV/PDF/Excel) — separate concern from CRUD</summary>
    public bool CanExport { get; set; } = false;

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public Core.Tenant Tenant { get; set; } = default!;
    public Role Role { get; set; } = default!;
}
