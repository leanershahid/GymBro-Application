import axiosInstance from '../../../api/axios';
import { ENDPOINTS } from '../../../api/endpoints';
import { ApiResponse } from '../../../api/types';

// ─── Raw shapes as returned by GET /dashboard/overview ───────────────
// (ASP.NET Core camelCases the backend's PascalCase C# properties.)

export interface DashboardStatsRaw {
  totalRevenue: number;
  revenueGrowthPct: number;
  totalMembers: number;
  memberGrowthPct: number;
  activeBranches: number;
  totalBranches: number;
  newSignupsToday: number;
  trainersOnline: number;
}

export interface RevenueTrendPointRaw {
  label: string;
  value: number;
}

export interface BranchSummaryRaw {
  id: number;
  name: string;
  city: string | null;
  memberCount: number;
  revenue: number;
  occupancyPct: number;
  isOpen: boolean;
}

export interface RecentMemberRaw {
  id: number;
  name: string;
  avatarUrl: string | null;
  branchName: string | null;
  joinedAt: string;
  status: string;
}

export interface DashboardOverviewRaw {
  stats: DashboardStatsRaw;
  revenueTrend: RevenueTrendPointRaw[];
  branches: BranchSummaryRaw[];
  recentMembers: RecentMemberRaw[];
}

export const fetchDashboardOverview = async (): Promise<ApiResponse<DashboardOverviewRaw>> => {
  const { data } = await axiosInstance.get<ApiResponse<DashboardOverviewRaw>>(
    ENDPOINTS.DASHBOARD_OVERVIEW,
  );
  return data;
};
