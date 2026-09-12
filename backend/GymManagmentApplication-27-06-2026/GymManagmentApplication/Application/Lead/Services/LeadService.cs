using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Lead.Interfaces;
using GymManagmentApplication.Application.Lead.Requests;
using GymManagmentApplication.Application.Lead.Responses;
using GymManagmentApplication.Domain.Entities.CRM;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Repositories.Lead;

namespace GymManagmentApplication.Application.Lead.Services;

public class LeadService(ILeadRepository repository) : ILeadService
{
    public async Task<PagedResponse<LeadResponse>> GetAllAsync(LeadListRequest request)
    {
        var (items, total) = await repository.GetAllAsync(request);
        return new PagedResponse<LeadResponse>
        {
            Items = items.Select(Map),
            PageNumber = request.PageNumber,
            PageSize = request.PageSize,
            TotalRecords = total
        };
    }

    public async Task<LeadResponse> CreateAsync(CreateLeadRequest request)
    {
        var lead = new Domain.Entities.CRM.Lead
        {
            TenantId = request.TenantId,
            FirstName = request.FirstName,
            LastName = request.LastName,
            Email = request.Email,
            Phone = request.Phone,
            Source = request.Source,
            Notes = request.Notes,
            Status = LeadStatus.New
        };
        return Map(await repository.CreateAsync(lead));
    }

    public async Task<LeadResponse?> GetByIdAsync(ulong id)
    {
        var lead = await repository.GetByIdAsync(id);
        return lead is null ? null : Map(lead);
    }

    public async Task<LeadResponse?> UpdateAsync(ulong id, UpdateLeadRequest request)
    {
        var lead = await repository.GetByIdAsync(id);
        if (lead is null) return null;
        if (request.FirstName is not null) lead.FirstName = request.FirstName;
        if (request.LastName is not null) lead.LastName = request.LastName;
        if (request.Email is not null) lead.Email = request.Email;
        if (request.Phone is not null) lead.Phone = request.Phone;
        if (request.Source is not null) lead.Source = request.Source;
        if (request.Notes is not null) lead.Notes = request.Notes;
        if (request.Status is not null && Enum.TryParse<LeadStatus>(request.Status, true, out var s)) lead.Status = s;
        await repository.UpdateAsync(lead);
        return Map(lead);
    }

    public async Task<LeadResponse?> ConvertAsync(ulong id)
    {
        var lead = await repository.GetByIdAsync(id);
        if (lead is null) return null;
        lead.Status = LeadStatus.Converted;
        await repository.UpdateAsync(lead);
        return Map(lead);
    }

    public async Task<LeadScoreResponse?> GetScoreAsync(ulong id)
    {
        var lead = await repository.GetByIdAsync(id);
        if (lead is null) return null;
        return new LeadScoreResponse
        {
            LeadId = id,
            Score = lead.AiScore ?? 50,
            ConversionProbability = lead.ConversionProb ?? 0.5m,
            Recommendation = lead.Status == LeadStatus.Contacted ? "Follow up soon." : "Initiate contact."
        };
    }

    public async Task<LeadActivityResponse> AddFollowupAsync(ulong id, LeadFollowupRequest request)
    {
        var type = Enum.TryParse<LeadActivityType>(request.ActivityType, true, out var t) ? t : LeadActivityType.Note;
        var activity = new LeadActivity { LeadId = id, Type = type, Description = request.Description, Outcome = request.Outcome };
        var created = await repository.AddActivityAsync(activity);
        return new LeadActivityResponse { Id = created.Id, ActivityType = created.Type.ToString(), Description = created.Description, Outcome = created.Outcome, CreatedAt = created.CreatedAt };
    }

    public async Task<List<LeadSourceBreakdownResponse>> GetSourceBreakdownAsync(ulong tenantId)
    {
        var leads = await repository.GetByTenantAsync(tenantId);
        var total = leads.Count;
        return leads.GroupBy(l => l.Source ?? "Unknown")
            .Select(g => new LeadSourceBreakdownResponse
            {
                Source = g.Key,
                Count = g.Count(),
                Percentage = total > 0 ? Math.Round((decimal)g.Count() / total * 100, 2) : 0
            }).ToList();
    }

    public async Task<List<LeadResponse>> BulkImportAsync(BulkImportLeadRequest request)
    {
        var results = new List<LeadResponse>();
        foreach (var r in request.Leads) results.Add(await CreateAsync(r));
        return results;
    }

    private static LeadResponse Map(Domain.Entities.CRM.Lead l) => new()
    {
        Id = l.Id, TenantId = l.TenantId, FirstName = l.FirstName, LastName = l.LastName,
        Email = l.Email, Phone = l.Phone, Source = l.Source, Status = l.Status.ToString(),
        AiScore = l.AiScore, ConversionProb = l.ConversionProb, Notes = l.Notes, CreatedAt = l.CreatedAt
    };
}
