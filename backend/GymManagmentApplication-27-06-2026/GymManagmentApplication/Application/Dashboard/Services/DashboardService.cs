using GymManagmentApplication.Application.Dashboard.Interfaces;
using GymManagmentApplication.Application.Dashboard.Responses;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Dashboard.Services;

public class DashboardService(AppDbContext db) : IDashboardService
{
    private const string ClientRoleSlug = "client";

    public async Task<DashboardOverviewResponse> GetOverviewAsync()
    {
        var now = DateTime.UtcNow;
        var startOfThisMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var startOfLastMonth = startOfThisMonth.AddMonths(-1);
        var startOfToday = now.Date;

        var clientUsers = db.Users.Where(u => u.DeletedAt == null && u.Role != null && u.Role.Slug == ClientRoleSlug);

        var totalMembers = await clientUsers.CountAsync();
        var newSignupsToday = await clientUsers.CountAsync(u => u.CreatedAt >= startOfToday);
        var membersThisMonth = await clientUsers.CountAsync(u => u.CreatedAt >= startOfThisMonth);
        var membersLastMonth = await clientUsers.CountAsync(u => u.CreatedAt >= startOfLastMonth && u.CreatedAt < startOfThisMonth);
        var memberGrowthPct = GrowthPct(membersThisMonth, membersLastMonth);

        var completedPayments = db.Payments.Where(p => p.Status == PaymentStatus.Completed);
        var totalRevenue = await completedPayments.SumAsync(p => (decimal?)p.Amount) ?? 0m;
        var revenueThisMonth = await completedPayments.Where(p => p.CreatedAt >= startOfThisMonth).SumAsync(p => (decimal?)p.Amount) ?? 0m;
        var revenueLastMonth = await completedPayments.Where(p => p.CreatedAt >= startOfLastMonth && p.CreatedAt < startOfThisMonth).SumAsync(p => (decimal?)p.Amount) ?? 0m;
        var revenueGrowthPct = GrowthPct((double)revenueThisMonth, (double)revenueLastMonth);

        var totalBranches = await db.Branches.CountAsync();
        var activeBranches = await db.Branches.CountAsync(b => b.Status == BranchStatus.Active);

        var trainersOnline = await db.TrainerProfiles.CountAsync(t => t.IsAvailable);

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
                TrainersOnline = trainersOnline
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
