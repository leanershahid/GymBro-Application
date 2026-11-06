using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.SelfService;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Infrastructure.Jobs;

/// <summary>
/// Carries out approved membership requests on their dates (feature 4): starts and ends pauses,
/// cancels after the last day, switches plan at renewal. Hourly, per gym in the gym's own "today";
/// each step is idempotent (AppliedAt / CompletedAt), and a Postgres advisory lock keeps two server
/// instances from running it together.
/// </summary>
public class MembershipRequestJob(IServiceScopeFactory scopes, ILogger<MembershipRequestJob> logger) : BackgroundService
{
    private static readonly TimeSpan Every = TimeSpan.FromHours(1);
    private const long LockKey = 0x6779_6D62_6D72; // "gymbmr"

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(50), stoppingToken); // let startup/migrations finish
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await RunOnceAsync(stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException) { logger.LogError(ex, "Membership request job failed."); }
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
            foreach (var t in tenants)
            {
                var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TenantClock.Resolve(t.Timezone)));
                // A fresh scope (DbContext) per gym keeps failures isolated.
                using var tenantScope = scopes.CreateScope();
                try
                {
                    var n = await tenantScope.ServiceProvider.GetRequiredService<MembershipRequestService>().ApplyDueAsync(t.Id, today, ct);
                    if (n > 0) logger.LogInformation("Applied {Count} membership request step(s) for tenant {TenantId}.", n, t.Id);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    logger.LogError(ex, "Membership request job failed for tenant {TenantId}.", t.Id);
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
