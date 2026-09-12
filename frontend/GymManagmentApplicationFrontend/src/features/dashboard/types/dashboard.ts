export interface RevenueTrendPoint {
  label: string;
  value: number;
}

export interface DashboardStats {
  totalRevenue: number;
  revenueGrowthPct: number;
  totalMembers: number;
  memberGrowthPct: number;
  activeBranches: number;
  totalBranches: number;
  newSignupsToday: number;
  trainersOnline: number;
}

export interface BranchSummary {
  id: string;
  name: string;
  city: string;
  memberCount: number;
  revenue: number;
  occupancyPct: number;
  isOpen: boolean;
}

export type MemberStatus = 'active' | 'pending' | 'overdue';

export interface RecentMember {
  id: string;
  name: string;
  avatarUrl?: string;
  branchName: string;
  joinedAgo: string;
  status: MemberStatus;
}

export interface DashboardData {
  stats: DashboardStats;
  revenueTrend: RevenueTrendPoint[];
  branches: BranchSummary[];
  recentMembers: RecentMember[];
}
