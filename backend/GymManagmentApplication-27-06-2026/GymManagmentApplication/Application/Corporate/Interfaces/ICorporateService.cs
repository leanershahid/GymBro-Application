using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Corporate.Requests;
using GymManagmentApplication.Application.Corporate.Responses;

namespace GymManagmentApplication.Application.Corporate.Interfaces;

public interface ICorporateService
{
    Task<PagedResponse<CorporateAccountResponse>> GetAllAsync(CorporateAccountListRequest request);
    Task<CorporateAccountResponse> CreateAsync(CreateCorporateAccountRequest request);
    Task<CorporateAccountResponse?> GetByIdAsync(ulong id);
    Task<CorporateAccountResponse?> UpdateAsync(ulong id, UpdateCorporateAccountRequest request);
    Task<List<CorporateMemberResponse>> GetMembersAsync(ulong id);
    Task<CorporateMemberResponse> AddMemberAsync(ulong id, AddCorporateMemberRequest request);
    Task<bool> RemoveMemberAsync(ulong accountId, ulong userId);
    Task<CorporateBillingResponse?> GetBillingAsync(ulong id);
}
