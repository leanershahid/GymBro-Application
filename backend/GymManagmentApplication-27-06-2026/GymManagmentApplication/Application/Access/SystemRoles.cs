using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Domain.Entities.Identity;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Access;

/// <summary>
/// A gym's built-in roles and their default module grants (moved out of Infrastructure's DbSeeder,
/// ARCH-022, so TenantService can provision a new gym without referencing Infrastructure). The
/// seeder forwards to these methods.
/// </summary>
public static class SystemRoles
{
    /// <summary>Creates any missing system roles for a tenant. Idempotent.</summary>
    public static Task EnsureAsync(IAppDbContext db, ulong tenantId, bool includeSuperAdmin) =>
        EnsureAsync(db, [(tenantId, includeSuperAdmin)]);

    /// <summary>
    /// Creates the missing system roles of several tenants with one read of the existing roles and
    /// one save, then gives the new roles their default module grants.
    /// </summary>
    public static async Task EnsureAsync(IAppDbContext db, IReadOnlyCollection<(ulong TenantId, bool IncludeSuperAdmin)> tenants)
    {
        var ids = tenants.Select(t => t.TenantId).ToList();
        var existing = (await db.Roles.AcrossTenants()
                .Where(r => ids.Contains(r.TenantId))
                .Select(r => new { r.TenantId, r.Slug })
                .ToListAsync())
            .Select(r => (r.TenantId, r.Slug))
            .ToHashSet();

        var created = new List<Role>();
        foreach (var (tenantId, includeSuperAdmin) in tenants)
        {
            var roles = RoleNames.TenantSystemRoles.AsEnumerable();
            if (includeSuperAdmin)
                roles = roles.Prepend((RoleNames.SuperAdmin, "Super Admin", "Platform-wide access across all gyms"));

            foreach (var (slug, name, desc) in roles)
            {
                if (!existing.Add((tenantId, slug))) continue;
                var role = new Role
                {
                    TenantId    = tenantId,
                    Name        = name,
                    Slug        = slug,
                    Description = desc,
                    IsSystem    = true,
                    CreatedAt   = DateTime.UtcNow
                };
                db.Roles.Add(role);
                created.Add(role);
            }
        }
        if (created.Count == 0) return;

        await db.SaveChangesAsync();
        await GrantDefaultModulesAsync(db, created);
    }

    /// <summary>Gives a built-in role its <see cref="ModuleCatalog.DefaultKeysFor"/> modules, with every action allowed.</summary>
    public static Task GrantDefaultModulesAsync(IAppDbContext db, Role role) => GrantDefaultModulesAsync(db, [role]);

    /// <summary>Batch form: one read of the modules and of the roles' existing grants, one save.</summary>
    public static async Task GrantDefaultModulesAsync(IAppDbContext db, IReadOnlyCollection<Role> roles)
    {
        var keysByRole = roles.ToDictionary(r => r, r => ModuleCatalog.DefaultKeysFor(r.Slug).ToList());
        var allKeys = keysByRole.Values.SelectMany(k => k).Distinct().ToList();
        if (allKeys.Count == 0) return;

        var moduleIds = await db.Modules.Where(m => allKeys.Contains(m.Key)).ToDictionaryAsync(m => m.Key, m => m.Id);
        var roleIds = roles.Select(r => r.Id).ToList();
        var granted = (await db.RoleModuleGrants.AcrossTenants()
                .Where(g => roleIds.Contains(g.RoleId))
                .Select(g => new { g.RoleId, g.ModuleId })
                .ToListAsync())
            .Select(g => (g.RoleId, g.ModuleId))
            .ToHashSet();

        foreach (var (role, keys) in keysByRole)
            foreach (var key in keys)
            {
                if (!moduleIds.TryGetValue(key, out var moduleId) || !granted.Add((role.Id, moduleId))) continue;
                db.RoleModuleGrants.Add(new RoleModuleGrant
                {
                    TenantId = role.TenantId, RoleId = role.Id, ModuleId = moduleId,
                    CanView = true, CanCreate = true, CanEdit = true, CanDelete = true, CanExport = true,
                });
            }
        await db.SaveChangesAsync();
    }
}
