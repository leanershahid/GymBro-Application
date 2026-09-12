import { DashboardData, MemberStatus, RecentMember } from '../types/dashboard';
import { DashboardOverviewRaw, RecentMemberRaw } from './dashboardApi';

// Backend `status` is the raw UserStatus enum text (e.g. "Active" / "Pending" / "Inactive" / "Suspended"),
// but the dashboard UI only distinguishes 'active' | 'pending' | 'overdue'. Judgment-call mapping:
// "Active" -> active, "Pending" -> pending, everything else (Inactive/Suspended/unrecognized) -> overdue.
function mapMemberStatus(status: string): MemberStatus {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'active') return 'active';
  if (normalized === 'pending') return 'pending';
  return 'overdue';
}

// Renders a raw ISO datetime as a short relative string ("2h ago") to match the existing
// `joinedAgo` display field consumed by dashboard components.
function formatJoinedAgo(isoDate: string): string {
  const joinedMs = new Date(isoDate).getTime();
  if (Number.isNaN(joinedMs)) return '';

  const diffMs = Math.max(0, Date.now() - joinedMs);
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function mapRecentMember(raw: RecentMemberRaw): RecentMember {
  return {
    id: String(raw.id),
    name: raw.name,
    avatarUrl: raw.avatarUrl ?? undefined,
    branchName: raw.branchName ?? '',
    joinedAgo: formatJoinedAgo(raw.joinedAt),
    status: mapMemberStatus(raw.status),
  };
}

// Transforms the raw /dashboard/overview API payload into the DashboardData shape already
// consumed by src/features/dashboard/components and pages, so no downstream UI code changes.
export function mapDashboardOverview(raw: DashboardOverviewRaw): DashboardData {
  return {
    stats: raw.stats,
    revenueTrend: raw.revenueTrend,
    branches: raw.branches.map((b) => ({
      id: String(b.id),
      name: b.name,
      city: b.city ?? '',
      memberCount: b.memberCount,
      revenue: b.revenue,
      occupancyPct: b.occupancyPct,
      isOpen: b.isOpen,
    })),
    recentMembers: raw.recentMembers.map(mapRecentMember),
  };
}
