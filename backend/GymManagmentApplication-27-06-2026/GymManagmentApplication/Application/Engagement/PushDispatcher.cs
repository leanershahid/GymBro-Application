using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Communication;
using GymManagmentApplication.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace GymManagmentApplication.Application.Engagement;

/// <summary>
/// One pass of the push outbox (the hosted <c>PushOutboxProcessor</c> calls it under an advisory
/// lock): queued Push rows are checked against the user's preferences, quiet hours and expiry,
/// sent to the user's active devices in batches, and Expo tickets are kept for the receipts pass,
/// which disables tokens Expo reports as DeviceNotRegistered.
/// </summary>
public class PushDispatcher(IAppDbContext db, IPushSender sender, ILogger<PushDispatcher> logger)
{
    public const int BatchSize = 200;
    public const int ExpoChunk = 100;      // Expo accepts at most 100 messages per request
    public const int MaxAttempts = 5;
    /// <summary>Expo receipts are ready ~15 minutes after sending and kept for 24 h.</summary>
    public static readonly TimeSpan ReceiptDelay = TimeSpan.FromMinutes(15);
    public static readonly TimeSpan ReceiptWindow = TimeSpan.FromHours(24);
    public const string DeviceNotRegistered = "DeviceNotRegistered";

    /// <summary>Sends what is due; returns the number of rows that went out.</summary>
    public async Task<int> SendDueAsync(DateTime utcNow, CancellationToken ct = default)
    {
        var rows = await db.CommunicationLogs.IgnoreQueryFilters()
            .Where(l => l.Channel == CommunicationChannel.Push && l.Direction == CommunicationDirection.Outbound
                        && l.Status == CommunicationStatus.Queued && (l.NotBefore == null || l.NotBefore <= utcNow))
            .OrderBy(l => l.CreatedAt)
            .Take(BatchSize).ToListAsync(ct);
        if (rows.Count == 0) return 0;

        var userIds = rows.Where(r => r.UserId != null).Select(r => r.UserId!.Value).Distinct().ToList();
        var prefs = await db.NotificationPreferences.IgnoreQueryFilters().AsNoTracking()
            .Where(p => userIds.Contains(p.UserId)).ToDictionaryAsync(p => p.UserId, ct);
        var devices = (await db.PushDevices.IgnoreQueryFilters()
            .Where(d => userIds.Contains(d.UserId) && d.DisabledAt == null).ToListAsync(ct))
            .GroupBy(d => d.UserId).ToDictionary(g => g.Key, g => g.ToList());
        var zones = await ZonesAsync(userIds, ct);

        // (row, device) pairs to send, in order.
        var outgoing = new List<(CommunicationLog Row, PushMeta Meta, PushDevice Device)>();
        var metas = new Dictionary<ulong, PushMeta>();
        foreach (var row in rows)
        {
            var meta = PushMeta.From(row.Meta);
            metas[row.Id] = meta;
            var userId = row.UserId ?? 0;
            prefs.TryGetValue(userId, out var pref);

            if (meta.ExpiresAt is { } exp && exp <= utcNow) { Drop(row, meta, "expired"); continue; }
            if (!NotificationPolicy.Allows(pref?.Channels, meta.Category, NotificationChannels.Push)) { Drop(row, meta, "opted_out"); continue; }

            var zone = zones.GetValueOrDefault(userId, TimeZoneInfo.Utc);
            var after = NotificationPolicy.SendAfter(utcNow, zone, pref?.QuietHoursEnabled ?? true,
                pref?.QuietStart ?? NotificationPolicy.DefaultQuietStart, pref?.QuietEnd ?? NotificationPolicy.DefaultQuietEnd, meta.Urgent);
            if (after > utcNow)
            {
                if (meta.ExpiresAt is { } e && after >= e) { Drop(row, meta, "expired"); continue; } // would arrive too late
                row.NotBefore = after;
                continue;
            }

            if (!devices.TryGetValue(userId, out var mine) || mine.Count == 0) { Drop(row, meta, "no_device"); continue; }
            foreach (var d in mine) outgoing.Add((row, meta, d));
        }

        var accepted = new HashSet<ulong>();
        var failedHard = new HashSet<ulong>();
        var transient = new HashSet<ulong>();
        foreach (var chunk in outgoing.Chunk(ExpoChunk))
        {
            IReadOnlyList<PushTicket> tickets;
            try
            {
                tickets = await sender.SendAsync(chunk.Select(x => new PushMessage(x.Device.Token, x.Row.Subject ?? "GymBro", x.Row.Body,
                    new Dictionary<string, object?> { ["kind"] = x.Meta.Kind, ["refId"] = x.Meta.RefId, ["route"] = x.Meta.Route },
                    HighPriority: x.Meta.Urgent)).ToList(), ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
            {
                logger.LogWarning(ex, "Expo push request failed for {Count} messages.", chunk.Length);
                foreach (var x in chunk) transient.Add(x.Row.Id);
                continue;
            }

            for (var i = 0; i < chunk.Length; i++)
            {
                var (row, meta, device) = chunk[i];
                var t = i < tickets.Count ? tickets[i] : new PushTicket(false, null, "MissingTicket", null);
                if (t.Ok && t.Id is not null)
                {
                    (meta.Tickets ??= [])[t.Id] = device.Token;
                    accepted.Add(row.Id);
                }
                else if (t.Error == DeviceNotRegistered)
                {
                    Disable(device, utcNow);
                    failedHard.Add(row.Id);
                }
                else if (t.Error is "MessageRateExceeded" or "MissingTicket") transient.Add(row.Id);
                else
                {
                    logger.LogWarning("Expo rejected push {Id}: {Error} {Message}", row.Id, t.Error, t.Message);
                    failedHard.Add(row.Id);
                }
            }
        }

        var sent = 0;
        foreach (var row in outgoing.Select(x => x.Row).DistinctBy(r => r.Id))
        {
            var meta = metas[row.Id];
            row.Attempts++;
            if (accepted.Contains(row.Id))
            {
                row.Status = CommunicationStatus.Sent;
                row.DeliveredAt = utcNow;
                sent++;
            }
            else if (transient.Contains(row.Id) && row.Attempts < MaxAttempts)
            {
                row.NotBefore = utcNow.AddMinutes(Math.Pow(2, row.Attempts)); // 2, 4, 8, 16 min
            }
            else
            {
                row.Status = CommunicationStatus.Failed;
                meta.Reason = failedHard.Contains(row.Id) ? "rejected" : "error";
            }
            row.Meta = meta.ToDocument();
        }
        await db.SaveChangesAsync(ct);
        return sent;
    }

    /// <summary>
    /// Checks Expo receipts for pushes sent 15 min – 24 h ago: a DeviceNotRegistered receipt
    /// disables that token. Checked rows become Delivered (receipt details stay in Meta).
    /// </summary>
    public async Task<int> CheckReceiptsAsync(DateTime utcNow, CancellationToken ct = default)
    {
        var readyBefore = utcNow - ReceiptDelay;
        var notOlderThan = utcNow - ReceiptWindow;
        var rows = await db.CommunicationLogs.IgnoreQueryFilters()
            .Where(l => l.Channel == CommunicationChannel.Push && l.Status == CommunicationStatus.Sent
                        && l.DeliveredAt != null && l.DeliveredAt <= readyBefore)
            .OrderBy(l => l.DeliveredAt).Take(300).ToListAsync(ct);
        if (rows.Count == 0) return 0;

        var metas = rows.ToDictionary(r => r.Id, r => PushMeta.From(r.Meta));
        var ids = metas.Values.Where(m => m.Tickets is not null).SelectMany(m => m.Tickets!.Keys).Distinct().ToList();
        var receipts = new Dictionary<string, PushTicket>();
        foreach (var chunk in ids.Chunk(300))
        {
            try
            {
                foreach (var (k, v) in await sender.GetReceiptsAsync(chunk, ct)) receipts[k] = v;
            }
            catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
            {
                logger.LogWarning(ex, "Expo receipts request failed.");
                return 0; // try again next run
            }
        }

        var deadTokens = receipts.Where(r => !r.Value.Ok && r.Value.Error == DeviceNotRegistered)
            .Select(r => metas.Values.Select(m => m.Tickets?.GetValueOrDefault(r.Key)).FirstOrDefault(t => t is not null))
            .Where(t => t is not null).Select(t => t!).Distinct().ToList();
        if (deadTokens.Count > 0)
            foreach (var d in await db.PushDevices.IgnoreQueryFilters().Where(d => deadTokens.Contains(d.Token) && d.DisabledAt == null).ToListAsync(ct))
                Disable(d, utcNow);

        var done = 0;
        foreach (var row in rows)
        {
            var meta = metas[row.Id];
            var tickets = meta.Tickets?.Keys.ToList() ?? [];
            var allKnown = tickets.All(receipts.ContainsKey);
            // Expo forgets receipts after 24 h: stop waiting then.
            if (!allKnown && row.DeliveredAt > notOlderThan) continue;
            meta.ReceiptsChecked = true;
            var errors = tickets.Where(t => receipts.TryGetValue(t, out var r) && !r.Ok).Select(t => receipts[t].Error).Distinct().ToList();
            if (errors.Count > 0) meta.Reason = string.Join(",", errors);
            row.Meta = meta.ToDocument();
            row.Status = CommunicationStatus.Delivered;
            done++;
        }
        await db.SaveChangesAsync(ct);
        return done;
    }

    private static void Drop(CommunicationLog row, PushMeta meta, string reason)
    {
        row.Status = CommunicationStatus.Failed;
        meta.Reason = reason;
        row.Meta = meta.ToDocument();
    }

    private static void Disable(PushDevice d, DateTime utcNow)
    {
        d.DisabledAt ??= utcNow;
        d.DisabledReason = DeviceNotRegistered;
    }

    /// <summary>Each user's time zone: their branch's, else their gym's (Tenant.Timezone), else UTC.</summary>
    private async Task<Dictionary<ulong, TimeZoneInfo>> ZonesAsync(List<ulong> userIds, CancellationToken ct)
    {
        var rows = await db.Users.IgnoreQueryFilters().AsNoTracking().Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, Branch = u.Branch != null ? u.Branch.Timezone : null, Tenant = u.Tenant.Timezone })
            .ToListAsync(ct);
        return rows.ToDictionary(r => r.Id, r => TenantClock.Resolve(
            !string.IsNullOrWhiteSpace(r.Branch) && r.Branch != "UTC" ? r.Branch : r.Tenant));
    }
}
