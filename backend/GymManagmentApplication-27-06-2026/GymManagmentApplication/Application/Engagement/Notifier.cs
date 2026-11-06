using System.Text.Json;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Communication;
using GymManagmentApplication.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Engagement;

public class NotificationResponse
{
    public ulong Id { get; set; }
    public string Title { get; set; } = default!;
    public string? Body { get; set; }
    /// <summary>What the app should open: "booking", "billing", "training", "challenge"…</summary>
    public string? Kind { get; set; }
    public ulong? RefId { get; set; }
    /// <summary>Screen key the app opens on tap (same as the push payload's route; see PushRoutes).</summary>
    public string? Route { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>
/// In-app notifications. Other services queue one with <see cref="Add"/>; it is saved together
/// with their own changes. Members/trainers read them from /api/notifications.
/// </summary>
public class Notifier(IAppDbContext db, ICurrentUser currentUser)
{
    /// <summary>
    /// Adds the in-app notification and queues a push for it (CommunicationLog, Channel = Push) in
    /// the caller's unit of work. The push outbox applies the user's preferences for the category
    /// (from <paramref name="kind"/> unless given), quiet hours (skipped when <paramref name="urgent"/>),
    /// and drops it once <paramref name="expiresAt"/> has passed (e.g. a reminder after the class started).
    /// </summary>
    /// <param name="dedupeKey">Optional; kept in the push row's ProviderRef (see <see cref="AlreadyQueuedAsync"/>).</param>
    public void Add(ulong tenantId, ulong userId, string title, string? body = null, string? kind = null, ulong? refId = null,
        bool urgent = false, string? category = null, DateTime? expiresAt = null, string? dedupeKey = null)
    {
        if (userId == 0 || userId == currentUser.UserId) return; // nobody needs to be told about their own action
        var route = PushRoutes.For(kind, refId);
        db.Set<Notification>().Add(new Notification
        {
            TenantId = tenantId, UserId = userId, Title = title, Body = body,
            Channel = NotificationChannel.InApp, Status = NotificationStatus.Sent, SentAt = DateTime.UtcNow,
            Meta = kind is null ? null : JsonSerializer.SerializeToDocument(new { kind, refId, route }),
        });
        db.Set<CommunicationLog>().Add(new CommunicationLog
        {
            TenantId = tenantId, UserId = userId, Channel = CommunicationChannel.Push,
            Direction = CommunicationDirection.Outbound, Recipient = $"user:{userId}",
            Subject = title, Body = body, Status = CommunicationStatus.Queued, ProviderRef = dedupeKey,
            CreatedAt = DateTime.UtcNow,
            Meta = JsonSerializer.SerializeToDocument(new PushMeta
            {
                Kind = kind, RefId = refId, Route = route, Category = category ?? NotificationCategories.ForKind(kind),
                Urgent = urgent, ExpiresAt = expiresAt,
            }, PushMeta.Json),
        });
    }

    /// <summary>The subset of <paramref name="dedupeKeys"/> already queued as pushes for this gym.</summary>
    public async Task<HashSet<string>> AlreadyQueuedAsync(ulong tenantId, IReadOnlyCollection<string> dedupeKeys, CancellationToken ct = default)
    {
        if (dedupeKeys.Count == 0) return [];
        var keys = dedupeKeys.ToList();
        var found = await db.CommunicationLogs.IgnoreQueryFilters()
            .Where(l => l.TenantId == tenantId && l.Channel == CommunicationChannel.Push
                        && l.ProviderRef != null && keys.Contains(l.ProviderRef))
            .Select(l => l.ProviderRef!).ToListAsync(ct);
        // Also the rows added in this unit of work but not saved yet.
        found.AddRange(db.ChangeTracker.Entries<CommunicationLog>()
            .Where(e => e.State == EntityState.Added && e.Entity.Channel == CommunicationChannel.Push
                        && e.Entity.ProviderRef != null && keys.Contains(e.Entity.ProviderRef))
            .Select(e => e.Entity.ProviderRef!));
        return found.ToHashSet(StringComparer.Ordinal);
    }

    public async Task<List<NotificationResponse>> GetMineAsync(bool unreadOnly)
    {
        var me = currentUser.UserId ?? 0;
        var rows = await db.Set<Notification>().Where(n => n.UserId == me && (!unreadOnly || n.ReadAt == null))
            .OrderByDescending(n => n.CreatedAt).Take(100).ToListAsync();
        return rows.Select(Map).ToList();
    }

    public Task<int> UnreadCountAsync()
    {
        var me = currentUser.UserId ?? 0;
        return db.Set<Notification>().CountAsync(n => n.UserId == me && n.ReadAt == null);
    }

    /// <summary>Marks one (or, with null, all) of the caller's notifications read.</summary>
    public async Task<int> MarkReadAsync(ulong? id)
    {
        var me = currentUser.UserId ?? 0;
        var now = DateTime.UtcNow;
        return await db.Set<Notification>()
            .Where(n => n.UserId == me && n.ReadAt == null && (id == null || n.Id == id))
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.ReadAt, now).SetProperty(n => n.Status, NotificationStatus.Read));
    }

    private static NotificationResponse Map(Notification n)
    {
        string? kind = null;
        ulong? refId = null;
        string? route = null;
        if (n.Meta?.RootElement is { ValueKind: JsonValueKind.Object } m)
        {
            if (m.TryGetProperty("kind", out var k) && k.ValueKind == JsonValueKind.String) kind = k.GetString();
            if (m.TryGetProperty("refId", out var r) && r.ValueKind == JsonValueKind.Number) refId = r.GetUInt64();
            if (m.TryGetProperty("route", out var ro) && ro.ValueKind == JsonValueKind.String) route = ro.GetString();
        }
        return new NotificationResponse
        {
            Id = n.Id, Title = n.Title, Body = n.Body, Kind = kind, RefId = refId, Route = route ?? PushRoutes.For(kind, refId),
            IsRead = n.ReadAt != null, CreatedAt = n.CreatedAt,
        };
    }
}
