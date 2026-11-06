using GymManagmentApplication.Application.Operations;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Infrastructure.Jobs;

/// <summary>
/// Sends scheduled announcements once their time comes, and finishes any delivery that was
/// interrupted (server restart mid-send). Runs every minute. Idempotent: the publisher claims each
/// announcement with a lease and resumes from its saved cursor, so overlapping runs (or a second
/// server instance) never notify anyone twice; a Postgres advisory lock additionally keeps
/// instances from scanning at the same time.
/// </summary>
public class AnnouncementPublishJob(IServiceScopeFactory scopes, ILogger<AnnouncementPublishJob> logger) : BackgroundService
{
    private static readonly TimeSpan Every = TimeSpan.FromMinutes(1);
    private const long LockKey = 0x6779_6D62_616E; // "gymban"

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(45), stoppingToken); // let startup/migrations finish
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await RunOnceAsync(stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException) { logger.LogError(ex, "Announcement publish job failed."); }
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
            var publisher = scope.ServiceProvider.GetRequiredService<AnnouncementPublisher>();
            var n = await publisher.PublishDueAsync(DateTime.UtcNow, ct);
            if (n > 0) logger.LogInformation("Published {Count} scheduled announcement(s).", n);
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
