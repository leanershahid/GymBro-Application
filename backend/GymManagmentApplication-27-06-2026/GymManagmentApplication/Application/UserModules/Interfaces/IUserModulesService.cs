using GymManagmentApplication.Application.UserModules.Requests;
using GymManagmentApplication.Application.UserModules.Responses;

namespace GymManagmentApplication.Application.UserModules.Interfaces;

public interface IUserModulesService
{
    Task<List<ModuleResponse>> GetAllModulesAsync();
    Task<List<UserModuleAccessResponse>?> GetUserModulesAsync(ulong userId);
    Task<List<UserModuleAccessResponse>?> SetUserModulesAsync(ulong userId, ulong? adminId, UpdateUserModulesRequest request);

    /// <summary>Used by <see cref="GymManagmentApplication.Filters.RequireModuleAttribute"/> to gate requests.</summary>
    Task<bool> HasModuleAsync(ulong userId, string moduleKey);

    /// <summary>
    /// Used by <see cref="GymManagmentApplication.Filters.RequireModuleAttribute"/> for granular
    /// view/create/edit/delete checks. When the user has no explicit row for the module, admins
    /// and super admins default to allowed (their access is a privilege, dialed down by exception);
    /// every other role defaults to denied (a feature must be explicitly turned on for them).
    /// </summary>
    Task<bool> CanAsync(ulong userId, string moduleKey, string action);
}
