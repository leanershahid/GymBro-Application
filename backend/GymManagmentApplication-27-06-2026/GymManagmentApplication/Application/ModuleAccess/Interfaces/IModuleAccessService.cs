using GymManagmentApplication.Application.ModuleAccess.Requests;
using GymManagmentApplication.Application.ModuleAccess.Responses;

namespace GymManagmentApplication.Application.ModuleAccess.Interfaces;

public interface IModuleAccessService
{
    /// <summary>Get all module access entries for a specific role within a tenant.</summary>
    Task<List<ModuleAccessResponse>> GetByRoleAsync(ulong tenantId, ulong roleId);

    /// <summary>Get the full module access matrix for all roles in a tenant.</summary>
    Task<ModuleAccessMatrixResponse> GetMatrixAsync(ulong tenantId);

    /// <summary>Set (upsert) access for a single module + role combination.</summary>
    Task<ModuleAccessResponse> SetAsync(SetModuleAccessRequest request);

    /// <summary>Bulk upsert access for multiple modules for a role in one call.</summary>
    Task<List<ModuleAccessResponse>> BulkSetAsync(BulkSetModuleAccessRequest request);

    /// <summary>Revoke all access for a role on a specific module.</summary>
    Task<bool> RevokeAsync(ulong tenantId, ulong roleId, string module);

    /// <summary>Revoke all module access entries for a role (e.g. on role deletion).</summary>
    Task<bool> RevokeAllForRoleAsync(ulong tenantId, ulong roleId);

    /// <summary>Check whether a role has a specific action on a module.</summary>
    Task<CheckAccessResponse> CheckAsync(ulong tenantId, CheckModuleAccessRequest request);

    /// <summary>List all available module keys the platform supports.</summary>
    List<string> GetAvailableModules();
}
