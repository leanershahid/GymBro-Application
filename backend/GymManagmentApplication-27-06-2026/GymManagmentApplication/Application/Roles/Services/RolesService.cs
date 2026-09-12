using GymManagmentApplication.Application.Roles.Interfaces;
using GymManagmentApplication.Application.Roles.Requests;
using GymManagmentApplication.Application.Roles.Responses;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Roles.Services;

public class RolesService(AppDbContext db) : IRolesService
{
    public async Task<List<RoleResponse>> GetAllRolesAsync()
    {
        var roles = await db.Roles.Include(r => r.RolePermissions).ThenInclude(rp => rp.Permission).ToListAsync();
        return roles.Select(Map).ToList();
    }

    public async Task<RoleResponse> CreateRoleAsync(CreateRoleRequest request)
    {
        var maxId = await db.Roles.MaxAsync(r => (ulong?)r.Id) ?? 0;
        var tenantId = await db.Tenants.OrderBy(t => t.Id).Select(t => t.Id).FirstOrDefaultAsync();
        var role = new Role
        {
            Id = maxId + 1, TenantId = tenantId,
            Name = request.Name,
            Slug = request.Name.ToLower().Replace(" ", "-"),
            Description = request.Description,
            IsSystem = false, CreatedAt = DateTime.UtcNow
        };
        db.Roles.Add(role);
        await db.SaveChangesAsync();
        return Map(role);
    }

    public async Task<RoleResponse?> GetRoleByIdAsync(string id)
    {
        if (!ulong.TryParse(id, out var uid)) return null;
        var role = await db.Roles.Include(r => r.RolePermissions)
            .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(r => r.Id == uid);
        return role is null ? null : Map(role);
    }

    public async Task<RoleResponse?> UpdateRoleAsync(string id, UpdateRoleRequest request)
    {
        if (!ulong.TryParse(id, out var uid)) return null;
        var role = await db.Roles.FindAsync(uid);
        if (role is null) return null;
        if (request.Name is not null) { role.Name = request.Name; role.Slug = request.Name.ToLower().Replace(" ", "-"); }
        if (request.Description is not null) role.Description = request.Description;
        await db.SaveChangesAsync();
        return Map(role);
    }

    public async Task<bool> DeleteRoleAsync(string id)
    {
        if (!ulong.TryParse(id, out var uid)) return false;
        var role = await db.Roles.FindAsync(uid);
        if (role is null || role.IsSystem) return false;
        db.Roles.Remove(role);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<List<string>> GetRolePermissionsAsync(string id)
    {
        if (!ulong.TryParse(id, out var uid)) return [];
        return await db.RolePermissions
            .Where(rp => rp.RoleId == uid)
            .Include(rp => rp.Permission)
            .Select(rp => $"{rp.Permission.Module}.{rp.Permission.Action}")
            .ToListAsync();
    }

    public async Task<RoleResponse?> UpdateRolePermissionsAsync(string id, UpdateRolePermissionsRequest request)
    {
        if (!ulong.TryParse(id, out var uid)) return null;
        var role = await db.Roles.FindAsync(uid);
        if (role is null) return null;

        // Remove existing
        var existing = await db.RolePermissions.Where(rp => rp.RoleId == uid).ToListAsync();
        db.RolePermissions.RemoveRange(existing);

        // Add new — resolve permission by "module.action" key
        foreach (var key in request.Permissions)
        {
            var parts = key.Split('.', 2);
            if (parts.Length < 2) continue;
            var perm = await db.Permissions
                .FirstOrDefaultAsync(p => p.Module == parts[0] && p.Action == parts[1]);
            if (perm is not null)
                db.RolePermissions.Add(new RolePermission { RoleId = uid, PermissionId = perm.Id });
        }

        await db.SaveChangesAsync();
        await db.Entry(role).Collection(r => r.RolePermissions).LoadAsync();
        return Map(role);
    }

    public async Task<List<PermissionResponse>> GetAllPermissionsAsync()
    {
        var perms = await db.Permissions.OrderBy(p => p.Module).ThenBy(p => p.Action).ToListAsync();
        return perms.Select(p => new PermissionResponse
        {
            Key = $"{p.Module}.{p.Action}",
            Group = p.Module,
            Description = p.Label ?? $"{p.Action} {p.Module}"
        }).ToList();
    }

    public async Task<PermissionMatrixResponse> GetPermissionMatrixAsync()
    {
        var roles = await db.Roles
            .Include(r => r.RolePermissions).ThenInclude(rp => rp.Permission)
            .ToListAsync();
        return new PermissionMatrixResponse
        {
            Matrix = roles.Select(r => new RolePermissionRow
            {
                RoleName = r.Name,
                Permissions = r.RolePermissions
                    .Select(rp => $"{rp.Permission.Module}.{rp.Permission.Action}").ToList()
            }).ToList()
        };
    }

    public async Task<bool> AssignRoleToUserAsync(ulong userId, AssignRoleRequest request)
    {
        if (!ulong.TryParse(request.RoleId, out var roleId)) return false;
        var role = await db.Roles.FindAsync(roleId);
        if (role is null) return false;
        var user = await db.Users.FindAsync(userId);
        if (user is null) return false;
        user.RoleId    = roleId;
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RevokeRoleFromUserAsync(ulong userId, string roleId)
    {
        if (!ulong.TryParse(roleId, out var rid)) return false;
        var user = await db.Users.FindAsync(userId);
        if (user is null || user.RoleId != rid) return false;
        // Revert to default client role
        var clientRole = await db.Roles.FirstOrDefaultAsync(r => r.Slug == "client");
        user.RoleId    = clientRole?.Id ?? 0;
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return true;
    }

    private static RoleResponse Map(Role r) => new()
    {
        Id = r.Id.ToString(), Name = r.Name, Description = r.Description,
        Permissions = r.RolePermissions
            .Select(rp => $"{rp.Permission?.Module}.{rp.Permission?.Action}")
            .Where(s => !s.StartsWith('.'))
            .ToList(),
        CreatedAt = r.CreatedAt
    };
}
