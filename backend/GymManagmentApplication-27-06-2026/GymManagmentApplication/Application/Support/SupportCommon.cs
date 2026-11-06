using System.Text.Json;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Domain.Entities.Support;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Support;

/// <summary>Helpers shared by the member help centre, the staff queue and the digest job.</summary>
public static class SupportCommon
{
    /// <summary>Admin module that owns the staff queue (ModuleCatalog) and its API key.</summary>
    public const string QueueModuleKey = "admin.support";
    public const string ApiKey = "support";
    public const int MaxPhotos = 3;
    /// <summary>A resolved request can be reopened by the member for this long; the job then closes it.</summary>
    public const int ReopenDays = 7;
    public const string RedactedText = "[removed at the member's request]";

    // Notification kinds (PushRoutes): member → their request; staff → the queue's request page.
    public const string MemberKind = "support";
    public const string StaffKind = "support_staff";
    public const string TrainerKind = "support_trainer";
    public const string DigestKind = "support_digest";

    /// <summary>Who hears about new requests: the gym's admins plus roles granted the support module.</summary>
    public static async Task<List<ulong>> StaffRecipientsAsync(IAppDbContext db, ulong tenantId, CancellationToken ct = default)
    {
        var admins = await (from u in db.Users.IgnoreQueryFilters()
                            join role in db.Roles.IgnoreQueryFilters() on u.RoleId equals role.Id
                            where u.TenantId == tenantId && u.DeletedAt == null && role.Slug == RoleNames.Admin
                            select u.Id).ToListAsync(ct);
        var grantedRoles = await (from g in db.RoleModuleGrants.IgnoreQueryFilters()
                                  join m in db.Modules on g.ModuleId equals m.Id
                                  where g.TenantId == tenantId && g.CanView && m.Key == QueueModuleKey
                                  select g.RoleId).ToListAsync(ct);
        var granted = grantedRoles.Count == 0 ? [] : await db.Users.IgnoreQueryFilters()
            .Where(u => u.TenantId == tenantId && u.DeletedAt == null && grantedRoles.Contains(u.RoleId))
            .Select(u => u.Id).ToListAsync(ct);
        return admins.Concat(granted).Distinct().ToList();
    }

    public static string Name(string? first, string? last, string fallback = "A member") =>
        $"{first} {last}".Trim() is { Length: > 0 } n ? n : fallback;

    public static string? Clean(string? s, int max)
    {
        var t = s?.Trim();
        if (string.IsNullOrEmpty(t)) return null;
        return t.Length > max ? t[..max] : t;
    }

    public static string Required(string? s, int max, string field)
    {
        var t = Clean(s, max);
        if (t is null) throw new ArgumentException($"{field} is required.");
        return t;
    }

    /// <summary>Checks the photo URLs: at most 3, http(s), and from this gym's upload folder.</summary>
    public static JsonDocument? Photos(IEnumerable<string>? urls, ulong tenantId)
    {
        var list = (urls ?? []).Where(u => !string.IsNullOrWhiteSpace(u)).Select(u => u.Trim()).Distinct().ToList();
        if (list.Count == 0) return null;
        if (list.Count > MaxPhotos) throw new ArgumentException($"Add up to {MaxPhotos} photos.");
        foreach (var u in list)
        {
            var ok = Uri.TryCreate(u, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp)
                     && u.Length <= 1000
                     && (u.Contains($"/tenant-{tenantId}/", StringComparison.Ordinal) || u.Contains($"/tenants/{tenantId}/", StringComparison.Ordinal));
            if (!ok) throw new ArgumentException("Photos must be uploaded from the app.");
        }
        return JsonSerializer.SerializeToDocument(list);
    }

    public static List<string> PhotoList(JsonDocument? doc)
    {
        if (doc?.RootElement is not { ValueKind: JsonValueKind.Array } arr) return [];
        return arr.EnumerateArray().Where(e => e.ValueKind == JsonValueKind.String).Select(e => e.GetString()!).ToList();
    }

    public static string Category(string? c)
    {
        var v = (c ?? "").Trim().ToLowerInvariant();
        return SupportCategories.All.Contains(v) ? v : throw new ArgumentException("Pick a category.");
    }

    public static string? ContactMethod(bool canContact, string? m)
    {
        if (!canContact) return null;
        var v = (m ?? "app").Trim().ToLowerInvariant();
        return v is "app" or "email" or "phone" ? v : throw new ArgumentException("Contact method: app, email or phone.");
    }

    public static string StatusLabel(string s) => s switch
    {
        SupportStatuses.Open => "Open",
        SupportStatuses.Waiting => "Waiting on you",
        SupportStatuses.Resolved => "Resolved",
        SupportStatuses.Closed => "Closed",
        _ => s,
    };

    public static string Preview(string? body) =>
        body is null ? "" : (body.ReplaceLineEndings(" ") is var one && one.Length > 120 ? one[..117] + "…" : one);
}
