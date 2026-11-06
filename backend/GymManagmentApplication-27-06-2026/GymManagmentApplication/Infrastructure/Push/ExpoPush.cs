using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using GymManagmentApplication.Application.Engagement;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Infrastructure.Push;

/// <summary>Push settings: "Push:ExpoAccessToken" (or the EXPO_ACCESS_TOKEN env var) — optional,
/// only needed when "Enhanced push security" is on for the Expo project.</summary>
public sealed class PushSettings
{
    public string? ExpoAccessToken { get; set; }
}

/// <summary>Expo push service client (https://docs.expo.dev/push-notifications/sending-notifications/).</summary>
public sealed class ExpoPushSender(IHttpClientFactory http, Microsoft.Extensions.Options.IOptions<PushSettings> options) : IPushSender
{
    public const string HttpClientName = "expo-push";
    public const string SendUrl = "https://exp.host/--/api/v2/push/send";
    public const string ReceiptsUrl = "https://exp.host/--/api/v2/push/getReceipts";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<IReadOnlyList<PushTicket>> SendAsync(IReadOnlyList<PushMessage> messages, CancellationToken ct = default)
    {
        if (messages.Count == 0) return [];
        var body = messages.Select(m => new
        {
            to = m.To, title = m.Title, body = m.Body, data = m.Data, sound = "default",
            priority = m.HighPriority ? "high" : "default", channelId = "default",
        }).ToList();
        using var res = await Client().SendAsync(Request(SendUrl, body), ct);
        var doc = await ReadAsync(res, ct);
        if (doc.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
            return data.EnumerateArray().Select(Ticket).ToList();
        // Whole-request error (bad payload, too many experience ids…): no per-message tickets.
        throw new HttpRequestException($"Expo push send failed ({(int)res.StatusCode}): {Truncate(doc.RootElement.GetRawText())}");
    }

    public async Task<IReadOnlyDictionary<string, PushTicket>> GetReceiptsAsync(IReadOnlyCollection<string> ticketIds, CancellationToken ct = default)
    {
        if (ticketIds.Count == 0) return new Dictionary<string, PushTicket>();
        using var res = await Client().SendAsync(Request(ReceiptsUrl, new { ids = ticketIds }), ct);
        var doc = await ReadAsync(res, ct);
        if (!doc.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Object)
            throw new HttpRequestException($"Expo receipts failed ({(int)res.StatusCode}): {Truncate(doc.RootElement.GetRawText())}");
        return data.EnumerateObject().ToDictionary(p => p.Name, p => Ticket(p.Value));
    }

    private HttpClient Client() => http.CreateClient(HttpClientName);

    private HttpRequestMessage Request(string url, object body)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, url) { Content = JsonContent.Create(body, options: Json) };
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        if (!string.IsNullOrWhiteSpace(options.Value.ExpoAccessToken))
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.Value.ExpoAccessToken);
        return req;
    }

    private static async Task<JsonDocument> ReadAsync(HttpResponseMessage res, CancellationToken ct)
    {
        var text = await res.Content.ReadAsStringAsync(ct);
        try { return JsonDocument.Parse(string.IsNullOrWhiteSpace(text) ? "{}" : text); }
        catch (JsonException) { throw new HttpRequestException($"Expo returned {(int)res.StatusCode} with a non-JSON body."); }
    }

    private static PushTicket Ticket(JsonElement t)
    {
        var ok = t.TryGetProperty("status", out var s) && s.GetString() == "ok";
        var id = t.TryGetProperty("id", out var i) ? i.GetString() : null;
        var message = t.TryGetProperty("message", out var m) ? m.GetString() : null;
        string? error = null;
        if (t.TryGetProperty("details", out var d) && d.ValueKind == JsonValueKind.Object && d.TryGetProperty("error", out var e))
            error = e.GetString();
        return new PushTicket(ok, id, ok ? null : error ?? "Unknown", message);
    }

    private static string Truncate(string s) => s.Length > 300 ? s[..300] : s;
}

/// <summary>
/// Delivers queued pushes every 10 s and checks Expo receipts every few minutes. A Postgres
/// advisory lock keeps two instances from sending the same rows (like the email outbox).
/// </summary>
public class PushOutboxProcessor(IServiceScopeFactory scopes, ILogger<PushOutboxProcessor> logger) : BackgroundService
{
    private static readonly TimeSpan Every = TimeSpan.FromSeconds(10);
    private const long LockKey = 0x6779_6D70_7368; // "gympsh"
    private int _ticks;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(20), stoppingToken); // let startup/migrations finish
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await DrainOnceAsync(checkReceipts: _ticks++ % 30 == 0, stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException) { logger.LogError(ex, "Push outbox run failed."); }
            await Task.Delay(Every, stoppingToken);
        }
    }

    public async Task DrainOnceAsync(bool checkReceipts, CancellationToken ct = default)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var dispatcher = scope.ServiceProvider.GetRequiredService<PushDispatcher>();

        await db.Database.OpenConnectionAsync(ct);
        try
        {
            var locked = await db.Database.SqlQuery<bool>($"SELECT pg_try_advisory_lock({LockKey}) AS \"Value\"").SingleAsync(ct);
            if (!locked) return;
            try
            {
                // Drain while full batches keep coming (bounded, so one run can't hog the loop).
                for (var i = 0; i < 5; i++)
                {
                    var before = await dispatcher.SendDueAsync(DateTime.UtcNow, ct);
                    if (before < PushDispatcher.BatchSize) break;
                }
                if (checkReceipts) await dispatcher.CheckReceiptsAsync(DateTime.UtcNow, ct);
            }
            finally
            {
                await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_unlock({LockKey})", ct);
            }
        }
        finally
        {
            await db.Database.CloseConnectionAsync();
        }
    }
}

/// <summary>
/// Every minute: expires lapsed waitlist offers and rolls their seats on. Every 5 minutes:
/// queues class / PT reminders (24 h and 2 h before). Advisory-locked; each gym runs in its own
/// scope; reminders dedupe on their key, so re-runs are harmless.
/// </summary>
public class NotificationScheduler(IServiceScopeFactory scopes, ILogger<NotificationScheduler> logger) : BackgroundService
{
    private static readonly TimeSpan Every = TimeSpan.FromMinutes(1);
    private const int ReminderEveryTicks = 5;
    private const long LockKey = 0x6779_6D72_656D; // "gymrem"
    private int _ticks;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(40), stoppingToken);
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await RunOnceAsync(reminders: _ticks++ % ReminderEveryTicks == 0, stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException) { logger.LogError(ex, "Notification scheduler failed."); }
            await Task.Delay(Every, stoppingToken);
        }
    }

    public async Task RunOnceAsync(bool reminders, CancellationToken ct = default)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.OpenConnectionAsync(ct);
        try
        {
            var locked = await db.Database.SqlQuery<bool>($"SELECT pg_try_advisory_lock({LockKey}) AS \"Value\"").SingleAsync(ct);
            if (!locked) return;
            try
            {
                var now = DateTime.UtcNow;
                var classes = await scope.ServiceProvider.GetRequiredService<Application.Scheduling.WaitlistOfferService>()
                    .ClassesWithExpiredOffersAsync(now, ct);
                foreach (var classId in classes)
                {
                    using var s = scopes.CreateScope();
                    try { await ExpireOffersAsync(s.ServiceProvider, classId, ct); }
                    catch (Exception ex) when (ex is not OperationCanceledException) { logger.LogError(ex, "Waitlist offer expiry failed for class {ClassId}.", classId); }
                }

                if (!reminders) return;
                var tenants = await db.Tenants.Where(t => t.Status != Domain.Enums.TenantStatus.Cancelled).Select(t => t.Id).ToListAsync(ct);
                foreach (var tenantId in tenants)
                {
                    using var s = scopes.CreateScope();
                    try { await s.ServiceProvider.GetRequiredService<ReminderService>().QueueDueAsync(tenantId, DateTime.UtcNow, ct); }
                    catch (Exception ex) when (ex is not OperationCanceledException) { logger.LogError(ex, "Reminders failed for tenant {TenantId}.", tenantId); }
                }
            }
            finally
            {
                await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_unlock({LockKey})", ct);
            }
        }
        finally
        {
            await db.Database.CloseConnectionAsync();
        }
    }

    private static async Task ExpireOffersAsync(IServiceProvider sp, ulong classId, CancellationToken ct)
    {
        var db = sp.GetRequiredService<AppDbContext>();
        var offers = sp.GetRequiredService<Application.Scheduling.WaitlistOfferService>();
        await Application.Common.UnitOfWork.InTransactionAsync(db, async () =>
        {
            await Application.Common.UnitOfWork.LockRowAsync<Domain.Entities.Scheduling.GymClass>(db, classId, ct);
            await offers.ExpireDueForClassAsync(classId, DateTime.UtcNow, ct);
        }, ct: ct);
    }
}

public static class PushRegistration
{
    /// <summary>Push devices, preferences, the Expo sender, the push outbox and the reminder / waitlist scheduler.</summary>
    public static IServiceCollection AddPushNotifications(this IServiceCollection services, IConfiguration config)
    {
        services.Configure<PushSettings>(o =>
        {
            config.GetSection("Push").Bind(o);
            if (string.IsNullOrWhiteSpace(o.ExpoAccessToken)) o.ExpoAccessToken = config["EXPO_ACCESS_TOKEN"];
        });
        services.AddHttpClient(ExpoPushSender.HttpClientName, c => c.Timeout = TimeSpan.FromSeconds(15));
        services.AddScoped<IPushSender, ExpoPushSender>();
        services.AddScoped<PushDispatcher>();
        services.AddScoped<ReminderService>();
        services.AddScoped<PushDeviceService>();
        services.AddScoped<NotificationPreferenceService>();
        services.AddScoped<Application.Scheduling.WaitlistOfferService>();
        services.AddHostedService<PushOutboxProcessor>();
        services.AddHostedService<NotificationScheduler>();
        return services;
    }
}
