using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Lead.Requests;
using GymManagmentApplication.Domain.Entities.CRM;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Infrastructure.Repositories.Lead;

public class LeadRepository(AppDbContext db) : ILeadRepository
{
    public async Task<(List<Domain.Entities.CRM.Lead> Items, int Total)> GetAllAsync(LeadListRequest request)
    {
        var q = db.Leads.AsQueryable();

        if (request.TenantId.HasValue)
            q = q.Where(l => l.TenantId == request.TenantId.Value);

        if (!string.IsNullOrWhiteSpace(request.Status) &&
            Enum.TryParse<LeadStatus>(request.Status, true, out var status))
            q = q.Where(l => l.Status == status);

        var total = await q.CountAsync();
        var items = await q
            .OrderByDescending(l => l.CreatedAt)
            .Page(request.PageNumber, request.PageSize)
            .ToListAsync();

        return (items, total);
    }

    public async Task<Domain.Entities.CRM.Lead> CreateAsync(Domain.Entities.CRM.Lead lead)
    {
        lead.CreatedAt = DateTime.UtcNow;
        lead.UpdatedAt = DateTime.UtcNow;
        db.Leads.Add(lead);
        await db.SaveChangesAsync();
        return lead;
    }

    public async Task<Domain.Entities.CRM.Lead?> GetByIdAsync(ulong id) =>
        await db.Leads.FindAsync(id);

    public async Task<Domain.Entities.CRM.Lead?> UpdateAsync(Domain.Entities.CRM.Lead lead)
    {
        lead.UpdatedAt = DateTime.UtcNow;
        db.Leads.Update(lead);
        await db.SaveChangesAsync();
        return lead;
    }

    public async Task<LeadActivity> AddActivityAsync(LeadActivity activity)
    {
        activity.CreatedAt = DateTime.UtcNow;
        db.LeadActivities.Add(activity);
        await db.SaveChangesAsync();
        return activity;
    }

    public async Task<List<Domain.Entities.CRM.Lead>> GetByTenantAsync(ulong tenantId) =>
        await db.Leads.Where(l => l.TenantId == tenantId).ToListAsync();
}
