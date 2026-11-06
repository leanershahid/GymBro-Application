using GymManagmentApplication.Application.Privacy;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Infrastructure.Jobs;

/// <summary>
/// Privacy background work (feature 2), guarded by a Postgres advisory lock like <see cref="DailyJobs"/>:
/// <list type="bullet">
/// <item>every minute: build queued data exports and upload them to private storage;</item>
/// <item>hourly: expire exports older than 7 days (file deleted) and anonymise accounts whose grace
/// period has ended, gym by gym in a fresh scope.</item>
/// </list>
/// The logic lives in <see cref="PrivacyProcessor"/> (unit-tested); this class only schedules it.
/// </summary>
public class PrivacyJobs(IServiceScopeFactory scopes, ILogger<PrivacyJobs> logger) : BackgroundService
{
    private static readonly TimeSpan Tick = TimeSpan.FromMinutes(1);
    private static readonly TimeSpan HousekeepingEvery = TimeSpan.FromHours(1);
    private const long LockKey = 0x6779_6D62_7072; // "gymbpr"
    private DateTime _lastHousekeeping = DateTime.MinValue;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(45), stoppingToken); // let startup/migrations finish
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await RunOnceAsync(stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException) { logger.LogError(ex, "Privacy jobs failed."); }
            await Task.Delay(Tick, stoppingToken);
        }
    }

    public async Task RunOnceAsync(CancellationToken ct = default)
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
                using (var exportScope = scopes.CreateScope())
                    await exportScope.ServiceProvider.GetRequiredService<PrivacyProcessor>().ProcessQueuedExportsAsync(now, ct: ct);

                if (now - _lastHousekeeping < HousekeepingEvery) return;
                _lastHousekeeping = now;

                using (var expireScope = scopes.CreateScope())
                    await expireScope.ServiceProvider.GetRequiredService<PrivacyProcessor>().ExpireExportsAsync(now, ct);

                var tenants = await db.Tenants.Where(t => t.Status != TenantStatus.Cancelled).Select(t => t.Id).ToListAsync(ct);
                foreach (var tenantId in tenants)
                {
                    using var tenantScope = scopes.CreateScope();
                    try { await tenantScope.ServiceProvider.GetRequiredService<PrivacyProcessor>().RunDueDeletionsAsync(tenantId, now, ct); }
                    catch (Exception ex) when (ex is not OperationCanceledException)
                    {
                        logger.LogError(ex, "Privacy deletions failed for tenant {TenantId}.", tenantId);
                    }
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
}
