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
        var tenantRow = await db.Tenants.OrderBy(t => t.Id).FirstAsync();

        var seedRoles = new[]
        {
            ("admin",   "Admin",   "Full system access"),
            ("trainer", "Trainer", "Trainer access"),
            ("client",  "Client",  "Member/client access"),
            ("staff",   "Staff",   "Staff access"),
        };

        foreach (var (slug, name, desc) in seedRoles)
        {
            if (await db.Roles.AnyAsync(r => r.Slug == slug))
                continue;

            var roleId = await GetNextIdAsync(db, "Roles");
            db.Roles.Add(new Role
            {
                Id          = roleId,
                TenantId    = tenantRow.Id,
                Name        = name,
                Slug        = slug,
                Description = desc,
                IsSystem    = true,
                CreatedAt   = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

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
