using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Dashboard.Interfaces;
using GymManagmentApplication.Application.Dashboard.Responses;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace GymManagmentApplication.Application.Dashboard.Services;

public class DashboardService(AppDbContext db, ICurrentUser currentUser, IMemoryCache cache) : IDashboardService
{
    private const string ClientRoleSlug = "client";
    private static readonly TimeSpan CacheFor = TimeSpan.FromSeconds(30);

    /// <summary>
    /// The overview is the same for everyone who sees the same slice of the gym, and it costs about ten
    /// round trips to the database, so it is kept for 30 seconds per tenant/branch scope. The query
    /// filters (tenant, branch) are part of the key because they change what the numbers cover.
    /// </summary>
    public async Task<DashboardOverviewResponse> GetOverviewAsync()
    {
        var key = $"dashboard-overview:{currentUser.TenantId?.ToString() ?? "all"}:{currentUser.BranchId?.ToString() ?? "all"}:{currentUser.IsSuperAdmin}";
        return (await cache.GetOrCreateAsync(key, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = CacheFor;
            return ComputeOverviewAsync();
        }))!;
    }

    private async Task<DashboardOverviewResponse> ComputeOverviewAsync()
    {
        // Day/month boundaries follow the gym's time zone, not UTC.
        var clock = await TenantClock.ForAsync(db, currentUser.TenantId);
        var startOfThisMonth = clock.StartOfMonthUtc();
        var startOfLastMonth = clock.StartOfMonthUtc(1);
        var startOfToday = clock.StartOfTodayUtc;

        var clientUsers = db.Users.Where(u => u.DeletedAt == null && u.Role != null && u.Role.Slug == ClientRoleSlug);

        // One query for the four member counts (was four).
        var members = await clientUsers
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Count(),
                Today = g.Count(u => u.CreatedAt >= startOfToday),
                ThisMonth = g.Count(u => u.CreatedAt >= startOfThisMonth),
                LastMonth = g.Count(u => u.CreatedAt >= startOfLastMonth && u.CreatedAt < startOfThisMonth),
            })
            .FirstOrDefaultAsync();
        var totalMembers = members?.Total ?? 0;
        var newSignupsToday = members?.Today ?? 0;
        var memberGrowthPct = GrowthPct(members?.ThisMonth ?? 0, members?.LastMonth ?? 0);

        // One query for the three revenue figures (was three).
        var completedPayments = db.Payments.Where(p => p.Status == PaymentStatus.Completed);
        var revenue = await completedPayments
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Sum(p => p.Amount),
                ThisMonth = g.Sum(p => p.CreatedAt >= startOfThisMonth ? p.Amount : 0m),
                LastMonth = g.Sum(p => p.CreatedAt >= startOfLastMonth && p.CreatedAt < startOfThisMonth ? p.Amount : 0m),
            })
            .FirstOrDefaultAsync();
        var totalRevenue = revenue?.Total ?? 0m;
        var revenueGrowthPct = GrowthPct((double)(revenue?.ThisMonth ?? 0m), (double)(revenue?.LastMonth ?? 0m));

        // "Online"/"present" means an open attendance row today (checked in, not yet checked out) —
        // not a manually-set availability flag, which can go stale.
        var openToday = db.Attendances.Where(a => a.CheckOutAt == null && a.CheckInAt >= startOfToday);

        var totalTrainers = await db.TrainerProfiles.CountAsync();
        // Counted in the database — no loading every member id into memory.
        var trainersOnline = await db.TrainerProfiles.CountAsync(t => openToday.Any(a => a.UserId == t.UserId));
        var membersPresent = await clientUsers.CountAsync(u => openToday.Any(a => a.UserId == u.Id));

        var totalTenants = currentUser.IsSuperAdmin ? await db.Tenants.CountAsync() : 1;

        // Members whose trainer was removed/deactivated (assignment paused) and who haven't
        // been given a new active trainer since — one query (was two plus an in-memory diff).
        var membersNeedingTrainer = await db.TrainerClientAssignments
            .Where(a => a.Status == TrainerAssignmentStatus.Paused
                && !db.TrainerClientAssignments.Any(b => b.ClientId == a.ClientId && b.Status == TrainerAssignmentStatus.Active))
            .Select(a => a.ClientId)
            .Distinct()
            .CountAsync();

        var trendStart = startOfThisMonth.AddMonths(-6);
        var recentPayments = await completedPayments
            .Where(p => p.CreatedAt >= trendStart)
            .Select(p => new { p.CreatedAt, p.Amount })
            .ToListAsync();
        var revenueTrend = Enumerable.Range(0, 7)
            .Select(offset => trendStart.AddMonths(offset))
            .Select(monthStart => new RevenueTrendPointResponse
            {
                Label = monthStart.ToString("MMM"),
                Value = recentPayments
                    .Where(p => p.CreatedAt.Year == monthStart.Year && p.CreatedAt.Month == monthStart.Month)
                    .Sum(p => p.Amount)
            })
            .ToList();

        var branches = await db.Branches
            .Select(b => new BranchSummaryResponse
            {
                Id = b.Id,
                Name = b.Name,
                City = b.City,
                MemberCount = db.Users.Count(u => u.DeletedAt == null && u.Role != null && u.Role.Slug == ClientRoleSlug && u.BranchId == b.Id),
                Revenue = db.Payments
                    .Where(p => p.Status == PaymentStatus.Completed && p.Invoice.User.BranchId == b.Id)
                    .Sum(p => (decimal?)p.Amount) ?? 0m,
                OccupancyPct = b.Capacity == null || b.Capacity == 0
                    ? 0
                    : 100.0 * db.Users.Count(u => u.DeletedAt == null && u.Role != null && u.Role.Slug == ClientRoleSlug && u.BranchId == b.Id) / b.Capacity.Value,
                IsOpen = b.Status == BranchStatus.Active
            })
            .OrderByDescending(b => b.Revenue)
            .ToListAsync();
        // The branch totals come from this list instead of two more count queries.
        var totalBranches = branches.Count;
        var activeBranches = branches.Count(b => b.IsOpen);

        var recentMembers = await clientUsers
            .OrderByDescending(u => u.CreatedAt)
            .Take(5)
            .Select(u => new RecentMemberResponse
            {
                Id = u.Id,
                Name = ((u.FirstName ?? "") + " " + (u.LastName ?? "")).Trim(),
                AvatarUrl = u.AvatarUrl,
                BranchName = u.Branch != null ? u.Branch.Name : null,
                JoinedAt = u.CreatedAt,
                Status = u.Status.ToString()
            })
            .ToListAsync();

        return new DashboardOverviewResponse
        {
            Stats = new DashboardStatsResponse
            {
                TotalRevenue = totalRevenue,
                RevenueGrowthPct = revenueGrowthPct,
                TotalMembers = totalMembers,
                MemberGrowthPct = memberGrowthPct,
                ActiveBranches = activeBranches,
                TotalBranches = totalBranches,
                NewSignupsToday = newSignupsToday,
                TrainersOnline = trainersOnline,
                TotalTrainers = totalTrainers,
                MembersPresent = membersPresent,
                MembersNeedingTrainer = membersNeedingTrainer,
                TotalTenants = totalTenants
            },
            RevenueTrend = revenueTrend,
            Branches = branches,
            RecentMembers = recentMembers
        };
    }

    private static double GrowthPct(double current, double previous)
    {
        if (previous <= 0) return current > 0 ? 100 : 0;
        return Math.Round((current - previous) / previous * 100, 1);
    }
}
