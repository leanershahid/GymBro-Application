namespace GymManagmentApplication.Infrastructure.Repositories.Branch;

public interface IBranchRepository
{
    Task<List<Domain.Entities.Core.Branch>> GetAllAsync();
    Task<List<Domain.Entities.Core.Branch>> GetByTenantAsync(ulong tenantId);
    Task<Domain.Entities.Core.Branch?> GetByIdAsync(ulong id);
    Task<Domain.Entities.Core.Branch> CreateAsync(Domain.Entities.Core.Branch branch);
    Task<Domain.Entities.Core.Branch> UpdateAsync(Domain.Entities.Core.Branch branch);
    Task<bool> DeleteAsync(ulong id);
}
