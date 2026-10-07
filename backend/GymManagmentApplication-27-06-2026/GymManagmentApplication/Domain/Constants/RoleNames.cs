namespace GymManagmentApplication.Domain.Constants;

/// <summary>
/// Canonical system role slugs, matching the "superadmin" &gt; "admin" &gt; "trainer" &gt; "client"
/// hierarchy seeded in <see cref="Infrastructure.Data.DbSeeder"/>. "superadmin" is platform-wide
/// (manages tenants, sees all tenants); every other role is confined to its own tenant. Controllers should reference these
/// constants in <see cref="Filters.AuthorizeRolesAttribute"/> rather than repeating string
/// literals, so the set of valid roles lives in exactly one place.
/// </summary>
public static class RoleNames
{
    public const string SuperAdmin = "superadmin";
    public const string Admin = "admin";
    public const string Trainer = "trainer";
    public const string Client = "client";
    public const string Staff = "staff";

    /// <summary>
    /// Roles whose access is fixed in code. Every other role ('staff' and admin-defined custom
    /// roles) is authorised per module through the role/module access matrix.
    /// </summary>
    public static bool IsBuiltIn(string slug) =>
        slug.Equals(SuperAdmin, StringComparison.OrdinalIgnoreCase) ||
        slug.Equals(Admin, StringComparison.OrdinalIgnoreCase) ||
        slug.Equals(Trainer, StringComparison.OrdinalIgnoreCase) ||
        slug.Equals(Client, StringComparison.OrdinalIgnoreCase);

    /// <summary>Roles every tenant gets on creation (superadmin lives only in the platform tenant).</summary>
    public static readonly (string Slug, string Name, string Description)[] TenantSystemRoles =
    [
        (Admin,   "Admin",   "Full access within the gym"),
        (Trainer, "Trainer", "Trainer access"),
        (Client,  "Client",  "Member/client access"),
        (Staff,   "Staff",   "Front-desk staff access"),
    ];
}
