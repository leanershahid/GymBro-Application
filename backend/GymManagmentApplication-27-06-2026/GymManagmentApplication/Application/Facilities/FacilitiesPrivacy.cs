using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Facilities;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Facilities;

/// <summary>
/// What the privacy processor (data export / account anonymisation) does with facilities data.
/// Every query names its tenant and user (it runs without a signed-in user).
/// <list type="bullet">
/// <item>Export: the member's own problem reports, and — only where they are the injured party —
/// a summary of incidents (date, type, location, branch). Never the description, other people,
/// witnesses, staff notes or attachments; incidents they were merely involved in are left out.</item>
/// <item>Anonymisation: incidents are a legal record and stay. The member's name on them (person
/// rows and the free text) becomes the anonymised reference "Anonymised member #{id}"; their contact
/// details go. Problem-report follows (+1) are removed; reports stay (the user row is anonymised).</item>
/// </list>
/// </summary>
public static class FacilitiesPrivacy
{
    public static string AnonymisedReference(ulong userId) => $"Anonymised member #{userId}";

    public static async Task<object> ExportIncidentSummariesAsync(IAppDbContext db, ulong tenantId, ulong userId)
    {
        var rows = await (from p in db.IncidentPeople.AcrossTenants()
                          join i in db.Incidents.AcrossTenants() on p.IncidentId equals i.Id
                          join b in db.Branches.AcrossTenants() on i.BranchId equals b.Id
                          where p.TenantId == tenantId && i.TenantId == tenantId && p.UserId == userId && p.IsInjuredParty
                          orderby i.OccurredAt
                          select new { i.Id, i.OccurredAt, i.Type, i.Location, Branch = b.Name }).AsNoTracking().ToListAsync();
        return rows.DistinctBy(r => r.Id).Select(r => new
        {
            reference = IncidentService.Reference(r.Id), date = r.OccurredAt, type = IncidentTypes.Label(r.Type), location = r.Location, branch = r.Branch,
        }).ToList();
    }

    public static async Task<object> ExportReportsAsync(IAppDbContext db, ulong tenantId, ulong userId)
    {
        var rows = await db.FacilityReports.AcrossTenants().AsNoTracking()
            .Where(r => r.TenantId == tenantId && r.ReporterUserId == userId).OrderBy(r => r.CreatedAt).ToListAsync();
        var assetIds = rows.Where(r => r.AssetId != null).Select(r => r.AssetId!.Value).Distinct().ToList();
        var names = await db.FacilityAssets.AcrossTenants().Where(a => a.TenantId == tenantId && assetIds.Contains(a.Id)).ToDictionaryAsync(a => a.Id, a => a.Name);
        var comments = await db.FacilityReportComments.AcrossTenants().AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.UserId == userId && !c.IsStaff).Select(c => new { c.ReportId, c.Body, c.CreatedAt }).ToListAsync();
        return new
        {
            reports = rows.Select(r => new
            {
                r.Id, subject = r.AssetId is { } a ? names.GetValueOrDefault(a) : r.OtherLocation, problem = ProblemTypes.Label(r.ProblemType),
                r.Description, photos = FacilitiesCommon.SplitUrls(r.PhotoUrls), status = r.Status.ToString(), r.ResolutionNote, r.CreatedAt, r.ResolvedAt,
            }).ToList(),
            comments,
        };
    }

    /// <summary>Call before the user row's names are cleared. Returns rows touched per table.</summary>
    public static async Task<Dictionary<string, int>> AnonymiseAsync(IAppDbContext db, ulong tenantId, ulong userId, string? fullName)
    {
        var counts = new Dictionary<string, int>();
        var reference = AnonymisedReference(userId);
        var incidentIds = await db.IncidentPeople.AcrossTenants().Where(p => p.TenantId == tenantId && p.UserId == userId)
            .Select(p => p.IncidentId).Distinct().ToListAsync();

        // Set-based on purpose: closed incidents are sealed for edits, but the name must go.
        counts["IncidentPeople"] = await db.IncidentPeople.AcrossTenants().Where(p => p.TenantId == tenantId && p.UserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.Name, reference).SetProperty(x => x.Contact, (string?)null));
        var name = fullName?.Trim();
        if (incidentIds.Count > 0 && name is { Length: >= 3 })
            counts["Incidents"] = await db.Incidents.AcrossTenants().Where(i => i.TenantId == tenantId && incidentIds.Contains(i.Id))
                .ExecuteUpdateAsync(s => s
                    .SetProperty(x => x.Description, x => x.Description.Replace(name, reference))
                    .SetProperty(x => x.Witnesses, x => x.Witnesses == null ? null : x.Witnesses.Replace(name, reference))
                    .SetProperty(x => x.FollowUpActions, x => x.FollowUpActions == null ? null : x.FollowUpActions.Replace(name, reference)));
        counts["IncidentAddenda"] = incidentIds.Count == 0 || name is not { Length: >= 3 } ? 0
            : await db.IncidentAddenda.AcrossTenants().Where(a => a.TenantId == tenantId && incidentIds.Contains(a.IncidentId) && a.Body.Contains(name))
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.Body, x => x.Body.Replace(name, reference)));
        counts["FacilityReportFollowers"] = await db.FacilityReportFollowers.AcrossTenants()
            .Where(f => f.TenantId == tenantId && f.UserId == userId).ExecuteDeleteAsync();
        return counts.Where(kv => kv.Value > 0).ToDictionary();
    }
}
