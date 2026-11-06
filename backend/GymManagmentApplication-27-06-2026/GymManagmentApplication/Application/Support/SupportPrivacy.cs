using System.Text.Json;
using GymManagmentApplication.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Support;

/// <summary>
/// Support data in the privacy flows (feature 2's PrivacyProcessor): what goes in "download my
/// data", and what anonymisation redacts. Runs without a signed-in user, so every query names its
/// tenant and member explicitly.
/// </summary>
public static class SupportPrivacy
{
    /// <summary>
    /// The member's requests with the messages they could see (internal staff notes and
    /// assignment events are not part of the member's data and are left out).
    /// </summary>
    public static async Task<object> ExportRequestsAsync(IAppDbContext db, ulong tenantId, ulong userId)
    {
        var requests = await db.SupportRequests.AcrossTenants().AsNoTracking()
            .Where(r => r.TenantId == tenantId && r.UserId == userId).OrderBy(r => r.CreatedAt).ToListAsync();
        var ids = requests.Select(r => r.Id).ToList();
        var messages = ids.Count == 0 ? [] : (await db.SupportMessages.AcrossTenants().AsNoTracking()
            .Where(m => m.TenantId == tenantId && ids.Contains(m.RequestId) && !m.IsInternal)
            .ToListAsync()).OrderBy(m => m.CreatedAt).ThenBy(m => m.Id).ToList();
        return requests.Select(r => new
        {
            r.Id, r.Category, r.Subject, r.Status, r.BranchId, r.CanContact, r.ContactMethod, r.CreatedAt, r.ResolvedAt, r.ClosedAt,
            r.Rating, r.RatingComment, r.RatedAt,
            messages = messages.Where(m => m.RequestId == r.Id).Select(m => new
            {
                from = m.AuthorRole == Domain.Entities.Support.SupportAuthorRoles.Member ? "you" : m.AuthorRole == Domain.Entities.Support.SupportAuthorRoles.Staff ? "gym" : "system",
                m.Kind, m.Body, photos = SupportCommon.PhotoList(m.Photos), m.CreatedAt,
            }).ToList(),
        }).ToList();
    }

    public static async Task<object> ExportClassFeedbackAsync(IAppDbContext db, ulong tenantId, ulong userId) =>
        await db.ClassFeedbacks.AcrossTenants().AsNoTracking().Where(f => f.TenantId == tenantId && f.UserId == userId)
            .OrderBy(f => f.CreatedAt).Select(f => new { f.BookingId, f.ClassId, f.Score, f.Comment, f.Skipped, f.CreatedAt }).ToListAsync();

    /// <summary>
    /// Redacts what the member wrote: their message bodies and photos, their requests' subjects and
    /// rating comments, their class feedback comments. Rows (category, status, dates, scores) stay
    /// for the gym's statistics. Photo URLs are added to <paramref name="files"/> for deletion.
    /// Returns table → rows touched.
    /// </summary>
    public static async Task<Dictionary<string, int>> AnonymiseAsync(IAppDbContext db, ulong tenantId, ulong userId, List<string> files, DateTime now)
    {
        var t = tenantId;
        var u = userId;
        var counts = new Dictionary<string, int>();
        var requestIds = await db.SupportRequests.AcrossTenants().Where(r => r.TenantId == t && r.UserId == u).Select(r => r.Id).ToListAsync();
        if (requestIds.Count > 0)
        {
            var mine = db.SupportMessages.AcrossTenants()
                .Where(m => m.TenantId == t && requestIds.Contains(m.RequestId) && m.AuthorId == u && m.Kind == Domain.Entities.Support.SupportMessageKinds.Message);
            foreach (var photos in await mine.Where(m => m.Photos != null).Select(m => m.Photos).ToListAsync())
                files.AddRange(SupportCommon.PhotoList(photos));
            counts["SupportMessages"] = await mine.ExecuteUpdateAsync(s => s
                .SetProperty(x => x.Body, SupportCommon.RedactedText)
                .SetProperty(x => x.Photos, (JsonDocument?)null));
            counts["SupportRequests"] = await db.SupportRequests.AcrossTenants().Where(r => r.TenantId == t && r.UserId == u)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(x => x.Subject, SupportCommon.RedactedText)
                    .SetProperty(x => x.RatingComment, (string?)null)
                    .SetProperty(x => x.ContactMethod, (string?)null)
                    .SetProperty(x => x.CanContact, false)
                    .SetProperty(x => x.RedactedAt, now));
        }
        var feedback = await db.ClassFeedbacks.AcrossTenants().Where(f => f.TenantId == t && f.UserId == u && f.Comment != null)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.Comment, (string?)null));
        if (feedback > 0) counts["ClassFeedbacks"] = feedback;
        return counts.Where(c => c.Value > 0).ToDictionary(c => c.Key, c => c.Value);
    }
}
