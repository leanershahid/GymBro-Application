using GymManagmentApplication.Application.Billing.Interfaces;
using GymManagmentApplication.Application.Billing.Requests;
using GymManagmentApplication.Application.Billing.Responses;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Membership;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Billing.Services;

public class SubscriptionService(AppDbContext db) : ISubscriptionService
{
    private static int CycleToDays(BillingCycle? cycle) => cycle switch
    {
        BillingCycle.Daily       => 1,
        BillingCycle.Weekly      => 7,
        BillingCycle.Monthly     => 30,
        BillingCycle.Quarterly   => 90,
        BillingCycle.HalfYearly  => 180,
        BillingCycle.Yearly      => 365,
        _                        => 30
    };

    public async Task<PagedResponse<SubscriptionResponse>> GetAllAsync(ulong tenantId, int page, int size)
    {
        var query = db.GymMemberships.Include(m => m.Plan)
            .Where(m => m.TenantId == tenantId);
        var total = await query.CountAsync();
        var items = await query.Skip((page - 1) * size).Take(size).ToListAsync();
        return new PagedResponse<SubscriptionResponse>
        {
            Items = items.Select(Map), PageNumber = page,
            PageSize = size, TotalRecords = total
        };
    }

    public async Task<SubscriptionResponse> CreateAsync(CreateSubscriptionRequest request)
    {
        var plan = await db.MembershipPlans.FindAsync(request.PlanId);
        var days = CycleToDays(plan?.BillingCycle);
        var membership = new GymMembership
        {
            Id = await NextIdAsync(),
            TenantId = request.TenantId,
            UserId = request.MemberId,
            PlanId = request.PlanId,
            StartsAt = request.StartDate,
            EndsAt = request.StartDate.AddDays(days),
            Status = MembershipStatus.Active,
            AutoRenew = true
        };
        db.GymMemberships.Add(membership);
        await db.SaveChangesAsync();
        await db.Entry(membership).Reference(m => m.Plan).LoadAsync();
        return Map(membership);
    }

    public async Task<SubscriptionResponse?> GetByIdAsync(ulong id)
    {
        var m = await db.GymMemberships.Include(x => x.Plan).FirstOrDefaultAsync(x => x.Id == id);
        return m is null ? null : Map(m);
    }

    public async Task<SubscriptionResponse?> RenewAsync(ulong id)
    {
        var m = await db.GymMemberships.Include(x => x.Plan).FirstOrDefaultAsync(x => x.Id == id);
        if (m is null) return null;
        var days = CycleToDays(m.Plan?.BillingCycle);
        m.EndsAt = (m.EndsAt ?? DateOnly.FromDateTime(DateTime.UtcNow)).AddDays(days);
        m.Status = MembershipStatus.Active;
        await db.SaveChangesAsync();
        return Map(m);
    }

    public async Task<SubscriptionResponse?> UpgradeAsync(ulong id, UpgradeDowngradeRequest request)
    {
        var m = await db.GymMemberships.Include(x => x.Plan).FirstOrDefaultAsync(x => x.Id == id);
        if (m is null) return null;
        m.PlanId = request.NewPlanId;
        await db.SaveChangesAsync();
        await db.Entry(m).Reference(x => x.Plan).LoadAsync();
        return Map(m);
    }

    public async Task<SubscriptionResponse?> DowngradeAsync(ulong id, UpgradeDowngradeRequest request)
        => await UpgradeAsync(id, request);

    public async Task<SubscriptionResponse?> FreezeAsync(ulong id, FreezeSubscriptionRequest request)
    {
        var m = await db.GymMemberships.Include(x => x.Plan).FirstOrDefaultAsync(x => x.Id == id);
        if (m is null) return null;
        m.Status = MembershipStatus.Paused;
        m.PausedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Map(m);
    }

    public async Task<SubscriptionResponse?> UnfreezeAsync(ulong id)
    {
        var m = await db.GymMemberships.Include(x => x.Plan).FirstOrDefaultAsync(x => x.Id == id);
        if (m is null) return null;
        m.Status = MembershipStatus.Active;
        m.PausedAt = null;
        await db.SaveChangesAsync();
        return Map(m);
    }

    public async Task<bool> CancelAsync(ulong id)
    {
        var m = await db.GymMemberships.FindAsync(id);
        if (m is null) return false;
        m.Status = MembershipStatus.Cancelled;
        m.CancelledAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return true;
    }

    public Task<SubscriptionUsageResponse?> GetUsageAsync(ulong id) =>
        Task.FromResult<SubscriptionUsageResponse?>(new SubscriptionUsageResponse
        {
            SubscriptionId = id, ClassBookingsUsed = 0,
            PtSessionsUsed = 0, DaysActive = 0, DaysRemaining = 30
        });

    private static SubscriptionResponse Map(GymMembership m) => new()
    {
        Id = m.Id, TenantId = m.TenantId, MemberId = m.UserId,
        PlanId = m.PlanId, PlanName = m.Plan?.Name ?? string.Empty,
        Status = m.Status.ToString(), StartDate = m.StartsAt,
        EndDate = m.EndsAt, NextRenewalDate = m.EndsAt,
        Price = m.Plan?.Price ?? 0, Currency = m.Plan?.Currency ?? "USD",
        CreatedAt = m.CreatedAt
    };

    private async Task<ulong> NextIdAsync() =>
        (await db.GymMemberships.MaxAsync(m => (ulong?)m.Id) ?? 0) + 1;
}
