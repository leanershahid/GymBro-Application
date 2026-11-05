using GymManagmentApplication.Domain.Entities.Communication;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Infrastructure.Email;

/// <summary>
/// Transactional outbox for email (ARCH-046). <see cref="Enqueue"/> adds a Queued
/// <see cref="CommunicationLog"/> row to the caller's unit of work, so the email exists only if the
/// caller's SaveChanges commits; <see cref="EmailOutboxProcessor"/> then delivers it in the
/// background with retries, off the request path.
/// </summary>
public interface IEmailOutbox
{
    /// <param name="dedupeKey">Optional key (kept in ProviderRef): <see cref="AlreadyQueuedAsync"/> finds it later.</param>
    void Enqueue(ulong tenantId, ulong? userId, string to, string subject, string htmlBody, string? dedupeKey = null);

    /// <summary>The subset of <paramref name="dedupeKeys"/> already queued or sent for this gym.</summary>
    Task<HashSet<string>> AlreadyQueuedAsync(ulong tenantId, IReadOnlyCollection<string> dedupeKeys, CancellationToken ct = default);
}

public class EmailOutbox(AppDbContext db) : IEmailOutbox
{
    public void Enqueue(ulong tenantId, ulong? userId, string to, string subject, string htmlBody, string? dedupeKey = null) =>
        db.CommunicationLogs.Add(new CommunicationLog
        {
            TenantId = tenantId,
            UserId = userId,
            Channel = CommunicationChannel.Email,
            Direction = CommunicationDirection.Outbound,
            Recipient = to,
            Subject = subject,
            Body = htmlBody,
            Status = CommunicationStatus.Queued,
            ProviderRef = dedupeKey,
            CreatedAt = DateTime.UtcNow,
        });

    public async Task<HashSet<string>> AlreadyQueuedAsync(ulong tenantId, IReadOnlyCollection<string> dedupeKeys, CancellationToken ct = default)
    {
        if (dedupeKeys.Count == 0) return [];
        var keys = dedupeKeys.ToList();
        var found = await db.CommunicationLogs.IgnoreQueryFilters()
            .Where(l => l.TenantId == tenantId && l.Channel == CommunicationChannel.Email
                        && l.ProviderRef != null && keys.Contains(l.ProviderRef))
            .Select(l => l.ProviderRef!).ToListAsync(ct);
        return found.ToHashSet(StringComparer.Ordinal);
    }
}

/// <summary>
/// Delivers queued emails every few seconds. A Postgres advisory lock keeps two instances from
/// sending the same row; each email gets up to <see cref="MaxAttempts"/> tries, then Failed.
/// </summary>
public class EmailOutboxProcessor(IServiceScopeFactory scopes, ILogger<EmailOutboxProcessor> logger) : BackgroundService
{
    private static readonly TimeSpan Every = TimeSpan.FromSeconds(20);
    private const long LockKey = 0x6779_6D62_6F78; // "gymbox"
    private const int MaxAttempts = 5;
    private const int BatchSize = 25;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken); // let startup/migrations finish
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await DrainOnceAsync(stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException) { logger.LogError(ex, "Email outbox run failed."); }
            await Task.Delay(Every, stoppingToken);
        }
    }

    public async Task DrainOnceAsync(CancellationToken ct = default)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var sender = scope.ServiceProvider.GetRequiredService<IEmailSender>();

        await db.Database.OpenConnectionAsync(ct);
        try
        {
            var locked = await db.Database.SqlQuery<bool>($"SELECT pg_try_advisory_lock({LockKey}) AS \"Value\"").SingleAsync(ct);
            if (!locked) return;
            try
            {
                var batch = await db.CommunicationLogs.IgnoreQueryFilters()
                    .Where(l => l.Channel == CommunicationChannel.Email && l.Direction == CommunicationDirection.Outbound
                                && l.Status == CommunicationStatus.Queued)
                    .OrderBy(l => l.CreatedAt).ThenBy(l => l.Id)
                    .Take(BatchSize).ToListAsync(ct);

                foreach (var mail in batch)
                {
                    var sent = await sender.SendAsync(mail.Recipient, mail.Subject ?? "", mail.Body ?? "");
                    mail.Attempts++;
                    if (sent)
                    {
                        mail.Status = CommunicationStatus.Sent;
                        mail.DeliveredAt = DateTime.UtcNow;
                    }
                    else if (mail.Attempts >= MaxAttempts)
                    {
                        mail.Status = CommunicationStatus.Failed;
                        logger.LogWarning("Giving up on email {Id} '{Subject}' after {Attempts} attempts.", mail.Id, mail.Subject, mail.Attempts);
                    }
                    await db.SaveChangesAsync(ct);
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
