using GymManagmentApplication.Application.Billing.Requests;
using GymManagmentApplication.Application.Billing.Services;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Membership;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using GymManagmentApplication.Infrastructure.Email;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Infrastructure.Jobs;

/// <summary>
/// Housekeeping that has to happen without anyone clicking anything. Runs hourly; each step is
/// idempotent and judged by each gym's own "today", and a Postgres advisory lock keeps two
/// server instances from running it at the same time.
/// <list type="bullet">
/// <item>Memberships past their end date: auto-renew (new period + invoice) when the member owes
/// nothing overdue, otherwise mark Expired.</item>
/// <item>Unpaid invoices past their due date → Overdue.</item>
/// <item>Reminder email 3 days before a membership ends (once: only on that exact day).</item>
/// <item>Expired sign-in sessions and one-time codes are deleted.</item>
/// </list>
/// </summary>
public class DailyJobs(IServiceScopeFactory scopes, ILogger<DailyJobs> logger) : BackgroundService
{
    private static readonly TimeSpan Every = TimeSpan.FromHours(1);
    private const long LockKey = 0x6779_6D62_726F; // "gymbro"
    private const int ReminderDaysBefore = 3;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken); // let startup/migrations finish
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await RunOnceAsync(stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException) { logger.LogError(ex, "Daily jobs failed."); }
            await Task.Delay(Every, stoppingToken);
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
            if (!locked) return; // another instance is on it
            try
            {
                var tenants = await db.Tenants.Where(t => t.Status != TenantStatus.Cancelled)
                    .Select(t => new { t.Id, t.Timezone, t.Name }).ToListAsync(ct);
                foreach (var t in tenants)
                {
                    var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TenantClock.Resolve(t.Timezone)));
                    await RunForTenantAsync(scope.ServiceProvider, t.Id, t.Name, today, ct);
                }

                var now = DateTime.UtcNow;
                await db.UserSessions.Where(s => s.ExpiresAt < now).ExecuteDeleteAsync(ct);
                await db.AuthCodes.Where(c => c.ExpiresAt < now.AddDays(-1)).ExecuteDeleteAsync(ct);
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

    private async Task RunForTenantAsync(IServiceProvider sp, ulong tenantId, string gymName, DateOnly today, CancellationToken ct)
    {
        var db = sp.GetRequiredService<AppDbContext>();
        var billing = sp.GetRequiredService<BillingCore>();
        var email = sp.GetRequiredService<IEmailSender>();

        // 1. Overdue invoices.
        await db.Invoices
            .Where(i => i.TenantId == tenantId && i.Status == InvoiceStatus.Sent && i.DueDate < today && i.Total > i.AmountPaid)
            .ExecuteUpdateAsync(s => s.SetProperty(i => i.Status, InvoiceStatus.Overdue), ct);

        // 2. Memberships that have run out.
        var lapsed = await db.GymMemberships.Include(m => m.Plan)
            .Where(m => m.TenantId == tenantId && (m.Status == MembershipStatus.Active || m.Status == MembershipStatus.Trial)
                        && m.EndsAt != null && m.EndsAt < today)
            .ToListAsync(ct);
        foreach (var m in lapsed)
        {
            var owes = await db.Invoices.AnyAsync(i => i.UserId == m.UserId && i.Status == InvoiceStatus.Overdue, ct);
            if (m.AutoRenew && m.Plan is { IsActive: true } plan && !owes)
            {
                var from = m.EndsAt!.Value;
                var days = plan.BillingCycle switch
                {
                    BillingCycle.Daily => 1, BillingCycle.Weekly => 7, BillingCycle.Quarterly => 90,
                    BillingCycle.HalfYearly => 180, BillingCycle.Yearly => 365, _ => 30,
                };
                m.EndsAt = from.AddDays(days);
                await billing.CreateInvoiceAsync(new BillingCore.NewInvoice(tenantId, m.UserId,
                    [new InvoiceLineItem { Description = $"{plan.Name} membership renewal ({from:dd MMM yyyy} – {from.AddDays(days - 1):dd MMM yyyy})", UnitPrice = plan.Price, Quantity = 1 }],
                    DueDate: from, MembershipId: m.Id, Notes: "Auto-renewal"));
                logger.LogInformation("Auto-renewed membership {Id} for user {User}.", m.Id, m.UserId);
            }
            else
            {
                m.Status = MembershipStatus.Expired;
            }
            await db.SaveChangesAsync(ct);
        }

        // 3. "Ends in 3 days" reminders.
        var soon = today.AddDays(ReminderDaysBefore);
        var ending = await db.GymMemberships.Include(m => m.Plan).Include(m => m.User)
            .Where(m => m.TenantId == tenantId && m.Status == MembershipStatus.Active && m.EndsAt == soon && !m.AutoRenew)
            .ToListAsync(ct);
        foreach (var m in ending.Where(m => !string.IsNullOrEmpty(m.User.Email)))
        {
            var html = EmailTemplates.Wrap("Your membership ends soon", $"""
                <p>Hi {System.Net.WebUtility.HtmlEncode(m.User.FirstName ?? "there")},</p>
                <p>Your <b>{System.Net.WebUtility.HtmlEncode(m.Plan.Name)}</b> membership at {System.Net.WebUtility.HtmlEncode(gymName)} ends on <b>{soon:dd MMM yyyy}</b>.</p>
                <p>Renew at the front desk to keep training without a break.</p>
                """);
            await email.SendAsync(m.User.Email!, $"Your {gymName} membership ends on {soon:dd MMM}", html);
        }
    }
}
