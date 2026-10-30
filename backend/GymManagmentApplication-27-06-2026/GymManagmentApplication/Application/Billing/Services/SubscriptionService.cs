using GymManagmentApplication.Application.Billing.Interfaces;
using GymManagmentApplication.Application.Billing.Requests;
using GymManagmentApplication.Application.Billing.Responses;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Membership;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Billing.Services;

public class SubscriptionService(AppDbContext db, ICurrentUser currentUser, BillingCore billing) : ISubscriptionService
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

    public async Task<PagedResponse<SubscriptionResponse>> GetAllAsync(ulong tenantId, int page, int size, ulong? memberId = null)
    {
        tenantId = currentUser.ResolveTenantId(tenantId);
        (page, size) = Paging.Clamp(page, size);
        var query = db.GymMemberships.Include(m => m.Plan).Include(m => m.User)
            .Where(m => m.TenantId == tenantId);
        if (memberId is { } mid) query = query.Where(m => m.UserId == mid);
        var total = await query.CountAsync();
        var items = await query.OrderByDescending(m => m.Id).Page(page, size).ToListAsync();
        return new PagedResponse<SubscriptionResponse>
        {
            Items = items.Select(Map), PageNumber = page,
            PageSize = size, TotalRecords = total
        };
    }

    public async Task<SubscriptionResponse> CreateAsync(CreateSubscriptionRequest request)
    {
        request.TenantId = currentUser.ResolveTenantId(request.TenantId);
        await db.EnsureUserAsync(request.MemberId, request.TenantId);
        await db.EnsureMembershipPlanAsync(request.PlanId, request.TenantId);
        await db.EnsureBranchAsync(request.BranchId, request.TenantId);

        var plan = await db.MembershipPlans.IgnoreQueryFilters().FirstAsync(p => p.Id == request.PlanId);
        var memberBranch = await db.Users.IgnoreQueryFilters()
            .Where(u => u.Id == request.MemberId).Select(u => u.BranchId).FirstAsync();
        var days = CycleToDays(plan.BillingCycle);
        if (!plan.IsActive) throw new ArgumentException($"The plan '{plan.Name}' is archived.");
        var membership = new GymMembership
        {
            TenantId = request.TenantId,
            BranchId = request.BranchId is > 0 ? request.BranchId : plan.BranchId ?? memberBranch,
            UserId = request.MemberId,
            PlanId = request.PlanId,
            StartsAt = request.StartDate,
            EndsAt = request.StartDate.AddDays(days),
            Status = MembershipStatus.Active,
            AutoRenew = true,
            Source = MembershipSource.Admin,
        };
        db.GymMemberships.Add(membership);

        await using var tx = await db.Database.BeginTransactionAsync();
        await db.SaveChangesAsync(); // membership id for the invoice
        var invoice = await InvoicePlanAsync(membership, plan, request.TaxPercent, request.Discount,
            request.PayNowMethod, request.PaymentReference, request.StartDate);
        await db.SaveChangesAsync();
        await tx.CommitAsync();

        await db.Entry(membership).Reference(m => m.Plan).LoadAsync();
        await db.Entry(membership).Reference(m => m.User).LoadAsync();
        var response = Map(membership);
        response.InvoiceId = invoice.Id;
        return response;
    }

    /// <summary>Raises the plan's invoice for a membership period, paid now at the desk if a method is given.</summary>
    private async Task<Domain.Entities.Billing.Invoice> InvoicePlanAsync(GymMembership m, MembershipPlan plan,
        decimal taxPercent, decimal discount, string? payNowMethod, string? reference, DateOnly periodStart)
    {
        var days = CycleToDays(plan.BillingCycle);
        var invoice = await billing.CreateInvoiceAsync(new BillingCore.NewInvoice(
            m.TenantId, m.UserId,
            [new InvoiceLineItem { Description = $"{plan.Name} membership ({periodStart:dd MMM yyyy} – {periodStart.AddDays(days - 1):dd MMM yyyy})", UnitPrice = plan.Price, Quantity = 1 }],
            taxPercent, discount, DueDate: periodStart, MembershipId: m.Id));
        if (!string.IsNullOrWhiteSpace(payNowMethod) && invoice.Total > 0)
            billing.ApplyPayment(invoice, invoice.Total, PaymentService.ParseMethod(payNowMethod), reference, null, currentUser.UserId, "Paid at sign-up/renewal");
        return invoice;
    }

    public async Task<SubscriptionResponse?> GetByIdAsync(ulong id)
    {
        var m = await db.GymMemberships.Include(x => x.Plan).Include(x => x.User).FirstOrDefaultAsync(x => x.Id == id);
        return m is null ? null : Map(m);
    }

    public async Task<SubscriptionResponse?> RenewAsync(ulong id, RenewSubscriptionRequest? request = null)
    {
        var m = await db.GymMemberships.Include(x => x.Plan).FirstOrDefaultAsync(x => x.Id == id);
        if (m is null) return null;
        if (m.Status == MembershipStatus.Cancelled)
            throw new ArgumentException("A cancelled membership can't be renewed — create a new one.");
        var days = CycleToDays(m.Plan?.BillingCycle);
        // Extend from the current end date, or from today if it already lapsed.
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var from = m.EndsAt is { } end && end > today ? end : today;
        m.EndsAt = from.AddDays(days);
        m.Status = MembershipStatus.Active;
        m.PausedAt = null;
        // Every renewal is billed: the new period gets its own invoice.
        var invoice = await InvoicePlanAsync(m, m.Plan, request?.TaxPercent ?? 0, request?.Discount ?? 0,
            request?.PayNowMethod, request?.PaymentReference, from);
        await db.SaveChangesAsync();
        await db.Entry(m).Reference(x => x.User).LoadAsync();
        var response = Map(m);
        response.InvoiceId = invoice.Id;
        return response;
    }

    public async Task<SubscriptionResponse?> UpgradeAsync(ulong id, UpgradeDowngradeRequest request)
    {
        var m = await db.GymMemberships.Include(x => x.Plan).FirstOrDefaultAsync(x => x.Id == id);
        if (m is null) return null;
        if (m.Status == MembershipStatus.Cancelled)
            throw new ArgumentException("A cancelled membership can't change plan.");
        // The new plan must belong to the same gym as the membership.
        await db.EnsureMembershipPlanAsync(request.NewPlanId, m.TenantId);
        m.PlanId = request.NewPlanId;
        m.UpdatedAt = DateTime.UtcNow;
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
        if (m.Status != MembershipStatus.Active)
            throw new ArgumentException("Only an active membership can be frozen.");
        m.Status = MembershipStatus.Paused;
        m.PausedAt = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(request.Reason))
            m.Notes = $"{m.Notes}\n[{DateTime.UtcNow:yyyy-MM-dd}] Frozen: {request.Reason.Trim()}".Trim();
        m.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Map(m);
    }

    public async Task<SubscriptionResponse?> UnfreezeAsync(ulong id)
    {
        var m = await db.GymMemberships.Include(x => x.Plan).FirstOrDefaultAsync(x => x.Id == id);
        if (m is null) return null;
        if (m.Status != MembershipStatus.Paused)
            throw new ArgumentException("This membership isn't frozen.");
        // Give back the frozen days: push the end date out by the length of the pause.
        if (m.PausedAt is { } pausedAt && m.EndsAt is { } end)
            m.EndsAt = end.AddDays((int)Math.Ceiling((DateTime.UtcNow - pausedAt).TotalDays));
        m.Status = MembershipStatus.Active;
        m.PausedAt = null;
        m.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Map(m);
    }

    public async Task<bool> CancelAsync(ulong id)
    {
        var m = await db.GymMemberships.FirstOrDefaultAsync(x => x.Id == id);
        if (m is null) return false;
        m.Status = MembershipStatus.Cancelled;
        m.CancelledAt = DateTime.UtcNow;
        m.AutoRenew = false;
        m.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<SubscriptionUsageResponse?> GetUsageAsync(ulong id)
    {
        var m = await db.GymMemberships.FirstOrDefaultAsync(x => x.Id == id);
        if (m is null) return null;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var start = m.StartsAt.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        return new SubscriptionUsageResponse
        {
            SubscriptionId = id,
            ClassBookingsUsed = 0, // class booking isn't available yet
            PtSessionsUsed = 0,    // PT sessions aren't available yet
            Visits = await db.Attendances.CountAsync(a => a.UserId == m.UserId && a.CheckInAt >= start),
            DaysActive = Math.Max(0, today.DayNumber - m.StartsAt.DayNumber),
            DaysRemaining = m.EndsAt is { } end ? Math.Max(0, end.DayNumber - today.DayNumber) : 0,
        };
    }

    public static SubscriptionResponse Map(GymMembership m) => new()
    {
        Id = m.Id, TenantId = m.TenantId, MemberId = m.UserId,
        PlanId = m.PlanId, PlanName = m.Plan?.Name ?? string.Empty,
        Status = m.Status.ToString(), StartDate = m.StartsAt,
        EndDate = m.EndsAt, NextRenewalDate = m.EndsAt,
        Price = m.Plan?.Price ?? 0, Currency = m.Plan?.Currency ?? "INR",
        CreatedAt = m.CreatedAt, AutoRenew = m.AutoRenew,
        FrozenFrom = m.PausedAt is { } p ? DateOnly.FromDateTime(p) : null,
        MemberName = m.User is null ? null : $"{m.User.FirstName} {m.User.LastName}".Trim(),
    };

}
