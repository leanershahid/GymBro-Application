namespace GymManagmentApplication.Application.Dashboard.Responses;

public class DashboardStatsResponse
{
    public decimal TotalRevenue { get; set; }
    public double RevenueGrowthPct { get; set; }
    public int TotalMembers { get; set; }
    public double MemberGrowthPct { get; set; }
    public int ActiveBranches { get; set; }
    public int TotalBranches { get; set; }
    public int NewSignupsToday { get; set; }
    public int TrainersOnline { get; set; }
}

public class RevenueTrendPointResponse
{
    public string Label { get; set; } = default!;
    public decimal Value { get; set; }
}

public class BranchSummaryResponse
{
    public ulong Id { get; set; }
    public string Name { get; set; } = default!;
    public string? City { get; set; }
    public int MemberCount { get; set; }
    public decimal Revenue { get; set; }
    public double OccupancyPct { get; set; }
    public bool IsOpen { get; set; }
}

public class RecentMemberResponse
{
    public ulong Id { get; set; }
    public string Name { get; set; } = default!;
    public string? AvatarUrl { get; set; }
    public string? BranchName { get; set; }
    public DateTime JoinedAt { get; set; }
    public string Status { get; set; } = default!;
}

public class DashboardOverviewResponse
{
    public DashboardStatsResponse Stats { get; set; } = default!;
    public List<RevenueTrendPointResponse> RevenueTrend { get; set; } = [];
    public List<BranchSummaryResponse> Branches { get; set; } = [];
    public List<RecentMemberResponse> RecentMembers { get; set; } = [];
}
