using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Support;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Support;

/// <summary>What the gym edits for its help desk: FAQ entries, canned replies and the settings.</summary>
public class SupportContentService(IAppDbContext db, ICurrentUser currentUser)
{
    private ulong TenantId => currentUser.ResolveTenantId();

    // ── FAQ ──────────────────────────────────────────────────────────────

    public async Task<List<SupportFaqDto>> FaqsAsync() =>
        (await db.SupportFaqs.AsNoTracking().ToListAsync()).OrderBy(f => f.SortOrder).ThenBy(f => f.Id).Select(MapFaq).ToList();

    public async Task<SupportFaqDto> CreateFaqAsync(SupportFaqBody body)
    {
        var tenantId = TenantId;
        var next = await db.SupportFaqs.Select(f => (int?)f.SortOrder).MaxAsync() ?? 0;
        var f = new SupportFaq { TenantId = tenantId, SortOrder = body.SortOrder ?? next + 1 };
        Apply(f, body);
        db.SupportFaqs.Add(f);
        await db.SaveChangesAsync();
        return MapFaq(f);
    }

    public async Task<SupportFaqDto> UpdateFaqAsync(ulong id, SupportFaqBody body)
    {
        var f = await db.SupportFaqs.FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Question not found.");
        Apply(f, body);
        if (body.SortOrder is { } s) f.SortOrder = s;
        await db.SaveChangesAsync();
        return MapFaq(f);
    }

    public async Task DeleteFaqAsync(ulong id)
    {
        var f = await db.SupportFaqs.FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Question not found.");
        db.SupportFaqs.Remove(f);
        await db.SaveChangesAsync();
    }

    private static void Apply(SupportFaq f, SupportFaqBody body)
    {
        f.Question = SupportCommon.Required(body.Question, 300, "Question");
        f.Answer = SupportCommon.Required(body.Answer, 4000, "Answer");
        f.Category = string.IsNullOrWhiteSpace(body.Category) ? null : SupportCommon.Category(body.Category);
        f.IsPublished = body.IsPublished;
    }

    public static SupportFaqDto MapFaq(SupportFaq f) => new()
    {
        Id = f.Id, Question = f.Question, Answer = f.Answer, Category = f.Category, SortOrder = f.SortOrder, IsPublished = f.IsPublished,
    };

    // ── Canned replies ───────────────────────────────────────────────────

    public async Task<List<SupportCannedReplyDto>> CannedAsync() =>
        (await db.SupportCannedReplies.AsNoTracking().OrderBy(c => c.SortOrder).ThenBy(c => c.Title).ToListAsync()).Select(MapCanned).ToList();

    public async Task<SupportCannedReplyDto> CreateCannedAsync(SupportCannedReplyBody body)
    {
        var next = await db.SupportCannedReplies.Select(c => (int?)c.SortOrder).MaxAsync() ?? 0;
        var c = new SupportCannedReply
        {
            TenantId = TenantId, Title = SupportCommon.Required(body.Title, 100, "Title"), Body = SupportCommon.Required(body.Body, 4000, "Reply"),
            SortOrder = body.SortOrder ?? next + 1,
        };
        db.SupportCannedReplies.Add(c);
        await db.SaveChangesAsync();
        return MapCanned(c);
    }

    public async Task<SupportCannedReplyDto> UpdateCannedAsync(ulong id, SupportCannedReplyBody body)
    {
        var c = await db.SupportCannedReplies.FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Saved reply not found.");
        c.Title = SupportCommon.Required(body.Title, 100, "Title");
        c.Body = SupportCommon.Required(body.Body, 4000, "Reply");
        if (body.SortOrder is { } s) c.SortOrder = s;
        await db.SaveChangesAsync();
        return MapCanned(c);
    }

    public async Task DeleteCannedAsync(ulong id)
    {
        var c = await db.SupportCannedReplies.FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Saved reply not found.");
        db.SupportCannedReplies.Remove(c);
        await db.SaveChangesAsync();
    }

    private static SupportCannedReplyDto MapCanned(SupportCannedReply c) => new() { Id = c.Id, Title = c.Title, Body = c.Body, SortOrder = c.SortOrder };

    // ── Settings ─────────────────────────────────────────────────────────

    public Task<SupportSettings> SettingsAsync() => SupportSettingsStore.LoadAsync(db, TenantId);

    public Task<SupportSettings> SaveSettingsAsync(SupportSettings settings) => SupportSettingsStore.SaveAsync(db, TenantId, settings);
}
