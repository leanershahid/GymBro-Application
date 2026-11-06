using GymManagmentApplication.Application.Access;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Domain.Entities.Core;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Infrastructure.Data;

public static class DbSeeder
{
    /// <summary>
    /// Ensures the default Tenant, the module catalog and every tenant's system roles exist.
    /// Safe to call on every startup. Existing rows are read once per table and diffed in memory,
    /// so the number of queries stays constant as tenants grow (ARCH-041). Ids come from
    /// <see cref="AppDbContext"/>'s id assignment on tracking.
    /// </summary>
    public static async Task SeedAsync(AppDbContext db)
    {
        // ── Tenant ────────────────────────────────────────────────────────────
        if (!await db.Tenants.AnyAsync())
        {
            db.Tenants.Add(new Tenant
            {
                Uuid      = Guid.NewGuid().ToString(),
                Name      = "Default Gym",
                Slug      = "default-gym",
                Plan      = TenantPlan.Starter,
                Status    = TenantStatus.Active,
                Timezone  = "UTC",
                Locale    = "en",
                Currency  = "USD",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        // ── Modules ───────────────────────────────────────────────────────────
        // Before the roles, so a newly created role can be given its default grants.
        // No grant rows at all means the access data still lives in the old tables.
        var legacyAccessToMove = !await db.RoleModuleGrants.AcrossTenants().AnyAsync();
        var newModuleKeys = await UpsertModulesAsync(db);

        // ── Roles ─────────────────────────────────────────────────────────────
        // Every tenant gets its own copy of the system roles (role checks are by slug, but
        // users must hold a role row from their own tenant). The platform tenant — the first
        // one — additionally owns the 'superadmin' role.
        var tenantIds = await db.Tenants.OrderBy(t => t.Id).Select(t => t.Id).ToListAsync();
        var platformTenantId = tenantIds[0];
        var superRoleIsNew = !await db.Roles.AcrossTenants()
            .AnyAsync(r => r.TenantId == platformTenantId && r.Slug == RoleNames.SuperAdmin);
        await EnsureSystemRolesAsync(db, tenantIds.Select(id => (id, id == platformTenantId)).ToList());

        // One-time bootstrap: before 'superadmin' existed, the platform tenant's admin managed
        // all gyms. Promote the earliest such admin so tenant management stays reachable.
        // Runs only in the deploy that creates the role — never again — so archiving the super
        // admin can't be used to get some other admin promoted on the next restart.
        if (superRoleIsNew)
        {
            var superRole = await db.Roles.AcrossTenants()
                .FirstAsync(r => r.TenantId == platformTenantId && r.Slug == RoleNames.SuperAdmin);
            if (!await db.Users.AnyAsync(u => u.RoleId == superRole.Id && u.DeletedAt == null))
            {
                var adminRoleIds = await db.Roles.Where(r => r.Slug == RoleNames.Admin).Select(r => r.Id).ToListAsync();
                var firstAdmin = await db.Users
                    .Where(u => adminRoleIds.Contains(u.RoleId) && u.TenantId == platformTenantId && u.DeletedAt == null)
                    .OrderBy(u => u.Id)
                    .FirstOrDefaultAsync();
                if (firstAdmin is not null)
                {
                    firstAdmin.RoleId = superRole.Id;
                    await db.SaveChangesAsync();
                }
            }
        }

        // Repair users whose RoleId points at a role from another tenant (older seeds only
        // created roles for the first tenant): move them to the same-slug role in their own tenant.
        var mismatched = await db.Users
            .Join(db.Roles, u => u.RoleId, r => r.Id, (u, r) => new { User = u, r.Slug, RoleTenant = r.TenantId })
            .Where(x => x.RoleTenant != x.User.TenantId && x.Slug != RoleNames.SuperAdmin)
            .ToListAsync();
        if (mismatched.Count > 0)
        {
            var userTenants = mismatched.Select(x => x.User.TenantId).Distinct().ToList();
            var ownRoles = (await db.Roles.AcrossTenants()
                    .Where(r => userTenants.Contains(r.TenantId))
                    .Select(r => new { r.Id, r.TenantId, r.Slug })
                    .ToListAsync())
                .GroupBy(r => (r.TenantId, r.Slug))
                .ToDictionary(g => g.Key, g => g.Min(r => r.Id));
            foreach (var x in mismatched)
                if (ownRoles.TryGetValue((x.User.TenantId, x.Slug), out var ownRoleId)) x.User.RoleId = ownRoleId;
            await db.SaveChangesAsync();
        }

        // ── Module master + access grants ───────────────────────────────────────
        // Modules were upserted before the roles (above), so roles created this boot already
        // got their default grants. On the first boot after the module master replaced the old
        // role matrix and per-user module table, move what those held.
        if (legacyAccessToMove)
            await MoveLegacyAccessAsync(db);
        else if (newModuleKeys.Count > 0)
            await GrantNewDefaultModulesAsync(db, newModuleKeys);
        await PruneStaleModulesAsync(db);
    }

    /// <summary>Creates any missing system roles for a tenant. Idempotent. See <see cref="SystemRoles"/>.</summary>
    public static Task EnsureSystemRolesAsync(AppDbContext db, ulong tenantId, bool includeSuperAdmin) =>
        SystemRoles.EnsureAsync(db, tenantId, includeSuperAdmin);

    private static Task EnsureSystemRolesAsync(AppDbContext db, IReadOnlyCollection<(ulong TenantId, bool IncludeSuperAdmin)> tenants) =>
        SystemRoles.EnsureAsync(db, tenants);

    // ── Module master ─────────────────────────────────────────────────────────

    /// <summary>
    /// Inserts or updates every <see cref="ModuleCatalog"/> row by key (parents come first in the
    /// catalog). Returns the keys inserted this boot.
    /// </summary>
    private static async Task<List<string>> UpsertModulesAsync(AppDbContext db)
    {
        var inserted = new List<string>();
        var existing = await db.Modules.ToDictionaryAsync(m => m.Key);
        var levels = new Dictionary<string, int>();

        foreach (var def in ModuleCatalog.All)
        {
            var level = def.ParentKey is null ? 1 : levels[def.ParentKey] + 1;
            levels[def.Key] = level;

            if (!existing.TryGetValue(def.Key, out var module))
            {
                module = new Module { Key = def.Key, CreatedAt = DateTime.UtcNow };
                inserted.Add(def.Key);
                db.Modules.Add(module);
                existing[def.Key] = module;
            }

            module.App          = def.App;
            module.Name         = def.Name;
            module.Icon         = def.Icon;
            module.Route        = def.Route;
            module.ApiModules   = def.ApiModules;
            module.Level        = level;
            module.SortOrder    = def.SortOrder;
            module.HideFromMenu = def.HideFromMenu;
            module.IsTab        = def.IsTab;
            module.AdminOnly    = def.AdminOnly;
            module.Parent       = def.ParentKey is null ? null : existing[def.ParentKey];
        }

        await db.SaveChangesAsync();
        return inserted;
    }

    /// <summary>
    /// A module added to the catalog after roles already exist (e.g. the shop) is given to the
    /// built-in roles whose defaults include it — once, in the boot that creates it, so a module an
    /// admin later takes away from a role stays away.
    /// </summary>
    private static async Task GrantNewDefaultModulesAsync(AppDbContext db, List<string> newKeys)
    {
        var builtIn = new[] { RoleNames.Admin, RoleNames.Trainer, RoleNames.Client };
        var modules = await db.Modules.Where(m => newKeys.Contains(m.Key)).ToDictionaryAsync(m => m.Key, m => m.Id);
        var moduleIds = modules.Values.ToList();
        var granted = (await db.RoleModuleGrants.AcrossTenants()
                .Where(g => moduleIds.Contains(g.ModuleId))
                .Select(g => new { g.RoleId, g.ModuleId })
                .ToListAsync())
            .Select(g => (g.RoleId, g.ModuleId))
            .ToHashSet();
        foreach (var role in await db.Roles.AcrossTenants().Where(r => builtIn.Contains(r.Slug)).ToListAsync())
        {
            foreach (var key in ModuleCatalog.DefaultKeysFor(role.Slug).Where(modules.ContainsKey))
            {
                var moduleId = modules[key];
                if (!granted.Add((role.Id, moduleId))) continue;
                db.RoleModuleGrants.Add(new RoleModuleGrant
                {
                    TenantId = role.TenantId, RoleId = role.Id, ModuleId = moduleId,
                    CanView = true, CanCreate = true, CanEdit = true, CanDelete = true, CanExport = true,
                });
            }
        }
        await db.SaveChangesAsync();
    }

    /// <summary>Removes modules no longer in the catalog, deepest first, with their grants.</summary>
    private static async Task PruneStaleModulesAsync(AppDbContext db)
    {
        var currentKeys = ModuleCatalog.All.Select(m => m.Key).ToArray();
        var stale = await db.Modules.Where(m => !currentKeys.Contains(m.Key)).OrderByDescending(m => m.Level).ToListAsync();
        if (stale.Count == 0) return;

        var staleIds = stale.Select(m => m.Id).ToList();
        db.UserModuleAccesses.RemoveRange(db.UserModuleAccesses.Where(a => staleIds.Contains(a.ModuleId)));
        db.RoleModuleGrants.RemoveRange(db.RoleModuleGrants.AcrossTenants().Where(g => staleIds.Contains(g.ModuleId)));
        foreach (var module in stale)
        {
            db.Modules.Remove(module);
            await db.SaveChangesAsync();
        }
    }

    public static Task GrantDefaultModulesAsync(AppDbContext db, Role role) => SystemRoles.GrantDefaultModulesAsync(db, [role]);

    private static Task GrantDefaultModulesAsync(AppDbContext db, IReadOnlyCollection<Role> roles) =>
        SystemRoles.GrantDefaultModulesAsync(db, roles);

    /// <summary>
    /// One-time move from the old access tables into the module master's grants, keeping what
    /// everyone could see:
    /// <list type="bullet">
    /// <item>Built-in roles get their default modules.</item>
    /// <item>Old role-matrix rows (role + API key) become grants on the admin modules that use that
    /// key. For the admin role, a matrix row replaces the full default (it was a restriction).</item>
    /// <item>Old per-user switches that were on, for trainers and members, become per-user Allow
    /// overrides on their app's modules that use that key. Admins' and staff's per-user rows never
    /// had an effect and are dropped.</item>
    /// </list>
    /// The old rows are removed afterwards; the old modules go with <see cref="PruneStaleModulesAsync"/>.
    /// </summary>
    private static async Task MoveLegacyAccessAsync(AppDbContext db)
    {
        var modules = await db.Modules.Where(m => m.App != "").ToListAsync();
        var builtIn = new[] { RoleNames.Admin, RoleNames.Trainer, RoleNames.Client };
        await GrantDefaultModulesAsync(db, await db.Roles.AcrossTenants().Where(r => builtIn.Contains(r.Slug)).ToListAsync());

        List<Module> AppModulesFor(string app, string apiKey) =>
            modules.Where(m => m.App == app && ModuleCatalog.SplitApiModules(m.ApiModules).Contains(apiKey)).ToList();

        // Role matrix → role grants.
        var matrix = await db.ModuleAccesses.AcrossTenants().Include(m => m.Role).Where(m => m.IsActive).ToListAsync();
        var grants = await db.RoleModuleGrants.AcrossTenants().ToListAsync();
        var replacedForAdmin = new HashSet<(ulong RoleId, ulong ModuleId)>();
        foreach (var row in matrix.Where(r => r.Role.Slug != RoleNames.SuperAdmin))
        {
            var isAdminRole = row.Role.Slug == RoleNames.Admin;
            foreach (var module in AppModulesFor(ModuleCatalog.AdminApp, row.Module).Where(m => isAdminRole || !m.AdminOnly))
            {
                var grant = grants.FirstOrDefault(g => g.RoleId == row.RoleId && g.ModuleId == module.Id);
                if (grant is null)
                {
                    grant = new RoleModuleGrant { TenantId = row.TenantId, RoleId = row.RoleId, ModuleId = module.Id, CanView = false };
                    db.RoleModuleGrants.Add(grant);
                    grants.Add(grant);
                }
                else if (isAdminRole && replacedForAdmin.Add((row.RoleId, module.Id)))
                {
                    grant.CanView = grant.CanCreate = grant.CanEdit = grant.CanDelete = grant.CanExport = false;
                }
                grant.CanView   |= row.CanView;
                grant.CanCreate |= row.CanCreate;
                grant.CanEdit   |= row.CanEdit;
                grant.CanDelete |= row.CanDelete;
                grant.CanExport |= row.CanExport;
            }
        }
        // A grant that ended up with no view is a hidden module — drop it rather than keep an empty row.
        foreach (var grant in grants.Where(g => !g.CanView))
            db.RoleModuleGrants.Remove(grant);
        db.ModuleAccesses.RemoveRange(matrix);

        // Per-user switches → per-user overrides (trainers and members only).
        var legacyRows = await db.UserModuleAccesses
            .Where(a => a.IsEnabled && a.Module.App == "")
            .Select(a => new { Access = a, a.Module.Key, RoleSlug = db.Roles.IgnoreQueryFilters().Where(r => r.Id == a.User.RoleId).Select(r => r.Slug).FirstOrDefault() })
            .ToListAsync();
        var overrides = await db.UserModuleAccesses.Where(a => a.Module.App != "").ToListAsync();
        foreach (var row in legacyRows.Where(r => r.RoleSlug is RoleNames.Trainer or RoleNames.Client))
        {
            foreach (var module in AppModulesFor(ModuleCatalog.AppForRole(row.RoleSlug!), row.Key))
            {
                var existing = overrides.FirstOrDefault(o => o.UserId == row.Access.UserId && o.ModuleId == module.Id);
                if (existing is null)
                {
                    existing = new UserModuleAccess
                    {
                        UserId = row.Access.UserId, ModuleId = module.Id, IsEnabled = true,
                        CanAdd = false, CanEdit = false, CanDelete = false,
                        GrantedByAdminId = row.Access.GrantedByAdminId, GrantedAt = row.Access.GrantedAt,
                    };
                    db.UserModuleAccesses.Add(existing);
                    overrides.Add(existing);
                }
                existing.CanAdd    |= row.Access.CanAdd;
                existing.CanEdit   |= row.Access.CanEdit;
                existing.CanDelete |= row.Access.CanDelete;
            }
        }

        await db.SaveChangesAsync();
    }
}
