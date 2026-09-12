using GymManagmentApplication.Application.Tenant.Requests;
using GymManagmentApplication.Application.Tenant.Responses;

namespace GymManagmentApplication.Application.Tenant.Interfaces;

public interface ITenantService
{
    Task<List<TenantResponse>> GetAllAsync();
    Task<TenantResponse?> GetByIdAsync(ulong id);
    Task<TenantResponse> CreateAsync(CreateTenantRequest request);
    Task<TenantResponse?> UpdateAsync(ulong id, UpdateTenantRequest request);
    Task<bool> DeleteAsync(ulong id);
}
