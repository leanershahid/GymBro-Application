using System.Text.Json;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Communication;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
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
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>
/// In-app notifications. Other services queue one with <see cref="Add"/>; it is saved together
/// with their own changes. Members/trainers read them from /api/notifications.
/// </summary>
public class Notifier(AppDbContext db, ICurrentUser currentUser)
{
    public void Add(ulong tenantId, ulong userId, string title, string? body = null, string? kind = null, ulong? refId = null)
    {
        if (userId == 0 || userId == currentUser.UserId) return; // nobody needs to be told about their own action
        db.Set<Notification>().Add(new Notification
        {
            TenantId = tenantId, UserId = userId, Title = title, Body = body,
            Channel = NotificationChannel.InApp, Status = NotificationStatus.Sent, SentAt = DateTime.UtcNow,
            Meta = kind is null ? null : JsonSerializer.SerializeToDocument(new { kind, refId }),
        });
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
        if (n.Meta?.RootElement is { ValueKind: JsonValueKind.Object } m)
        {
            if (m.TryGetProperty("kind", out var k) && k.ValueKind == JsonValueKind.String) kind = k.GetString();
            if (m.TryGetProperty("refId", out var r) && r.ValueKind == JsonValueKind.Number) refId = r.GetUInt64();
        }
        return new NotificationResponse
        {
            Id = n.Id, Title = n.Title, Body = n.Body, Kind = kind, RefId = refId,
            IsRead = n.ReadAt != null, CreatedAt = n.CreatedAt,
        };
    }
}
