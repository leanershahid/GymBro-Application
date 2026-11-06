using GymManagmentApplication.Application.Engagement;
using GymManagmentApplication.Application.Scheduling;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Infrastructure.Jobs;

/// <summary>
/// Cancellation / no-show rules (feature 9), every 5 minutes: the automatic no-show for classes
/// whose attendance was never taken (gyms that switched it on) and "you can book again" notices
/// for booking blocks that ran out. A Postgres advisory lock keeps two server instances apart;
/// penalties are idempotent per booking anyway.
/// </summary>
public class BookingRulesJob(IServiceScopeFactory scopes, ILogger<BookingRulesJob> logger) : BackgroundService
{
    private static readonly TimeSpan Every = TimeSpan.FromMinutes(5);
    private const long LockKey = 0x6779_6D62_6272; // "gymbbr"

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(80), stoppingToken); // let startup/migrations finish
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await RunOnceAsync(stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException) { logger.LogError(ex, "Booking rules job failed."); }
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
            var tenants = await db.Tenants.Where(t => t.Status != TenantStatus.Cancelled).Select(t => t.Id).ToListAsync(ct);
            foreach (var tenantId in tenants)
            {
                using var tenantScope = scopes.CreateScope();
                try
                {
                    var tdb = tenantScope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var engine = new BookingPenaltyEngine(tdb, tenantScope.ServiceProvider.GetRequiredService<Notifier>());
                    var now = DateTime.UtcNow;
                    var marked = await engine.RunAutoNoShowAsync(tenantId, now, ct);
                    await engine.NotifyEndedBlocksAsync(tenantId, now, ct);
                    if (marked > 0) logger.LogInformation("Auto no-show: {Count} booking(s) marked for tenant {TenantId}.", marked, tenantId);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    logger.LogError(ex, "Booking rules job failed for tenant {TenantId}.", tenantId);
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
