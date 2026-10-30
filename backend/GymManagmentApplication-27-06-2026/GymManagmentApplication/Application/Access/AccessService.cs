using System.Text.Json;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace GymManagmentApplication.Application.Access;

public interface IAccessService
{
    /// <summary>The signed-in user's granted menu modules (no tabs), parents included, sorted.</summary>
    Task<List<AccessModuleResponse>> GetMyModulesAsync(string? lang);
    /// <summary>The signed-in user's granted tabs — under one page, or all of them when <paramref name="parentKey"/> is null.</summary>
    Task<List<AccessModuleResponse>> GetMyTabsAsync(string? parentKey, string? lang);
    /// <summary>
    /// Whether a user may perform <paramref name="action"/> on an API permission key — through a
    /// granted module of any app, or only of <paramref name="apps"/> when given.
    /// </summary>
    Task<bool> CanAsync(ulong userId, string roleSlug, string apiModule, string action, IReadOnlyCollection<string>? apps = null);

    Task<List<ModuleTreeRow>> GetModuleTreeAsync(string? app);
    Task<RoleGrantsResponse> GetRoleGrantsAsync(ulong roleId);
    Task<RoleGrantsResponse> SetRoleGrantsAsync(ulong roleId, SetRoleGrantsRequest request);
    Task<UserAccessResponse> GetUserAccessAsync(ulong userId);
    Task<UserAccessResponse> SetUserOverridesAsync(ulong userId, ulong adminId, SetUserOverridesRequest request);
    Task<List<ExtraRoleDto>> GetExtraRolesAsync(ulong userId);
    Task<List<ExtraRoleDto>> AddExtraRoleAsync(ulong userId, ulong roleId);
    Task<List<ExtraRoleDto>> RemoveExtraRoleAsync(ulong userId, ulong roleId);
}

/// <summary>
/// The single access decision for every role and app. A user's modules are worked out as:
/// <list type="number">
/// <item>Their primary role plus every additional role.</item>
/// <item>The union of those roles' grants (flags OR-ed).</item>
/// <item>Their per-user overrides on top — Allow sets the module with exactly its flags, Deny removes it.</item>
/// <item>Modules of every app: any role can be granted any module. The primary role's app is where
/// the person signs in; the other apps they hold modules in can be switched to.</item>
/// <item>Every granted module's ancestors, so menus have no orphans. Ancestors pulled in this way
/// open no API — only real grants do.</item>
/// </list>
/// Super admins get every admin-app module. Results are cached for 30 seconds per user (the same
/// window as the token check); any grant change bumps a version so the next request recomputes.
/// </summary>
public class AccessService(AppDbContext db, ICurrentUser currentUser, IMemoryCache cache) : IAccessService
{
    private static long _version;
    private static readonly TimeSpan CacheFor = TimeSpan.FromSeconds(30);

    private sealed record Effective(Module Module, bool Implied, bool CanView, bool CanCreate, bool CanEdit, bool CanDelete, bool CanExport);

    private sealed record Flags(bool View, bool Create, bool Edit, bool Delete, bool Export)
    {
        public Flags Or(Flags o) => new(View || o.View, Create || o.Create, Edit || o.Edit, Delete || o.Delete, Export || o.Export);
    }

    // ── The signed-in user ────────────────────────────────────────────────

    public async Task<List<AccessModuleResponse>> GetMyModulesAsync(string? lang) =>
        (await GetEffectiveAsync(RequireUserId()))
            .Where(e => !e.Module.IsTab)
            .Select(e => ToResponse(e, lang))
            .ToList();

    public async Task<List<AccessModuleResponse>> GetMyTabsAsync(string? parentKey, string? lang) =>
        (await GetEffectiveAsync(RequireUserId()))
            .Where(e => e.Module.IsTab && (parentKey == null || e.Module.Parent?.Key == parentKey))
            .Select(e => ToResponse(e, lang))
            .ToList();

    public async Task<bool> CanAsync(ulong userId, string roleSlug, string apiModule, string action, IReadOnlyCollection<string>? apps = null)
    {
        if (roleSlug.Equals(RoleNames.SuperAdmin, StringComparison.OrdinalIgnoreCase)) return true;

        var granted = (await GetEffectiveAsync(userId)).Any(e =>
            !e.Implied &&
            (apps == null || apps.Contains(e.Module.App)) &&
            ModuleCatalog.SplitApiModules(e.Module.ApiModules).Contains(apiModule) &&
            action switch
            {
                "view"   => e.CanView,
                "create" => e.CanCreate,
                "edit"   => e.CanEdit,
                "delete" => e.CanDelete,
                "export" => e.CanExport,
                _        => false
            });
        if (granted || RoleNames.IsBuiltIn(roleSlug)) return granted;

        // Staff/custom roles may also hold fine-grained "module.action" permissions.
        var roleId = await db.Users.IgnoreQueryFilters().Where(u => u.Id == userId).Select(u => u.RoleId).FirstOrDefaultAsync();
        return await db.RolePermissions.AnyAsync(rp =>
            rp.RoleId == roleId && rp.Permission.Module == apiModule && rp.Permission.Action == action);
    }

    private async Task<List<Effective>> GetEffectiveAsync(ulong userId)
    {
        var key = $"access:{Interlocked.Read(ref _version)}:{userId}";
        if (cache.TryGetValue(key, out List<Effective>? hit) && hit is not null) return hit;

        var result = await ComputeEffectiveAsync(userId);
        cache.Set(key, result, CacheFor);
        return result;
    }

    private async Task<List<Effective>> ComputeEffectiveAsync(ulong userId)
    {
        var user = await db.Users.IgnoreQueryFilters()
            .Where(u => u.Id == userId)
            .Select(u => new { u.TenantId, u.RoleId, Slug = db.Roles.IgnoreQueryFilters().Where(r => r.Id == u.RoleId).Select(r => r.Slug).FirstOrDefault() })
            .FirstOrDefaultAsync();
        if (user?.Slug is null) return [];

        // No tracking: these rows are cached and outlive this request's context.
        var modules = await db.Modules.AsNoTracking().Include(m => m.Parent).ToListAsync();
        var byId = modules.ToDictionary(m => m.Id);

        var granted = new Dictionary<ulong, Flags>();
        if (user.Slug == RoleNames.SuperAdmin)
        {
            foreach (var m in modules.Where(m => m.App == ModuleCatalog.AdminApp)) granted[m.Id] = new Flags(true, true, true, true, true);
        }
        else
        {
            var roleIds = await db.UserRoles.Where(ur => ur.UserId == userId).Select(ur => ur.RoleId).ToListAsync();
            roleIds.Add(user.RoleId);

            var roleGrants = await db.RoleModuleGrants.IgnoreQueryFilters()
                .Where(g => roleIds.Contains(g.RoleId) && g.TenantId == user.TenantId && g.CanView)
                .ToListAsync();
            foreach (var g in roleGrants.Where(g => byId.ContainsKey(g.ModuleId)))
            {
                var flags = new Flags(true, g.CanCreate, g.CanEdit, g.CanDelete, g.CanExport);
                granted[g.ModuleId] = granted.TryGetValue(g.ModuleId, out var prev) ? prev.Or(flags) : flags;
            }

            var overrides = await db.UserModuleAccesses.Where(a => a.UserId == userId).ToListAsync();
            foreach (var o in overrides.Where(o => byId.ContainsKey(o.ModuleId)))
            {
                if (o.IsEnabled) granted[o.ModuleId] = new Flags(true, o.CanAdd, o.CanEdit, o.CanDelete, false);
                else granted.Remove(o.ModuleId);
            }
        }

        var result = granted.Select(kv => new Effective(byId[kv.Key], false,
            kv.Value.View, kv.Value.Create, kv.Value.Edit, kv.Value.Delete, kv.Value.Export)).ToList();

        // Ancestors, so no granted module is an orphan in the menu.
        var have = granted.Keys.ToHashSet();
        foreach (var e in result.ToList())
        {
            for (var p = e.Module.ParentId; p is { } pid && byId.ContainsKey(pid); p = byId[pid].ParentId)
            {
                if (!have.Add(pid)) continue;
                result.Add(new Effective(byId[pid], true, true, false, false, false, false));
            }
        }

        return result
            .OrderBy(e => e.Module.Level)
            .ThenBy(e => e.Module.ParentId ?? 0)
            .ThenBy(e => e.Module.SortOrder)
            .ToList();
    }

    private static AccessModuleResponse ToResponse(Effective e, string? lang) => new(
        e.Module.Key, e.Module.App, LocalizedName(e.Module, lang), e.Module.Level, e.Module.Parent?.Key, e.Module.SortOrder,
        e.Module.Icon, e.Module.Route, e.Module.HideFromMenu, e.Module.IsTab,
        // A parent shown only so its granted children aren't orphaned opens no API.
        e.Implied ? [] : ModuleCatalog.SplitApiModules(e.Module.ApiModules),
        e.CanCreate, e.CanEdit, e.CanDelete, e.CanExport);

    private static string LocalizedName(Module module, string? lang)
    {
        if (string.IsNullOrWhiteSpace(lang) || string.IsNullOrWhiteSpace(module.NameTranslations)) return module.Name;
        try
        {
            var names = JsonSerializer.Deserialize<Dictionary<string, string>>(module.NameTranslations);
            return names is not null && names.TryGetValue(lang, out var name) && !string.IsNullOrWhiteSpace(name) ? name : module.Name;
        }
        catch (JsonException)
        {
            return module.Name;
        }
    }

    // ── Admin management ──────────────────────────────────────────────────

    public async Task<List<ModuleTreeRow>> GetModuleTreeAsync(string? app) =>
        (await db.Modules.Include(m => m.Parent)
            .Where(m => app == null || m.App == app)
            .OrderBy(m => m.App).ThenBy(m => m.Level).ThenBy(m => m.ParentId).ThenBy(m => m.SortOrder)
            .ToListAsync())
        .Select(m => new ModuleTreeRow(m.Key, m.App, m.Name, m.Level, m.Parent?.Key, m.SortOrder, m.Icon, m.Route,
            m.HideFromMenu, m.IsTab, m.AdminOnly, ModuleCatalog.SplitApiModules(m.ApiModules)))
        .ToList();

    public async Task<RoleGrantsResponse> GetRoleGrantsAsync(ulong roleId)
    {
        var role = await FindManageableRoleAsync(roleId);
        var grants = await db.RoleModuleGrants.Where(g => g.RoleId == role.Id)
            .Select(g => new ModuleGrantDto(g.Module.Key, g.CanView, g.CanCreate, g.CanEdit, g.CanDelete, g.CanExport))
            .ToListAsync();
        return new RoleGrantsResponse(role.Id, role.Name, role.Slug, ModuleCatalog.AppForRole(role.Slug), grants);
    }

    public async Task<RoleGrantsResponse> SetRoleGrantsAsync(ulong roleId, SetRoleGrantsRequest request)
    {
        var role = await FindManageableRoleAsync(roleId);
        var isAdminRole = role.Slug == RoleNames.Admin;
        var modules = await db.Modules.ToDictionaryAsync(m => m.Key);

        var wanted = new Dictionary<ulong, ModuleGrantDto>();
        foreach (var g in request.Grants.Where(g => g.CanView))
        {
            if (!modules.TryGetValue(g.ModuleKey, out var module))
                throw new ArgumentException($"'{g.ModuleKey}' is not a module.");
            if (module.AdminOnly && !isAdminRole)
                throw new ArgumentException($"'{module.Name}' can only be granted to the Admin role.");
            wanted[module.Id] = g;
        }

        // Admins must keep the screens that manage access, or nobody in the gym could restore it.
        if (isAdminRole)
            foreach (var key in new[] { "admin.roles", "admin.user-access" })
                if (modules.TryGetValue(key, out var keep) && !wanted.ContainsKey(keep.Id))
                    wanted[keep.Id] = new ModuleGrantDto(key, true, true, true, true, true);

        var existing = await db.RoleModuleGrants.Where(g => g.RoleId == role.Id).ToListAsync();
        db.RoleModuleGrants.RemoveRange(existing.Where(g => !wanted.ContainsKey(g.ModuleId)));
        foreach (var (moduleId, g) in wanted)
        {
            var row = existing.FirstOrDefault(e => e.ModuleId == moduleId);
            if (row is null)
            {
                row = new RoleModuleGrant { TenantId = role.TenantId, RoleId = role.Id, ModuleId = moduleId };
                db.RoleModuleGrants.Add(row);
            }
            row.CanView = true;
            row.CanCreate = g.CanCreate;
            row.CanEdit = g.CanEdit;
            row.CanDelete = g.CanDelete;
            row.CanExport = g.CanExport;
            row.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();
        Invalidate();
        return await GetRoleGrantsAsync(role.Id);
    }

    public async Task<UserAccessResponse> GetUserAccessAsync(ulong userId)
    {
        var user = await FindManageableUserAsync(userId);
        var app = ModuleCatalog.AppForRole(user.Role.Slug);

        var roleIds = await db.UserRoles.Where(ur => ur.UserId == userId).Select(ur => ur.RoleId).ToListAsync();
        roleIds.Add(user.RoleId);
        var fromRoles = (await db.RoleModuleGrants
                .Where(g => roleIds.Contains(g.RoleId) && g.CanView)
                .Select(g => new { g.Module.Key, g.CanCreate, g.CanEdit, g.CanDelete, g.CanExport })
                .ToListAsync())
            .GroupBy(g => g.Key)
            .Select(x => new ModuleGrantDto(x.Key, true,
                x.Any(g => g.CanCreate), x.Any(g => g.CanEdit), x.Any(g => g.CanDelete), x.Any(g => g.CanExport)))
            .ToList();

        var overrides = await db.UserModuleAccesses.Where(a => a.UserId == userId)
            .Select(a => new UserOverrideDto(a.Module.Key, a.IsEnabled, a.CanAdd, a.CanEdit, a.CanDelete))
            .ToListAsync();

        var effective = (await ComputeEffectiveAsync(userId))
            .Where(e => !e.Implied)
            .Select(e => new ModuleGrantDto(e.Module.Key, e.CanView, e.CanCreate, e.CanEdit, e.CanDelete, e.CanExport))
            .ToList();

        return new UserAccessResponse(userId, app, fromRoles, overrides, effective);
    }

    public async Task<UserAccessResponse> SetUserOverridesAsync(ulong userId, ulong adminId, SetUserOverridesRequest request)
    {
        var user = await FindManageableUserAsync(userId);
        var modules = await db.Modules.ToDictionaryAsync(m => m.Key);

        var wanted = new Dictionary<ulong, UserOverrideDto>();
        foreach (var o in request.Overrides)
        {
            if (!modules.TryGetValue(o.ModuleKey, out var module))
                throw new ArgumentException($"'{o.ModuleKey}' is not a module.");
            if (module.AdminOnly && o.IsEnabled && user.Role.Slug != RoleNames.Admin)
                throw new ArgumentException($"'{module.Name}' can only be granted to admins.");
            wanted[module.Id] = o;
        }

        var existing = await db.UserModuleAccesses.Where(a => a.UserId == userId).ToListAsync();
        db.UserModuleAccesses.RemoveRange(existing.Where(a => !wanted.ContainsKey(a.ModuleId)));
        foreach (var (moduleId, o) in wanted)
        {
            var row = existing.FirstOrDefault(e => e.ModuleId == moduleId);
            if (row is null)
            {
                row = new UserModuleAccess { UserId = userId, ModuleId = moduleId };
                db.UserModuleAccesses.Add(row);
            }
            row.IsEnabled = o.IsEnabled;
            row.CanAdd = o.CanAdd;
            row.CanEdit = o.CanEdit;
            row.CanDelete = o.CanDelete;
            row.GrantedByAdminId = adminId;
            row.GrantedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();
        Invalidate();
        return await GetUserAccessAsync(userId);
    }

    public async Task<List<ExtraRoleDto>> GetExtraRolesAsync(ulong userId)
    {
        await FindManageableUserAsync(userId);
        return await db.UserRoles.Where(ur => ur.UserId == userId)
            .OrderBy(ur => ur.Role.Name)
            .Select(ur => new ExtraRoleDto(ur.RoleId, ur.Role.Name, ur.Role.Slug))
            .ToListAsync();
    }

    public async Task<List<ExtraRoleDto>> AddExtraRoleAsync(ulong userId, ulong roleId)
    {
        var user = await FindManageableUserAsync(userId);
        var role = await db.Roles.FirstOrDefaultAsync(r => r.Id == roleId && r.TenantId == user.TenantId)
            ?? throw new KeyNotFoundException($"Role {roleId} not found in this gym.");
        if (role.Slug == RoleNames.SuperAdmin)
            throw new ArgumentException("Super admin can't be given as an additional role.");
        if (role.Id == user.RoleId)
            throw new ArgumentException("That is already the user's main role.");

        if (!await db.UserRoles.AnyAsync(ur => ur.UserId == userId && ur.RoleId == roleId))
        {
            db.UserRoles.Add(new UserRole { UserId = userId, RoleId = roleId });
            await db.SaveChangesAsync();
            Invalidate();
        }
        return await GetExtraRolesAsync(userId);
    }

    public async Task<List<ExtraRoleDto>> RemoveExtraRoleAsync(ulong userId, ulong roleId)
    {
        await FindManageableUserAsync(userId);
        var row = await db.UserRoles.FirstOrDefaultAsync(ur => ur.UserId == userId && ur.RoleId == roleId);
        if (row is not null)
        {
            db.UserRoles.Remove(row);
            await db.SaveChangesAsync();
            Invalidate();
        }
        return await GetExtraRolesAsync(userId);
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    /// <summary>Drops every cached result; the next request per user recomputes.</summary>
    public static void Invalidate() => Interlocked.Increment(ref _version);

    private ulong RequireUserId() =>
        currentUser.UserId ?? throw new UnauthorizedAccessException("Unauthorized. Token is missing or invalid.");

    /// <summary>A role of the caller's gym (tenant filter applies). Super admin's role is never edited.</summary>
    private async Task<Role> FindManageableRoleAsync(ulong roleId)
    {
        var role = await db.Roles.FirstOrDefaultAsync(r => r.Id == roleId)
            ?? throw new KeyNotFoundException($"Role {roleId} not found.");
        if (role.Slug == RoleNames.SuperAdmin)
            throw new ArgumentException("Super admin always has access to everything.");
        return role;
    }

    /// <summary>A user of the caller's gym (tenant filter applies), not a super admin unless the caller is one.</summary>
    private async Task<User> FindManageableUserAsync(ulong userId)
    {
        var user = await db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == userId)
            ?? throw new KeyNotFoundException($"User {userId} not found.");
        if (user.Role.Slug == RoleNames.SuperAdmin && !currentUser.IsSuperAdmin)
            throw new UnauthorizedAccessException("Only a super admin can change a super admin's access.");
        return user;
    }
}
