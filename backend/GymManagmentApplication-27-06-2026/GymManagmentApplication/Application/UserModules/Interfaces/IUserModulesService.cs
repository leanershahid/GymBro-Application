using GymManagmentApplication.Application.UserModules.Requests;
using GymManagmentApplication.Application.UserModules.Responses;

namespace GymManagmentApplication.Application.UserModules.Interfaces;

public interface IUserModulesService
{
    Task<List<ModuleResponse>> GetAllModulesAsync();
    Task<List<UserModuleAccessResponse>> GetUserModulesAsync(ulong userId);
    Task<List<UserModuleAccessResponse>> SetUserModulesAsync(ulong userId, ulong? adminId, UpdateUserModulesRequest request);

    /// <summary>Used by <see cref="GymManagmentApplication.Filters.RequireModuleAttribute"/> to gate requests.</summary>
    Task<bool> HasModuleAsync(ulong userId, string moduleKey);
}
