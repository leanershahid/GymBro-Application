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

        // ── Feature modules (per-user gate-able areas) ──────────────────────────
        // Split into finer-grained toggles than the original 4 — each maps to a
        // narrower slice of functionality so access can be tuned per person.
        var seedModules = new[]
        {
            ("workouts",      "Workouts",         "Browsing and completing assigned workouts", "activity"),
            ("exercises",     "Exercise Library",  "Exercise library browsing and management", "zap"),
            ("plans",         "Plans & Progress",  "Assigned training plans and progress tracking", "book-open"),
            ("challenges",    "Challenges",        "Community challenges and leaderboards", "award"),
            ("live-coaching", "Live Coaching",     "Live coach discovery and booking", "video"),
            ("stats",         "Stats",             "Daily health metrics and streaks", "bar-chart-2"),
            ("ai-coach",      "AI Coach",          "AI-generated recovery and training tips", "cpu"),

            // Admin-area modules — gate-able per user (including admins themselves) via
            // RequireModuleAttribute on their controllers. An admin with no explicit row here
            // defaults to allowed (see IUserModulesService.CanAsync), so adding these keys
            // never locks out an existing admin; it only takes effect once someone explicitly
            // restricts a specific user's access.
            ("members",  "Members",  "Viewing and managing gym members", "users"),
            ("trainers", "Trainers", "Viewing and managing trainers", "award"),
            ("branches", "Branches", "Viewing and managing branches", "map-pin"),
        };

        foreach (var (key, name, desc, icon) in seedModules)
        {
            if (await db.Modules.AnyAsync(m => m.Key == key))
                continue;

            var moduleId = await GetNextIdAsync(db, "Modules");
            db.Modules.Add(new Module
            {
                Id          = moduleId,
                Key         = key,
                Name        = name,
                Description = desc,
                Icon        = icon,
                CreatedAt   = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        // Prune modules from an earlier, coarser seed list that this split replaces.
        var currentKeys = seedModules.Select(m => m.Item1).ToArray();
        var staleModules = await db.Modules.Where(m => !currentKeys.Contains(m.Key)).ToListAsync();
        if (staleModules.Count > 0)
        {
            var staleIds = staleModules.Select(m => m.Id).ToList();
            var staleAccess = await db.UserModuleAccesses.Where(a => staleIds.Contains(a.ModuleId)).ToListAsync();
            db.UserModuleAccesses.RemoveRange(staleAccess);
            db.Modules.RemoveRange(staleModules);
            await db.SaveChangesAsync();
        }
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

            db.Roles.Add(new Role
            {
                Id          = await GetNextIdAsync(db, "Roles"),
                TenantId    = tenantId,
                Name        = name,
                Slug        = slug,
                Description = desc,
                IsSystem    = true,
                CreatedAt   = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }
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
