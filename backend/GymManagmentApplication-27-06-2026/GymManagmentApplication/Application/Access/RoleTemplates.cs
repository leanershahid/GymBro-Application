namespace GymManagmentApplication.Application.Access;

/// <summary>A starting set of grants offered when an admin creates a role.</summary>
public record RoleTemplate(string Key, string Name, string Description, List<ModuleGrantDto> Grants);

/// <summary>How many people hold a role (main or additional) and how many modules it grants.</summary>
public record RoleSummaryDto(ulong RoleId, int People, int Modules);

/// <summary>Someone who signs in to the admin app — admins, staff and custom-role holders.</summary>
public record StaffMemberDto(ulong UserId, string Name, string? Email, string RoleName, string RoleSlug);

/// <summary>
/// The preset roles gyms usually start from (front desk, coach, manager). A template is only a
/// starting point: the app creates the role, then saves these grants to it, and the admin can
/// change them afterwards. Keys come from <see cref="ModuleCatalog.All"/>, so a module that is
/// removed there simply drops out of every template.
/// </summary>
public static class RoleTemplates
{
    private sealed record Can(bool Create = false, bool Edit = false, bool Delete = false, bool Export = false);

    private static readonly Can Work = new(Create: true, Edit: true);
    private static readonly Can Full = new(true, true, true, true);

    public static readonly RoleTemplate[] All =
    [
        Make("front-desk", "Front desk", "Checks people in, books classes and PT, signs up members and takes payments. Can't delete.",
        [
            ("admin.members", Work), ("admin.attendance", Work), ("admin.classes", Work), ("admin.pt-sessions", Work),
            ("admin.billing", new Can(Create: true)),
        ]),
        Make("coach", "Coach", "Runs classes and PT, and builds workouts, plans and exercises.",
        [
            ("admin.classes", Work), ("admin.pt-sessions", Work),
            ("admin.workouts", Full), ("admin.plans", Full), ("admin.exercises", Full),
        ]),
        Make("manager", "Manager", "Everything in the admin app except roles, access and tenants.",
            ModuleCatalog.All.Where(m => m.App == ModuleCatalog.AdminApp && !m.AdminOnly).Select(m => (m.Key, Full)).ToList()),
    ];

    private static RoleTemplate Make(string key, string name, string description, List<(string Key, Can Can)> modules)
    {
        var known = ModuleCatalog.All.Where(m => !m.AdminOnly).Select(m => m.Key).ToHashSet();
        var grants = modules
            .Where(m => known.Contains(m.Key))
            .Select(m => new ModuleGrantDto(m.Key, true, m.Can.Create, m.Can.Edit, m.Can.Delete, m.Can.Export))
            .ToList();
        return new RoleTemplate(key, name, description, grants);
    }
}
