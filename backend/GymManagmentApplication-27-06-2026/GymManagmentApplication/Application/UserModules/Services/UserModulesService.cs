using GymManagmentApplication.Application.UserModules.Interfaces;
using GymManagmentApplication.Application.UserModules.Requests;
using GymManagmentApplication.Application.UserModules.Responses;
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

    public async Task<List<UserModuleAccessResponse>> GetUserModulesAsync(ulong userId)
    {
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
                GrantedAt = a?.GrantedAt
            };
        }).ToList();
    }

    public async Task<List<UserModuleAccessResponse>> SetUserModulesAsync(ulong userId, ulong? adminId, UpdateUserModulesRequest request)
    {
        var modules = await db.Modules.ToDictionaryAsync(m => m.Key, StringComparer.OrdinalIgnoreCase);
        var existing = await db.UserModuleAccesses.Where(a => a.UserId == userId).ToListAsync();
        var nextId = (await db.UserModuleAccesses.MaxAsync(a => (ulong?)a.Id) ?? 0) + 1;

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
}
