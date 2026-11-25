using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace DemoSeeder;

/// <summary>
/// The real API, hosted in-process with its own Program.cs, DI and configuration (Development,
/// content root = the main project, so .env / appsettings.Development.json / user secrets are read
/// by the app itself — this tool never reads them). Differences from `dotnet run`:
///  * background jobs are removed (email/push outbox, reminders, daily/privacy/support jobs…), so
///    this process never sends, drains or re-schedules anything on the live database;
///  * startup migrate/seed are off (no pending migrations; DbSeeder is the deploy's job).
/// </summary>
public sealed class DemoApiFactory : WebApplicationFactory<GymManagmentApplication.Controllers.AuthController>
{
    public static string MainProjectDir { get; } = Path.GetFullPath(Path.Combine(
        AppContext.BaseDirectory, "..", "..", "..", "..", "..", "..",
        "backend", "GymManagmentApplication-27-06-2026", "GymManagmentApplication"));

    public List<string> RemovedHostedServices { get; } = [];

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseContentRoot(MainProjectDir);
        builder.ConfigureAppConfiguration((_, cfg) => cfg.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Database:MigrateOnStartup"] = "false",
            ["Database:SeedOnStartup"] = "false",
            ["Logging:LogLevel:Default"] = "Warning",
            ["Logging:LogLevel:Microsoft.EntityFrameworkCore"] = "Error",
            ["Logging:LogLevel:Microsoft"] = "Error",
        }));
        builder.ConfigureTestServices(services =>
        {
            // Dev aid only: the app's Swagger fails on duplicate schema ids (two EmergencyContactRequest types).
            services.ConfigureSwaggerGen(c => c.CustomSchemaIds(t => t.FullName!.Replace("+", ".")));
            var appAssembly = typeof(GymManagmentApplication.Controllers.AuthController).Assembly;
            foreach (var d in services.Where(d => d.ServiceType == typeof(IHostedService)).ToList())
            {
                var asm = d.ImplementationType?.Assembly
                          ?? d.ImplementationFactory?.Method.DeclaringType?.Assembly
                          ?? d.ImplementationInstance?.GetType().Assembly;
                if (asm == appAssembly)
                {
                    services.Remove(d);
                    RemovedHostedServices.Add(d.ImplementationType?.Name ?? d.ImplementationFactory?.Method.DeclaringType?.Name ?? "?");
                }
            }

            // Every AppDbContext gets the outbound guard (see DemoGuard).
            foreach (var d in services.Where(d => d.ServiceType == typeof(GymManagmentApplication.Infrastructure.Data.AppDbContext)).ToList())
                services.Remove(d);
            services.AddScoped(sp =>
            {
                var ctx = ActivatorUtilities.CreateInstance<GymManagmentApplication.Infrastructure.Data.AppDbContext>(sp);
                ctx.SavingChanges += DemoGuard.OnSaving;
                return ctx;
            });
        });
    }

    public static void PrepareEnvironment()
    {
        // The app loads ".env" from the current directory and WebApplicationFactory looks this up.
        Directory.SetCurrentDirectory(MainProjectDir);
        Environment.SetEnvironmentVariable("ASPNETCORE_TEST_CONTENTROOT_GYMMANAGMENTAPPLICATION", MainProjectDir);
        Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Development");
        Environment.SetEnvironmentVariable("Database__MigrateOnStartup", "false");
        Environment.SetEnvironmentVariable("Database__SeedOnStartup", "false");
    }
}

public sealed class ApiException(string method, string path, int status, string body)
    : Exception($"{method} {path} -> {status}: {Trim(body)}")
{
    public int Status { get; } = status;
    public string Body { get; } = body;
    public string Method { get; } = method;
    public string Path { get; } = path;
    private static string Trim(string s) => s.Length > 600 ? s[..600] + "…" : s;
}

/// <summary>Thin JSON client over the in-process server, as one signed-in user.</summary>
public sealed class Api(HttpClient http, string who)
{
    public string Who { get; } = who;
    public string? Token { get; set; }
    public static readonly List<string> Log = [];

    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<JsonNode?> Send(HttpMethod method, string path, object? body = null, bool raw = false)
    {
        for (var attempt = 0; ; attempt++)
        {
            using var req = new HttpRequestMessage(method, path);
            if (Token is not null) req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", Token);
            req.Headers.Add("X-Forwarded-For", "127.0.0.1");
            if (body is not null)
                req.Content = new StringContent(body is string s ? s : JsonSerializer.Serialize(body, Json), Encoding.UTF8, "application/json");
            using var res = await http.SendAsync(req);
            var text = await res.Content.ReadAsStringAsync();
            if (res.StatusCode == HttpStatusCode.TooManyRequests && attempt < 4)
            {
                Console.WriteLine($"   429 on {path}, waiting 30s…");
                await Task.Delay(TimeSpan.FromSeconds(30));
                continue;
            }
            Log.Add($"{Who} {method} {path} -> {(int)res.StatusCode}");
            if (!res.IsSuccessStatusCode) throw new ApiException(method.Method, path, (int)res.StatusCode, text);
            if (string.IsNullOrWhiteSpace(text)) return null;
            var node = JsonNode.Parse(text);
            if (raw) return node;
            return node is JsonObject o && o.ContainsKey("data") ? o["data"] : node;
        }
    }

    public Task<JsonNode?> Get(string path) => Send(HttpMethod.Get, path);
    public Task<JsonNode?> Post(string path, object? body = null) => Send(HttpMethod.Post, path, body ?? new { });
    public Task<JsonNode?> Put(string path, object? body = null) => Send(HttpMethod.Put, path, body ?? new { });
    public Task<JsonNode?> Patch(string path, object? body = null) => Send(HttpMethod.Patch, path, body ?? new { });
    public Task<JsonNode?> Delete(string path) => Send(HttpMethod.Delete, path);
}

public static class J
{
    public static ulong Id(JsonNode? n, string prop = "id")
    {
        if (n is JsonArray arr && arr.Count > 0) n = arr[0];
        var v = n?[prop] ?? throw new InvalidOperationException($"No '{prop}' in {n?.ToJsonString()}");
        return v.GetValueKind() == JsonValueKind.String ? ulong.Parse(v.GetValue<string>()) : v.GetValue<ulong>();
    }
    public static ulong? TryId(JsonNode? n, string prop = "id")
    {
        try { if (n is JsonArray a && a.Count > 0) n = a[0]; return n is not JsonObject || n[prop] is null ? null : Id(n, prop); } catch { return null; }
    }
    public static IEnumerable<JsonNode> Items(JsonNode? n)
    {
        if (n is JsonArray a) return a.Where(x => x is not null)!;
        foreach (var key in new[] { "items", "data", "results", "records" })
            if (n?[key] is JsonArray arr) return arr.Where(x => x is not null)!;
        return [];
    }
    public static string Str(JsonNode? n, string prop) => n?[prop]?.ToString() ?? "";
}

/// <summary>
/// Safety net while seeding the live database: in-app notifications, pushes and emails that the API
/// flows queue for anyone who is NOT a demo user (e.g. "new support request" to the gym's real
/// admins) are dropped before they are saved, so no real person is notified. Demo users' own rows
/// are kept (they have no push devices; their emails go to the reserved @gymbro-demo.test domain).
/// </summary>
public static class DemoGuard
{
    public const string DemoDomain = "@gymbro-demo.test";
    public static bool Enabled { get; set; }
    public static readonly HashSet<ulong> DemoUserIds = [];
    public static int SuppressedNotifications, SuppressedOutbound;

    public static void OnSaving(object? sender, Microsoft.EntityFrameworkCore.SavingChangesEventArgs e)
    {
        if (!Enabled || sender is not Microsoft.EntityFrameworkCore.DbContext ctx) return;
        foreach (var entry in ctx.ChangeTracker.Entries().Where(x => x.State == Microsoft.EntityFrameworkCore.EntityState.Added).ToList())
        {
            switch (entry.Entity)
            {
                case GymManagmentApplication.Domain.Entities.Communication.Notification n when !DemoUserIds.Contains(n.UserId):
                    entry.State = Microsoft.EntityFrameworkCore.EntityState.Detached;
                    SuppressedNotifications++;
                    break;
                case GymManagmentApplication.Domain.Entities.Communication.CommunicationLog l
                    when l.Direction == GymManagmentApplication.Domain.Enums.CommunicationDirection.Outbound
                         && !(l.UserId is { } uid && DemoUserIds.Contains(uid))
                         && !(l.Recipient ?? "").EndsWith(DemoDomain, StringComparison.OrdinalIgnoreCase)
                         && !IsDemoUserRecipient(l.Recipient):
                    entry.State = Microsoft.EntityFrameworkCore.EntityState.Detached;
                    SuppressedOutbound++;
                    break;
            }
        }
    }

    private static bool IsDemoUserRecipient(string? r) =>
        r is not null && r.StartsWith("user:") && ulong.TryParse(r[5..], out var id) && DemoUserIds.Contains(id);
}
