using System.Text.Json;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Safety;
using GymManagmentApplication.Domain.Entities.Messaging;
using GymManagmentApplication.Domain.Entities.Platform;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Messaging;

/// <summary>
/// Safeguarding review of trainer ↔ member threads (module <c>admin.messages</c>, API key
/// <c>messages-review</c>; admins by default, grantable per role, never part of a role template).
/// Read-only. Opening a thread writes an AuditLog row (EntityType "Conversation", action
/// <c>messages.review_view</c>) naming who looked and when; the list writes one too. Participants are
/// told in every thread footer that conversations may be reviewed.
/// </summary>
public class MessagingReviewService(IAppDbContext db, ICurrentUser currentUser)
{
    public const string ModuleKey = "admin.messages";
    public const string ApiKey = "messages-review";
    public const string AuditEntity = "Conversation";
    private const int MaxThread = 1000;

    private ulong TenantId => currentUser.ResolveTenantId();

    /// <summary>Threads with messages, newest first. <paramref name="search"/> matches the trainer's or member's name / email.</summary>
    public async Task<List<ReviewConversationSummary>> ListAsync(string? search, bool reportedOnly, RequestMeta meta)
    {
        var q = db.Conversations.AsNoTracking().Where(c => c.LastMessageAt != null);
        var term = Support.SupportCommon.Clean(search, 100)?.ToLowerInvariant();
        if (term is not null)
        {
            var users = db.Users.Where(u => (u.FirstName + " " + u.LastName).ToLower().Contains(term) || (u.Email ?? "").ToLower().Contains(term)).Select(u => u.Id);
            var trainerUsers = db.TrainerProfiles.Where(t => t.UserId != null && (t.DisplayName ?? "").ToLower().Contains(term)).Select(t => t.UserId!.Value);
            q = q.Where(c => users.Contains(c.TrainerUserId) || users.Contains(c.MemberUserId) || trainerUsers.Contains(c.TrainerUserId));
        }
        if (reportedOnly) q = q.Where(c => db.DirectMessages.Any(m => m.ConversationId == c.Id && m.ReportedAt != null));
        var rows = await q.OrderByDescending(c => c.LastMessageAt).Take(200).ToListAsync();
        var ids = rows.Select(r => r.Id).ToList();
        var stats = ids.Count == 0 ? [] : await db.DirectMessages.Where(m => ids.Contains(m.ConversationId))
            .GroupBy(m => m.ConversationId)
            .Select(g => new { g.Key, Count = g.Count(), Reported = g.Count(m => m.ReportedAt != null) })
            .ToDictionaryAsync(x => x.Key);
        var people = await MessagingService.People(db, rows.SelectMany(r => new[] { r.TrainerUserId, r.MemberUserId }));

        Audit("messages.review_list", null, meta, new { search = term, reportedOnly, results = rows.Count });
        await db.SaveChangesAsync();

        return rows.Select(c => new ReviewConversationSummary
        {
            Id = c.Id, Trainer = Person(people, c.TrainerUserId, "trainer"), Member = Person(people, c.MemberUserId, "member"),
            LastMessageAt = c.LastMessageAt, LastMessage = c.LastMessagePreview,
            MessageCount = stats.GetValueOrDefault(c.Id)?.Count ?? 0, ReportedCount = stats.GetValueOrDefault(c.Id)?.Reported ?? 0,
        }).ToList();
    }

    /// <summary>The whole thread (up to 1000 most recent messages), read-only. Every view is audit-logged.</summary>
    public async Task<ReviewConversationDetail> ThreadAsync(ulong id, RequestMeta meta)
    {
        var c = await db.Conversations.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Conversation not found.");
        var page = await db.DirectMessages.AsNoTracking().Where(m => m.ConversationId == id)
            .OrderByDescending(m => m.CreatedAt).Take(MaxThread + 1).ToListAsync();
        var people = await MessagingService.People(db, [c.TrainerUserId, c.MemberUserId]);

        Audit("messages.review_view", id, meta, new { trainerUserId = c.TrainerUserId, memberUserId = c.MemberUserId });
        await db.SaveChangesAsync();

        return new ReviewConversationDetail
        {
            Id = c.Id, Trainer = Person(people, c.TrainerUserId, "trainer"), Member = Person(people, c.MemberUserId, "member"), CreatedAt = c.CreatedAt,
            Messages = page.Take(MaxThread).OrderBy(m => m.CreatedAt).ThenBy(m => m.Id)
                .Select(m => MessagingService.Map(m, 0, review: true, senderName: people.GetValueOrDefault(m.SenderId)?.Name)).ToList(),
            Truncated = page.Count > MaxThread,
        };
    }

    public Task<MessagingSettings> SettingsAsync() => MessagingSettingsStore.LoadAsync(db, TenantId);

    public Task<MessagingSettings> SaveSettingsAsync(MessagingSettings s) => MessagingSettingsStore.SaveAsync(db, TenantId, s);

    private static MessagePerson Person(Dictionary<ulong, MessagePerson> people, ulong id, string role)
    {
        var p = people.GetValueOrDefault(id) ?? new MessagePerson { UserId = id, Name = "Unknown" };
        return new MessagePerson { UserId = p.UserId, Name = p.Name, AvatarUrl = p.AvatarUrl, Role = role };
    }

    private void Audit(string action, ulong? id, RequestMeta meta, object values) =>
        db.AuditLogs.Add(new AuditLog
        {
            TenantId = TenantId, UserId = currentUser.UserId, Action = action, EntityType = AuditEntity, EntityId = id,
            NewValues = JsonSerializer.SerializeToDocument(values),
            IpAddress = meta.Ip is { Length: > 45 } ip ? ip[..45] : meta.Ip,
            UserAgent = meta.UserAgent is { Length: > 500 } ua ? ua[..500] : meta.UserAgent,
            CreatedAt = DateTime.UtcNow,
        });
}

/// <summary>
/// Messaging data in the privacy flows (feature 2's PrivacyProcessor). Runs without a signed-in
/// user, so every query names its tenant and member explicitly.
/// </summary>
public static class MessagingPrivacy
{
    /// <summary>The member's threads with both sides' messages (they are a participant in each).</summary>
    public static async Task<object> ExportAsync(IAppDbContext db, ulong tenantId, ulong userId)
    {
        var threads = await db.Conversations.AcrossTenants().AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.MemberUserId == userId && c.LastMessageAt != null).OrderBy(c => c.CreatedAt).ToListAsync();
        var ids = threads.Select(c => c.Id).ToList();
        var messages = ids.Count == 0 ? [] : (await db.DirectMessages.AcrossTenants().AsNoTracking()
            .Where(m => m.TenantId == tenantId && ids.Contains(m.ConversationId)).ToListAsync())
            .OrderBy(m => m.CreatedAt).ThenBy(m => m.Id).ToList();
        var trainerIds = threads.Select(t => t.TrainerUserId).Distinct().ToList();
        var names = await db.Users.AcrossTenants().AsNoTracking().Where(u => trainerIds.Contains(u.Id))
            .Select(u => new { u.Id, u.FirstName, u.LastName }).ToDictionaryAsync(u => u.Id, u => Support.SupportCommon.Name(u.FirstName, u.LastName, "Trainer"));
        return threads.Select(c => new
        {
            c.Id, trainer = names.GetValueOrDefault(c.TrainerUserId, "Trainer"), c.CreatedAt, c.MemberMuted,
            messages = messages.Where(m => m.ConversationId == c.Id).Select(m => new
            {
                from = m.SenderId == userId ? "you" : "trainer", m.Body, photo = m.PhotoUrl,
                attachment = m.AttachmentType is null ? null : new { type = m.AttachmentType, title = m.AttachmentTitle },
                m.CreatedAt, reported = m.ReportedAt != null && m.ReportedById == userId,
            }).ToList(),
        }).ToList();
    }

    /// <summary>
    /// Redacts what the member wrote (bodies → placeholder, photos removed and queued for deletion)
    /// and their messaging preference; thread rows and the trainer's messages stay. Returns table → rows touched.
    /// </summary>
    public static async Task<Dictionary<string, int>> AnonymiseAsync(IAppDbContext db, ulong tenantId, ulong userId, List<string> files, DateTime now)
    {
        var t = tenantId;
        var u = userId;
        var counts = new Dictionary<string, int>();
        var mine = db.DirectMessages.AcrossTenants().Where(m => m.TenantId == t && m.SenderId == u && m.RedactedAt == null);
        files.AddRange(await mine.Where(m => m.PhotoUrl != null).Select(m => m.PhotoUrl!).ToListAsync());
        counts["DirectMessages"] = await mine.ExecuteUpdateAsync(s => s
            .SetProperty(x => x.Body, MessagingRules.RedactedText)
            .SetProperty(x => x.PhotoUrl, (string?)null)
            .SetProperty(x => x.RedactedAt, now));
        counts["Conversations"] = await db.Conversations.AcrossTenants().Where(c => c.TenantId == t && c.MemberUserId == u)
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.LastMessagePreview, x => x.LastMessageSenderId == u ? MessagingRules.RedactedText : x.LastMessagePreview)
                .SetProperty(x => x.MemberRedactedAt, now));
        counts["MessagingUserSettings"] = await db.MessagingUserSettings.AcrossTenants().Where(s => s.TenantId == t && s.UserId == u).ExecuteDeleteAsync();
        return counts.Where(c => c.Value > 0).ToDictionary(c => c.Key, c => c.Value);
    }
}

public static class MessagingServicesRegistration
{
    public static IServiceCollection AddMessagingServices(this IServiceCollection services)
    {
        services.AddScoped<MessagingService>();
        services.AddScoped<MessagingReviewService>();
        return services;
    }
}
