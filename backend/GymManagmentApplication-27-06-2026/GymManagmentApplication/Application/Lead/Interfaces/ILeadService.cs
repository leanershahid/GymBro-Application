using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Lead.Requests;
using GymManagmentApplication.Application.Lead.Responses;

namespace GymManagmentApplication.Application.Lead.Interfaces;

public interface ILeadService
{
    Task<PagedResponse<LeadResponse>> GetAllAsync(LeadListRequest request);
    Task<LeadResponse> CreateAsync(CreateLeadRequest request);
    Task<LeadResponse?> GetByIdAsync(ulong id);
    Task<LeadResponse?> UpdateAsync(ulong id, UpdateLeadRequest request);
    Task<LeadResponse?> ConvertAsync(ulong id);
    Task<LeadScoreResponse?> GetScoreAsync(ulong id);
    Task<LeadActivityResponse> AddFollowupAsync(ulong id, LeadFollowupRequest request);
    Task<List<LeadSourceBreakdownResponse>> GetSourceBreakdownAsync(ulong tenantId);
    Task<List<LeadResponse>> BulkImportAsync(BulkImportLeadRequest request);
}
