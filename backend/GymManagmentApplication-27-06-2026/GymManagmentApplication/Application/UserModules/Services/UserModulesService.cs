using GymManagmentApplication.Application.UserModules.Interfaces;
using GymManagmentApplication.Application.UserModules.Requests;
using GymManagmentApplication.Application.UserModules.Responses;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.UserModules.Services;

public class UserModulesService(AppDbContext db) : IUserModulesService
{
    public async Task<List<ModuleResponse>> GetAllModulesAsync() =>
        await db.Modules
            .OrderBy(m => m.Name)
            .Select(m => new ModuleResponse { Id = m.Id, Key = m.Key, Name = m.Name, Description = m.Description, Icon = m.Icon })
            .ToListAsync();

    // UserModuleAccess has no TenantId, so it isn't covered by the tenant query filter.
    // Users is — checking the target user through it confines admins to their own gym.
    private Task<bool> UserInScopeAsync(ulong userId) =>
        db.Users.AnyAsync(u => u.Id == userId && u.DeletedAt == null);

    public async Task<List<UserModuleAccessResponse>?> GetUserModulesAsync(ulong userId)
    {
        if (!await UserInScopeAsync(userId)) return null;
        var modules = await db.Modules.OrderBy(m => m.Name).ToListAsync();
        var access = await db.UserModuleAccesses
            .Where(a => a.UserId == userId)
            .ToDictionaryAsync(a => a.ModuleId);

        return modules.Select(m =>
        {
            access.TryGetValue(m.Id, out var a);
            return new UserModuleAccessResponse
            {
                ModuleId = m.Id,
                Key = m.Key,
                Name = m.Name,
                Description = m.Description,
                Icon = m.Icon,
                IsEnabled = a?.IsEnabled ?? false,
                CanAdd = a?.CanAdd ?? true,
                CanEdit = a?.CanEdit ?? true,
                CanDelete = a?.CanDelete ?? true,
                GrantedAt = a?.GrantedAt
            };
        }).ToList();
    }

    public async Task<List<UserModuleAccessResponse>?> SetUserModulesAsync(ulong userId, ulong? adminId, UpdateUserModulesRequest request)
    {
        if (!await UserInScopeAsync(userId)) return null;
        var modules = await db.Modules.ToDictionaryAsync(m => m.Key, StringComparer.OrdinalIgnoreCase);
        var existing = await db.UserModuleAccesses.Where(a => a.UserId == userId).ToListAsync();
        var nextId = (await db.UserModuleAccesses.IgnoreQueryFilters().MaxAsync(a => (ulong?)a.Id) ?? 0) + 1;

        foreach (var toggle in request.Modules)
        {
            if (!modules.TryGetValue(toggle.Key, out var module)) continue; // ignore unknown keys

            var row = existing.FirstOrDefault(a => a.ModuleId == module.Id);
            if (row is null)
            {
                row = new Domain.Entities.Identity.UserModuleAccess
                {
                    Id = nextId++,
                    UserId = userId,
                    ModuleId = module.Id,
                };
                db.UserModuleAccesses.Add(row);
                existing.Add(row);
            }

            row.IsEnabled = toggle.IsEnabled;
            row.CanAdd = toggle.CanAdd;
            row.CanEdit = toggle.CanEdit;
            row.CanDelete = toggle.CanDelete;
            row.GrantedByAdminId = adminId;
            row.GrantedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();
        return await GetUserModulesAsync(userId);
    }

    public async Task<bool> HasModuleAsync(ulong userId, string moduleKey)
    {
        var module = await db.Modules.FirstOrDefaultAsync(m => m.Key == moduleKey);
        if (module is null) return false; // fail closed — unknown module key

        var access = await db.UserModuleAccesses
            .FirstOrDefaultAsync(a => a.UserId == userId && a.ModuleId == module.Id);
        return access?.IsEnabled ?? false;
    }

    public async Task<bool> CanAsync(ulong userId, string moduleKey, string action)
    {
        var module = await db.Modules.FirstOrDefaultAsync(m => m.Key == moduleKey);
        if (module is null) return false; // fail closed — unknown module key

        var access = await db.UserModuleAccesses.IgnoreQueryFilters()
            .FirstOrDefaultAsync(a => a.UserId == userId && a.ModuleId == module.Id);

        if (access is null)
        {
            // No explicit record for this user/module. Admins' access is a privilege, dialed
            // down by exception — they default to allowed. Everyone else must be granted
            // the module explicitly (existing trainer/client behaviour, unchanged).
            var roleSlug = await db.Users.IgnoreQueryFilters()
                .Where(u => u.Id == userId)
                .Join(db.Roles.IgnoreQueryFilters(), u => u.RoleId, r => r.Id, (u, r) => r.Slug)
                .FirstOrDefaultAsync();
            return roleSlug == RoleNames.Admin || roleSlug == RoleNames.SuperAdmin;
        }

        if (!access.IsEnabled) return false;
        return action switch
        {
            "view"   => true,
            "create" => access.CanAdd,
            "edit"   => access.CanEdit,
            "delete" => access.CanDelete,
            _        => false
        };
    }
}
