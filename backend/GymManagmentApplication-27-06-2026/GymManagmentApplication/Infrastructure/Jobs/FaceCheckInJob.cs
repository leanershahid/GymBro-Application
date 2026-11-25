using GymManagmentApplication.Application.Attendance.Face;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Infrastructure.Jobs;

/// <summary>
/// Face check-in retention, once a day (and shortly after start-up, since the free Render instance
/// sleeps): deletes kept check-in selfies older than each gym's <c>keepCheckInSelfiesDays</c>
/// (all of them when the gym keeps none). A Postgres advisory lock keeps two instances apart, like
/// the other jobs. The logic is <see cref="FaceCheckInService.PurgeExpiredSelfiesAsync"/> (unit-tested).
/// </summary>
public class FaceCheckInJob(IServiceScopeFactory scopes, ILogger<FaceCheckInJob> logger) : BackgroundService
{
    private static readonly TimeSpan Every = TimeSpan.FromHours(24);
    private const long LockKey = 0x6779_6D62_6663; // "gymbfc"

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(100), stoppingToken); // let startup/migrations finish
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await RunOnceAsync(stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException) { logger.LogError(ex, "Face check-in retention job failed."); }
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
            // Only gyms that have selfies on file.
            var tenants = await db.FaceCheckInAttempts.Where(a => a.SelfieUrl != null).Select(a => a.TenantId).Distinct().ToListAsync(ct);
            foreach (var tenantId in tenants)
            {
                using var tenantScope = scopes.CreateScope();
                try
                {
                    var tdb = tenantScope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var storage = tenantScope.ServiceProvider.GetRequiredService<IFileStorage>();
                    int deleted, total = 0;
                    do
                    {
                        deleted = await FaceCheckInService.PurgeExpiredSelfiesAsync(tdb, storage, tenantId, DateTime.UtcNow, ct);
                        total += deleted;
                    } while (deleted >= 500 && !ct.IsCancellationRequested);
                    if (total > 0) logger.LogInformation("Face check-in: deleted {Count} expired selfie(s) for tenant {TenantId}.", total, tenantId);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    logger.LogError(ex, "Face check-in retention failed for tenant {TenantId}.", tenantId);
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
