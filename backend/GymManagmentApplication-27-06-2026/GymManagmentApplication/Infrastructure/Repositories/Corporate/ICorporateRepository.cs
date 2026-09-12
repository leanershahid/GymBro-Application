using GymManagmentApplication.Domain.Entities.Membership;

namespace GymManagmentApplication.Infrastructure.Repositories.Corporate;

public interface ICorporateRepository
{
    Task<(List<CorporateAccount> Items, int Total)> GetAllAsync(int pageNumber, int pageSize);
    Task<CorporateAccount> CreateAsync(CorporateAccount account);
    Task<CorporateAccount?> GetByIdAsync(ulong id);
    Task<CorporateAccount> UpdateAsync(CorporateAccount account);
    Task<List<GymMembership>> GetMembershipsAsync(ulong corporateId);
    Task<GymMembership> AddMembershipAsync(GymMembership membership);
    Task<bool> RemoveMembershipAsync(ulong corporateId, ulong userId);
}
