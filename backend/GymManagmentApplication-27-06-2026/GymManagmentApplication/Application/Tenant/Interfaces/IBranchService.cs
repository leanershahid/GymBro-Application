using GymManagmentApplication.Application.Branch.Requests;
using GymManagmentApplication.Application.Branch.Responses;

namespace GymManagmentApplication.Application.Branch.Interfaces;

public interface IBranchService
{
    Task<List<BranchResponse>> GetAllAsync();
    Task<List<BranchResponse>> GetByTenantAsync(ulong tenantId);
    Task<BranchResponse?> GetByIdAsync(ulong id);
    Task<BranchResponse> CreateAsync(CreateBranchRequest request);
    Task<BranchResponse?> UpdateAsync(ulong id, UpdateBranchRequest request);
    Task<bool> DeleteAsync(ulong id);
    /// <summary>Moves every member and trainer of a branch to another active branch of the same gym.</summary>
    Task<int> TransferAsync(ulong id, ulong targetBranchId);
}
