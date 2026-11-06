using System.Text.Json;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Engagement;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Domain.Entities.Core;
using GymManagmentApplication.Domain.Entities.Facilities;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Facilities;

/// <summary>Module keys, settings, staff recipients and small helpers shared by the facilities services.</summary>
public static class FacilitiesCommon
{
    // Admin modules (ModuleCatalog) and the API permission keys they unlock.
    public const string RegisterModuleKey = "admin.facilities";
    public const string ReportsModuleKey = "admin.facility-reports";
    public const string IncidentsModuleKey = "admin.incidents";
    public const string RegisterApi = "facilities";
    public const string ReportsApi = "facility-reports";
    public const string IncidentsApi = "incidents";

    // Notification kinds (PushRoutes).
    public const string KindReport = "facility_report";             // member: my-report/{id}
    public const string KindReportStaff = "facility_report_staff";  // staff: facility-report/{id}

    public const int MaxPhotos = 3;
    public const int MaxReportsPerDay = 10;
    public const int MaxAttachments = 10;

    private const string SettingKey = "facilities";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static async Task<FacilitiesSettings> LoadSettingsAsync(IAppDbContext db, ulong tenantId)
    {
        var row = await db.TenantSettings.IgnoreQueryFilters().FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Key == SettingKey);
        return row?.Value is null ? new FacilitiesSettings() : row.Value.Deserialize<FacilitiesSettings>(Json) ?? new FacilitiesSettings();
    }

    public static async Task<FacilitiesSettings> SaveSettingsAsync(IAppDbContext db, ulong tenantId, FacilitiesSettings settings)
    {
        var row = await db.TenantSettings.FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Key == SettingKey);
        var value = JsonSerializer.SerializeToDocument(settings, Json);
        if (row is null) db.TenantSettings.Add(new TenantSetting { TenantId = tenantId, Key = SettingKey, Value = value });
        else row.Value = value;
        await db.SaveChangesAsync();
        return settings;
    }

    /// <summary>The gym's admins plus users whose role was granted <paramref name="moduleKey"/> (view).</summary>
    public static async Task<List<ulong>> StaffRecipientsAsync(IAppDbContext db, ulong tenantId, string moduleKey)
    {
        var admins = await (from u in db.Users.IgnoreQueryFilters()
                            join role in db.Roles.IgnoreQueryFilters() on u.RoleId equals role.Id
                            where u.TenantId == tenantId && u.DeletedAt == null && role.Slug == RoleNames.Admin
                            select u.Id).ToListAsync();
        var grantedRoles = await (from g in db.RoleModuleGrants.IgnoreQueryFilters()
                                  join m in db.Modules on g.ModuleId equals m.Id
                                  where g.TenantId == tenantId && g.CanView && m.Key == moduleKey
                                  select g.RoleId).ToListAsync();
        var granted = grantedRoles.Count == 0 ? [] : await db.Users.IgnoreQueryFilters()
            .Where(u => u.TenantId == tenantId && u.DeletedAt == null && grantedRoles.Contains(u.RoleId))
            .Select(u => u.Id).ToListAsync();
        return admins.Concat(granted).Distinct().ToList();
    }

    public static async Task<Dictionary<ulong, string>> NamesAsync(IAppDbContext db, IEnumerable<ulong?> ids)
    {
        var list = ids.Where(i => i is > 0).Select(i => i!.Value).Distinct().ToList();
        if (list.Count == 0) return [];
        return await db.Users.IgnoreQueryFilters().Where(u => list.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => (u.FirstName + " " + u.LastName).Trim());
    }

    public static async Task<Dictionary<ulong, string>> BranchNamesAsync(IAppDbContext db, IEnumerable<ulong> ids)
    {
        var list = ids.Distinct().ToList();
        if (list.Count == 0) return [];
        return await db.Branches.Where(b => list.Contains(b.Id)).ToDictionaryAsync(b => b.Id, b => b.Name);
    }

    /// <summary>Trimmed text, null when blank; throws when longer than <paramref name="max"/>.</summary>
    public static string? Clean(string? value, int max, string field)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var v = value.Trim();
        if (v.Length > max) throw new ArgumentException($"{field} can be at most {max} characters.");
        return v;
    }

    /// <summary>Validated http(s) URLs, joined with newlines (null when none).</summary>
    public static string? JoinUrls(IEnumerable<string>? urls, int max, string what)
    {
        var list = (urls ?? []).Where(u => !string.IsNullOrWhiteSpace(u)).Select(u => u.Trim()).Distinct().ToList();
        if (list.Count > max) throw new ArgumentException($"Add at most {max} {what}.");
        foreach (var u in list)
            if (u.Length > 1000 || !Uri.TryCreate(u, UriKind.Absolute, out var uri) || (uri.Scheme != "https" && uri.Scheme != "http"))
                throw new ArgumentException($"One of the {what} isn't a valid upload.");
        return list.Count == 0 ? null : string.Join('\n', list);
    }

    public static List<string> SplitUrls(string? joined) =>
        string.IsNullOrEmpty(joined) ? [] : joined.Split('\n', StringSplitOptions.RemoveEmptyEntries).ToList();

    public static bool IsOpen(ReportStatus s) => s is ReportStatus.Received or ReportStatus.InProgress;

    public static string StatusLabel(ReportStatus s) => s switch
    {
        ReportStatus.Received => "Received", ReportStatus.InProgress => "In progress", ReportStatus.Fixed => "Fixed", _ => "Can't reproduce",
    };

    /// <summary>
    /// A report was closed: the reporter and everyone who +1'd it hear about it. Saved with the
    /// caller's unit of work.
    /// </summary>
    public static async Task NotifyClosedAsync(IAppDbContext db, Notifier notifier, FacilityReport r, string subject)
    {
        var followers = await db.FacilityReportFollowers.Where(f => f.ReportId == r.Id).Select(f => f.UserId).ToListAsync();
        var fixedIt = r.Status == ReportStatus.Fixed;
        var title = fixedIt ? $"Fixed: {subject}" : $"Update on your report: {subject}";
        var body = r.ResolutionNote ?? (fixedIt ? "Thanks for letting us know — it's sorted." : "We couldn't find the problem. Tell us if you still see it.");
        foreach (var user in followers.Append(r.ReporterUserId).Distinct())
            notifier.Add(r.TenantId, user, title, body, KindReport, r.Id, category: Engagement.NotificationCategories.General);
    }
}
