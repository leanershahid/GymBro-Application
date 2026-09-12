using GymManagmentApplication.Application.Roles.Requests;
using GymManagmentApplication.Application.Roles.Responses;

namespace GymManagmentApplication.Application.Roles.Interfaces;

public interface IRolesService
{
    Task<List<RoleResponse>> GetAllRolesAsync();
    Task<RoleResponse> CreateRoleAsync(CreateRoleRequest request);
    Task<RoleResponse?> GetRoleByIdAsync(string id);
    Task<RoleResponse?> UpdateRoleAsync(string id, UpdateRoleRequest request);
    Task<bool> DeleteRoleAsync(string id);
    Task<List<string>> GetRolePermissionsAsync(string id);
    Task<RoleResponse?> UpdateRolePermissionsAsync(string id, UpdateRolePermissionsRequest request);
    Task<List<PermissionResponse>> GetAllPermissionsAsync();
    Task<PermissionMatrixResponse> GetPermissionMatrixAsync();
    Task<bool> AssignRoleToUserAsync(ulong userId, AssignRoleRequest request);
    Task<bool> RevokeRoleFromUserAsync(ulong userId, string roleId);
}
