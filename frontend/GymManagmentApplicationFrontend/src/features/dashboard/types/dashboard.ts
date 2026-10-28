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
  totalTrainers: number;
  totalTenants: number;
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

/** Colour bucket for a member's status; the label shown is always the API's own status text. */
export type MemberStatus = 'active' | 'pending' | 'other';

export interface RecentMember {
  id: string;
  name: string;
  avatarUrl?: string;
  branchName: string;
  joinedAgo: string;
  status: MemberStatus;
  /** Raw status text from the API (e.g. "Active", "Suspended"). */
  statusLabel: string;
}

export interface DashboardData {
  stats: DashboardStats;
  revenueTrend: RevenueTrendPoint[];
  branches: BranchSummary[];
  recentMembers: RecentMember[];
}
