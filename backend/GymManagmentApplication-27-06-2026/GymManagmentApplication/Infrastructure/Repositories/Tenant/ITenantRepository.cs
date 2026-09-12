namespace GymManagmentApplication.Infrastructure.Repositories.Tenant;

public interface ITenantRepository
{
    Task<List<Domain.Entities.Core.Tenant>> GetAllAsync();
    Task<Domain.Entities.Core.Tenant?> GetByIdAsync(ulong id);
    Task<Domain.Entities.Core.Tenant> CreateAsync(Domain.Entities.Core.Tenant tenant);
    Task<Domain.Entities.Core.Tenant> UpdateAsync(Domain.Entities.Core.Tenant tenant);
    Task<bool> DeleteAsync(ulong id);
}
