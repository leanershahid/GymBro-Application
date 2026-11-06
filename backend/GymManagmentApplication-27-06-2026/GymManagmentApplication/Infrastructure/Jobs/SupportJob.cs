using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Support;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Infrastructure.Jobs;

/// <summary>
/// Help desk housekeeping (feature 6), hourly: closes requests resolved more than 7 days ago and
/// sends each gym's support staff one overdue digest a day (from 8am gym time; dedupe key per gym,
/// day and person). A Postgres advisory lock keeps two server instances from running it together.
/// </summary>
public class SupportJob(IServiceScopeFactory scopes, ILogger<SupportJob> logger) : BackgroundService
{
    private static readonly TimeSpan Every = TimeSpan.FromHours(1);
    private const long LockKey = 0x6779_6D62_7370; // "gymbsp"

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(70), stoppingToken); // let startup/migrations finish
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await RunOnceAsync(stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException) { logger.LogError(ex, "Support job failed."); }
            await Task.Delay(Every, stoppingToken);
        }
    }

    public async Task RunOnceAsync(CancellationToken ct = default)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var isPg = db.Database.IsNpgsql();
        if (isPg)
        {
            await db.Database.OpenConnectionAsync(ct);
            var locked = await db.Database.SqlQuery<bool>($"SELECT pg_try_advisory_lock({LockKey}) AS \"Value\"").SingleAsync(ct);
            if (!locked) { await db.Database.CloseConnectionAsync(); return; }
        }
        try
        {
            var tenants = await db.Tenants.Where(t => t.Status != TenantStatus.Cancelled)
                .Select(t => new { t.Id, t.Timezone }).ToListAsync(ct);
            var now = DateTime.UtcNow;
            foreach (var t in tenants)
            {
                var local = TimeZoneInfo.ConvertTimeFromUtc(now, TenantClock.Resolve(t.Timezone));
                using var tenantScope = scopes.CreateScope();
                try
                {
                    var svc = tenantScope.ServiceProvider.GetRequiredService<SupportJobService>();
                    await svc.CloseStaleAsync(t.Id, now, ct);
                    await svc.SendDigestAsync(t.Id, now, DateOnly.FromDateTime(local), local.Hour, ct);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    logger.LogError(ex, "Support job failed for tenant {TenantId}.", t.Id);
                }
            }
        }
        finally
        {
            if (isPg)
            {
                await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_unlock({LockKey})", ct);
                await db.Database.CloseConnectionAsync();
            }
        }
    }
}
