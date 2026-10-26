using GymManagmentApplication.Application.Auth.Services;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Roles.Interfaces;
using GymManagmentApplication.Application.Roles.Requests;
using GymManagmentApplication.Application.Roles.Responses;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Roles.Services;

public class RolesService(AppDbContext db, ICurrentUser currentUser) : IRolesService
{
    private static string ToSlug(string name) => name.Trim().ToLower().Replace(" ", "-");

    public async Task<List<RoleResponse>> GetAllRolesAsync()
    {
        var roles = await db.Roles.Include(r => r.RolePermissions).ThenInclude(rp => rp.Permission).ToListAsync();
        return roles.Select(Map).ToList();
    }

    public async Task<RoleResponse> CreateRoleAsync(CreateRoleRequest request)
    {
        var tenantId = currentUser.ResolveTenantId();
        var slug = ToSlug(request.Name);
        if (RoleNames.IsBuiltIn(slug) || slug == RoleNames.Staff)
            throw new ArgumentException($"'{request.Name}' is a reserved role name.");
        if (await db.Roles.AnyAsync(r => r.TenantId == tenantId && r.Slug == slug))
            throw new ArgumentException($"A role named '{request.Name}' already exists in this gym.");

        var role = new Role
        {
            TenantId = tenantId,
            Name = request.Name,
            Slug = slug,
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
        var role = await db.Roles.FirstOrDefaultAsync(r => r.Id == uid);
        if (role is null) return null;
        EnsureEditable(role);
        if (request.Name is not null)
        {
            role.Name = request.Name;
            // System roles keep their slug: authorization is keyed on it.
            if (!role.IsSystem)
            {
                var slug = ToSlug(request.Name);
                if (RoleNames.IsBuiltIn(slug) || slug == RoleNames.Staff)
                    throw new ArgumentException($"'{request.Name}' is a reserved role name.");
                if (await db.Roles.AnyAsync(r => r.TenantId == role.TenantId && r.Slug == slug && r.Id != role.Id))
                    throw new ArgumentException($"A role named '{request.Name}' already exists in this gym.");
                role.Slug = slug;
            }
        }
        if (request.Description is not null) role.Description = request.Description;
        await db.SaveChangesAsync();
        return Map(role);
    }

    public async Task<bool> DeleteRoleAsync(string id)
    {
        if (!ulong.TryParse(id, out var uid)) return false;
        var role = await db.Roles.FirstOrDefaultAsync(r => r.Id == uid);
        if (role is null || role.IsSystem) return false;
        if (await db.Users.AnyAsync(u => u.RoleId == uid && u.DeletedAt == null))
            throw new ArgumentException("Role is still assigned to users. Reassign them first.");
        db.ModuleAccesses.RemoveRange(db.ModuleAccesses.Where(m => m.RoleId == uid));
        db.Roles.Remove(role);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<List<string>> GetRolePermissionsAsync(string id)
    {
        if (!ulong.TryParse(id, out var uid)) return [];
        if (!await db.Roles.AnyAsync(r => r.Id == uid)) return []; // tenant-filtered
        return await db.RolePermissions
            .Where(rp => rp.RoleId == uid)
            .Include(rp => rp.Permission)
            .Select(rp => $"{rp.Permission.Module}.{rp.Permission.Action}")
            .ToListAsync();
    }

    public async Task<RoleResponse?> UpdateRolePermissionsAsync(string id, UpdateRolePermissionsRequest request)
    {
        if (!ulong.TryParse(id, out var uid)) return null;
        var role = await db.Roles.FirstOrDefaultAsync(r => r.Id == uid);
        if (role is null) return null;
        EnsureEditable(role);

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
        var role = await db.Roles.FirstOrDefaultAsync(r => r.Id == roleId);
        if (role is null) return false;
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId && u.DeletedAt == null);
        if (user is null) return false;

        // A user can only hold a role from their own gym.
        if (role.TenantId != user.TenantId)
            throw new ArgumentException("That role belongs to a different gym than the user.");
        if (role.Slug == RoleNames.SuperAdmin && !currentUser.IsSuperAdmin)
            throw new UnauthorizedAccessException("Only a super admin can grant the super admin role.");
        if (user.Id == currentUser.UserId)
            throw new ArgumentException("You cannot change your own role.");
        await EnsureNotSuperAdminTargetAsync(user);
        user.RoleId    = roleId;
        user.UpdatedAt = DateTime.UtcNow;
        AuthService.RevokeRefreshTokens(user.Id); // the old role must not be refreshable
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RevokeRoleFromUserAsync(ulong userId, string roleId)
    {
        if (!ulong.TryParse(roleId, out var rid)) return false;
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId && u.DeletedAt == null);
        if (user is null || user.RoleId != rid) return false;
        if (user.Id == currentUser.UserId)
            throw new ArgumentException("You cannot change your own role.");
        await EnsureNotSuperAdminTargetAsync(user);
        // Revert to the client role of the user's own gym
        var clientRole = await db.Roles.IgnoreQueryFilters()
            .FirstOrDefaultAsync(r => r.Slug == RoleNames.Client && r.TenantId == user.TenantId)
            ?? throw new InvalidOperationException("This gym has no client role.");
        user.RoleId    = clientRole.Id;
        user.UpdatedAt = DateTime.UtcNow;
        AuthService.RevokeRefreshTokens(user.Id); // the old role must not be refreshable
        await db.SaveChangesAsync();
        return true;
    }

    /// <summary>The super admin role row itself can only be edited by a super admin.</summary>
    private void EnsureEditable(Role role)
    {
        if (role.Slug == RoleNames.SuperAdmin && !currentUser.IsSuperAdmin)
            throw new UnauthorizedAccessException("Only a super admin can edit the super admin role.");
    }

    /// <summary>Only a super admin may change the role of a super admin account.</summary>
    private async Task EnsureNotSuperAdminTargetAsync(User user)
    {
        if (currentUser.IsSuperAdmin) return;
        var targetSlug = await db.Roles.IgnoreQueryFilters()
            .Where(r => r.Id == user.RoleId).Select(r => r.Slug).FirstOrDefaultAsync();
        if (targetSlug == RoleNames.SuperAdmin)
            throw new UnauthorizedAccessException("Only a super admin can change a super admin's role.");
    }

    private static RoleResponse Map(Role r) => new()
    {
        Id = r.Id.ToString(), Name = r.Name, Slug = r.Slug, IsSystem = r.IsSystem, Description = r.Description,
        Permissions = r.RolePermissions
            .Select(rp => $"{rp.Permission?.Module}.{rp.Permission?.Action}")
            .Where(s => !s.StartsWith('.'))
            .ToList(),
        CreatedAt = r.CreatedAt
    };
}
