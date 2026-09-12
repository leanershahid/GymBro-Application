using GymManagmentApplication.Application.Lead.Requests;
using GymManagmentApplication.Domain.Entities.CRM;

namespace GymManagmentApplication.Infrastructure.Repositories.Lead;

public interface ILeadRepository
{
    Task<(List<Domain.Entities.CRM.Lead> Items, int Total)> GetAllAsync(LeadListRequest request);
    Task<Domain.Entities.CRM.Lead> CreateAsync(Domain.Entities.CRM.Lead lead);
    Task<Domain.Entities.CRM.Lead?> GetByIdAsync(ulong id);
    Task<Domain.Entities.CRM.Lead?> UpdateAsync(Domain.Entities.CRM.Lead lead);
    Task<LeadActivity> AddActivityAsync(LeadActivity activity);
    Task<List<Domain.Entities.CRM.Lead>> GetByTenantAsync(ulong tenantId);
}
