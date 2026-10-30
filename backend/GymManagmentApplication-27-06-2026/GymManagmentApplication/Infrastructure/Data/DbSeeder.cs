using GymManagmentApplication.Application.Access;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Domain.Entities.Core;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Infrastructure.Data;

public static class DbSeeder
{
    /// <summary>
    /// Ensures the default Tenant and system Roles exist in the database.
    /// Safe to call on every startup — skips inserts when rows already exist.
    /// </summary>
    public static async Task SeedAsync(AppDbContext db)
    {
        // ── Tenant ────────────────────────────────────────────────────────────
        if (!await db.Tenants.AnyAsync())
        {
            var tenantId = await GetNextIdAsync(db, "Tenants");
            db.Tenants.Add(new Tenant
            {
                Id        = tenantId,
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
        var legacyAccessToMove = !await db.RoleModuleGrants.IgnoreQueryFilters().AnyAsync();
        await UpsertModulesAsync(db);

        // ── Roles ─────────────────────────────────────────────────────────────
        // Every tenant gets its own copy of the system roles (role checks are by slug, but
        // users must hold a role row from their own tenant). The platform tenant — the first
        // one — additionally owns the 'superadmin' role.
        var platformTenant = await db.Tenants.OrderBy(t => t.Id).FirstAsync();
        var superRoleIsNew = !await db.Roles.AnyAsync(r => r.TenantId == platformTenant.Id && r.Slug == RoleNames.SuperAdmin);
        await EnsureSystemRolesAsync(db, platformTenant.Id, includeSuperAdmin: true);
        foreach (var tenantId in await db.Tenants.Where(t => t.Id != platformTenant.Id).Select(t => t.Id).ToListAsync())
            await EnsureSystemRolesAsync(db, tenantId, includeSuperAdmin: false);

        // One-time bootstrap: before 'superadmin' existed, the platform tenant's admin managed
        // all gyms. Promote the earliest such admin so tenant management stays reachable.
        // Runs only in the deploy that creates the role — never again — so archiving the super
        // admin can't be used to get some other admin promoted on the next restart.
        var superRole = await db.Roles.FirstAsync(r => r.TenantId == platformTenant.Id && r.Slug == RoleNames.SuperAdmin);
        if (superRoleIsNew && !await db.Users.AnyAsync(u => u.RoleId == superRole.Id && u.DeletedAt == null))
        {
            var adminRoleIds = await db.Roles.Where(r => r.Slug == RoleNames.Admin).Select(r => r.Id).ToListAsync();
            var firstAdmin = await db.Users
                .Where(u => adminRoleIds.Contains(u.RoleId) && u.TenantId == platformTenant.Id && u.DeletedAt == null)
                .OrderBy(u => u.Id)
                .FirstOrDefaultAsync();
            if (firstAdmin is not null)
            {
                firstAdmin.RoleId = superRole.Id;
                await db.SaveChangesAsync();
            }
        }

        // Repair users whose RoleId points at a role from another tenant (older seeds only
        // created roles for the first tenant): move them to the same-slug role in their own tenant.
        var mismatched = await db.Users
            .Join(db.Roles, u => u.RoleId, r => r.Id, (u, r) => new { User = u, r.Slug, RoleTenant = r.TenantId })
            .Where(x => x.RoleTenant != x.User.TenantId && x.Slug != RoleNames.SuperAdmin)
            .ToListAsync();
        foreach (var x in mismatched)
        {
            var ownRole = await db.Roles.FirstOrDefaultAsync(r => r.TenantId == x.User.TenantId && r.Slug == x.Slug);
            if (ownRole is not null) x.User.RoleId = ownRole.Id;
        }
        if (mismatched.Count > 0) await db.SaveChangesAsync();

        // ── Module master + access grants ───────────────────────────────────────
        // Modules were upserted before the roles (above), so roles created this boot already
        // got their default grants. On the first boot after the module master replaced the old
        // role matrix and per-user module table, move what those held.
        if (legacyAccessToMove)
            await MoveLegacyAccessAsync(db);
        await PruneStaleModulesAsync(db);
    }

    /// <summary>Creates any missing system roles for a tenant. Idempotent.</summary>
    public static async Task EnsureSystemRolesAsync(AppDbContext db, ulong tenantId, bool includeSuperAdmin)
    {
        var roles = RoleNames.TenantSystemRoles.AsEnumerable();
        if (includeSuperAdmin)
            roles = roles.Prepend((RoleNames.SuperAdmin, "Super Admin", "Platform-wide access across all gyms"));

        foreach (var (slug, name, desc) in roles)
        {
            if (await db.Roles.IgnoreQueryFilters().AnyAsync(r => r.TenantId == tenantId && r.Slug == slug))
                continue;

            var role = new Role
            {
                Id          = await GetNextIdAsync(db, "Roles"),
                TenantId    = tenantId,
                Name        = name,
                Slug        = slug,
                Description = desc,
                IsSystem    = true,
                CreatedAt   = DateTime.UtcNow
            };
            db.Roles.Add(role);
            await db.SaveChangesAsync();
            await GrantDefaultModulesAsync(db, role);
        }
    }

    // ── Module master ─────────────────────────────────────────────────────────

    /// <summary>Inserts or updates every <see cref="ModuleCatalog"/> row by key. Parents come first in the catalog.</summary>
    private static async Task UpsertModulesAsync(AppDbContext db)
    {
        var existing = await db.Modules.ToDictionaryAsync(m => m.Key);
        var levels = new Dictionary<string, int>();

        foreach (var def in ModuleCatalog.All)
        {
            var level = def.ParentKey is null ? 1 : levels[def.ParentKey] + 1;
            levels[def.Key] = level;

            if (!existing.TryGetValue(def.Key, out var module))
            {
                module = new Module { Key = def.Key, CreatedAt = DateTime.UtcNow };
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
    }

    /// <summary>Removes modules no longer in the catalog, deepest first, with their grants.</summary>
    private static async Task PruneStaleModulesAsync(AppDbContext db)
    {
        var currentKeys = ModuleCatalog.All.Select(m => m.Key).ToArray();
        var stale = await db.Modules.Where(m => !currentKeys.Contains(m.Key)).OrderByDescending(m => m.Level).ToListAsync();
        if (stale.Count == 0) return;

        var staleIds = stale.Select(m => m.Id).ToList();
        db.UserModuleAccesses.RemoveRange(db.UserModuleAccesses.Where(a => staleIds.Contains(a.ModuleId)));
        db.RoleModuleGrants.RemoveRange(db.RoleModuleGrants.IgnoreQueryFilters().Where(g => staleIds.Contains(g.ModuleId)));
        foreach (var module in stale)
        {
            db.Modules.Remove(module);
            await db.SaveChangesAsync();
        }
    }

    /// <summary>Gives a built-in role its <see cref="ModuleCatalog.DefaultKeysFor"/> modules, with every action allowed.</summary>
    public static async Task GrantDefaultModulesAsync(AppDbContext db, Role role)
    {
        var keys = ModuleCatalog.DefaultKeysFor(role.Slug).ToList();
        if (keys.Count == 0) return;

        var moduleIds = await db.Modules.Where(m => keys.Contains(m.Key)).Select(m => m.Id).ToListAsync();
        var granted = await db.RoleModuleGrants.IgnoreQueryFilters()
            .Where(g => g.RoleId == role.Id).Select(g => g.ModuleId).ToListAsync();

        foreach (var moduleId in moduleIds.Except(granted))
            db.RoleModuleGrants.Add(new RoleModuleGrant
            {
                TenantId = role.TenantId, RoleId = role.Id, ModuleId = moduleId,
                CanView = true, CanCreate = true, CanEdit = true, CanDelete = true, CanExport = true,
            });
        await db.SaveChangesAsync();
    }

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
        foreach (var role in await db.Roles.IgnoreQueryFilters().Where(r => builtIn.Contains(r.Slug)).ToListAsync())
            await GrantDefaultModulesAsync(db, role);

        List<Module> AppModulesFor(string app, string apiKey) =>
            modules.Where(m => m.App == app && ModuleCatalog.SplitApiModules(m.ApiModules).Contains(apiKey)).ToList();

        // Role matrix → role grants.
        var matrix = await db.ModuleAccesses.IgnoreQueryFilters().Include(m => m.Role).Where(m => m.IsActive).ToListAsync();
        var grants = await db.RoleModuleGrants.IgnoreQueryFilters().ToListAsync();
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

    /// <summary>
    /// Returns MAX("Id") + 1 for a table, or 1 if the table is empty.
    /// Uses raw ADO.NET to avoid EF scalar query quirks.
    /// </summary>
    private static async Task<ulong> GetNextIdAsync(AppDbContext db, string tableName)
    {
        var conn = db.Database.GetDbConnection();
        var wasOpen = conn.State == System.Data.ConnectionState.Open;
        if (!wasOpen) await conn.OpenAsync();

        try
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = $"SELECT COALESCE(MAX(\"Id\"), 0) FROM \"{tableName}\"";
            var result = await cmd.ExecuteScalarAsync();
            // result is decimal for numeric(20,0) in Npgsql
            var maxId = result is DBNull or null ? 0UL : (ulong)Convert.ToDecimal(result);
            return maxId + 1;
        }
        finally
        {
            if (!wasOpen) await conn.CloseAsync();
        }
    }
}
