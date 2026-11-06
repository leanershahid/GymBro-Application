import React from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { T, SP, R } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import ScreenRoot from '../../common/components/Screen';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../common/components/EmptyState';
import ActionList, { ActionItem } from '../../common/components/dashboard/ActionList';
import KpiTile from '../../common/components/dashboard/KpiTile';
import BarList from '../../common/components/dashboard/BarList';
import DashboardHeader from '../components/Dashboardheader';
import AdminRevenueHero from '../components/AdminRevenueHero';
import RevenueTrendCard from '../components/RevenueTrendCard';
import QuickAccessGrid from '../components/QuickAccessGrid';
import SectionHeader from '../components/Sectionheader';
import RecentMemberRow from '../components/RecentMemberRow';
import { formatInrCompact, formatPct } from '../components/formatInr';
import { DashboardData } from '../types/dashboard';
import { AdminAction } from '../adminActions';
import { AdminScreen, isAdminScreen } from './adminRoutes';
import { useMembershipRequestBadge } from '../../self-service/routes';
import { useSupportBadge } from '../../support/routes';

const SECTION = SP.xxl; // 28px between home sections

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Today" — things that need the admin's attention, built only from live dashboard data. */
function buildTodayItems({ stats, branches, recentMembers }: DashboardData, go: (s: AdminScreen) => void, pendingRequests = 0): ActionItem[] {
  const items: ActionItem[] = [];

  if (pendingRequests > 0) items.push({
    key: 'membership-requests', icon: 'inbox', tone: 'warn', badge: `${pendingRequests}`,
    title: plural(pendingRequests, 'membership request', 'membership requests'),
    subtitle: 'Pauses, cancellations and plan changes to review',
    onPress: () => go('membership-requests'),
  });

  if (stats.newSignupsToday > 0) items.push({
    key: 'signups', icon: 'user-plus', tone: 'brand', badge: 'Today',
    title: plural(stats.newSignupsToday, 'new sign-up', 'new sign-ups'),
    subtitle: 'Assign a trainer',
    onPress: () => go('members'),
  });

  const pending = recentMembers.filter(m => m.status?.toLowerCase() === 'pending');
  if (pending.length > 0) items.push({
    key: 'pending', icon: 'clock', tone: 'warn', badge: `${pending.length}`,
    title: `${plural(pending.length, 'member', 'members')} pending`,
    subtitle: pending.map(m => m.name).join(', '),
    onPress: () => go('members'),
  });

  const closed = branches.filter(b => !b.isOpen);
  if (closed.length > 0) items.push({
    key: 'closed', icon: 'alert-triangle', tone: 'err', badge: `${closed.length}`,
    title: `${plural(closed.length, 'branch', 'branches')} closed`,
    subtitle: closed.map(b => b.name).join(', '),
    onPress: () => go('branches'),
  });

  if (stats.totalTrainers > 0) items.push({
    key: 'trainers', icon: 'activity', tone: stats.trainersOnline === 0 ? 'warn' : 'info',
    badge: `${stats.trainersOnline} of ${stats.totalTrainers}`,
    title: 'Trainers online',
    subtitle: stats.trainersOnline === 0 ? 'None on the floor now' : 'On the floor now',
    onPress: () => go('trainers'),
  });

  if (stats.membersNeedingTrainer > 0) items.push({
    key: 'needs-trainer', icon: 'user-x', tone: 'err', badge: `${stats.membersNeedingTrainer}`,
    title: plural(stats.membersNeedingTrainer, 'member needs', 'members need') + ' a new trainer',
    subtitle: 'Their trainer was removed or deactivated',
    onPress: () => go('members'),
  });

  if (stats.totalMembers > 0) items.push({
    key: 'members-present', icon: 'users', tone: stats.membersPresent === 0 ? 'warn' : 'info',
    badge: `${stats.membersPresent} of ${stats.totalMembers}`,
    title: 'Members checked in',
    subtitle: stats.membersPresent === 0 ? 'No one on the floor now' : 'On the floor now',
    onPress: () => go('attendance-log'),
  });

  return items;
}

interface Props {
  data: DashboardData | null | undefined;
  loading: boolean;
  refreshing: boolean;
  error: string | null | undefined;
  refresh: () => void;
  displayName: string;
  avatarUrl?: string;
  roleLabel: string;
  superAdmin: boolean;
  /** Module shortcuts the user is granted. */
  actions: AdminAction[];
  onPressAvatar: () => void;
  onSearch?: () => void;
  onQuickCreate?: () => void;
  go: (s: AdminScreen) => void;
  open: (s: AdminScreen, id: number) => void;
}

/** The admin home: header, Today, shortcuts, revenue, KPIs, branch performance, recent sign-ups. */
export default function AdminHome({
  data, loading, refreshing, error, refresh, displayName, avatarUrl, roleLabel, superAdmin, actions,
  onPressAvatar, onSearch, onQuickCreate, go, open,
}: Props) {
  const { tileW } = useLayout();
  const pendingRequests = useMembershipRequestBadge();
  const supportBadge = useSupportBadge();
  const kpiW = tileW(2, 12);

  if (loading && !data) return <LoadingState fullScreen label="Loading dashboard" />;

  if (error && !data) return (
    <ScreenRoot style={{ justifyContent: 'center' }}>
      <EmptyState
        icon="alert-triangle"
        tone="error"
        title="Something went wrong"
        subtitle={error}
        action={{ label: 'Try again', onPress: refresh }}
      />
    </ScreenRoot>
  );

  if (!data) return null;

  const { stats, revenueTrend, branches, recentMembers } = data;
  const todayItems = buildTodayItems(data, go, pendingRequests);
  if (supportBadge > 0) todayItems.unshift({
    key: 'support', icon: 'life-buoy', tone: 'warn', badge: `${supportBadge}`,
    title: plural(supportBadge, 'help request needs you', 'help requests need you'),
    subtitle: 'Unassigned or past the response target',
    onPress: () => go('support'),
  });

  const closedCount = branches.filter(b => !b.isOpen).length;
  const openBranches = branches.filter(b => b.isOpen);
  const avgOccupancy = openBranches.length
    ? Math.round(openBranches.reduce((sum, b) => sum + b.occupancyPct, 0) / openBranches.length)
    : 0;

  const branchRows = [...branches]
    .sort((a, b) => b.revenue - a.revenue)
    .map(b => ({
      key: b.id,
      label: b.name,
      value: b.revenue,
      display: formatInrCompact(b.revenue),
      hint: [b.city, `${b.memberCount.toLocaleString('en-IN')} members`, b.isOpen ? `${b.occupancyPct}% full` : 'Closed']
        .filter(Boolean).join(' · '),
    }));

  return (
    <ScreenRoot>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={T.brand} colors={[T.brand]} />}
      >
        {/* 1. Header — greeting, name, role */}
        <View style={{ paddingTop: SP.lg, marginBottom: 24 }}>
          <DashboardHeader
            adminName={displayName}
            avatarUrl={avatarUrl}
            roleLabel={roleLabel}
            onPressAvatar={onPressAvatar}
            onSearch={onSearch}
            onQuickCreate={onQuickCreate}
          />
        </View>

        {/* 2. Today — action-first: what needs doing before any statistics */}
        {todayItems.length > 0 && (
          <View style={{ marginBottom: SECTION }}>
            <SectionHeader title="Today" />
            <ActionList items={todayItems} />
          </View>
        )}

        {/* Shortcuts — the first eight modules; "All" lists every one. */}
        {actions.length > 0 && (
          <View style={{ marginBottom: SECTION }}>
            <SectionHeader title="Shortcuts" actionLabel={actions.length > 8 ? 'All' : undefined}
              onPressAction={actions.length > 8 ? () => go('more-actions') : undefined} />
            <QuickAccessGrid actions={actions.slice(0, 8)} onPress={(s) => { if (isAdminScreen(s)) go(s); }} />
          </View>
        )}

        {/* 3. Hero — the one key number: revenue this month */}
        <View style={{ marginBottom: SECTION }}>
          <AdminRevenueHero
            totalRevenue={stats.totalRevenue}
            growthPct={stats.revenueGrowthPct}
            activeBranches={stats.activeBranches}
            trend={revenueTrend}
          />
        </View>

        {/* 4. KPI grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: SECTION }}>
          <KpiTile
            width={kpiW} icon="users" label="Members"
            value={stats.totalMembers.toLocaleString('en-IN')}
            delta={{ label: formatPct(stats.memberGrowthPct), positive: stats.memberGrowthPct >= 0 }}
            hint={`${stats.membersPresent} checked in now`}
            onPress={() => go('members')}
          />
          <KpiTile
            width={kpiW} icon="map-pin" label="Active branches"
            value={`${stats.activeBranches}/${stats.totalBranches}`}
            hint={closedCount > 0 ? `${closedCount} closed` : 'All open'}
            accent={closedCount > 0 ? T.brandGold : T.brand}
            onPress={() => go('branches')}
          />
          <KpiTile
            width={kpiW} icon="award" label="Trainers"
            value={stats.totalTrainers.toLocaleString('en-IN')}
            hint={`${stats.trainersOnline} online`}
            accent={T.sky}
            onPress={() => go('trainers')}
          />
          {superAdmin ? (
            <KpiTile
              width={kpiW} icon="briefcase" label="Gyms"
              value={stats.totalTenants.toLocaleString('en-IN')}
              hint="On the platform"
              accent={T.violet}
              onPress={() => go('tenants')}
            />
          ) : (
            <KpiTile
              width={kpiW} icon="pie-chart" label="Avg occupancy"
              value={openBranches.length ? `${avgOccupancy}%` : '—'}
              hint={`Across ${openBranches.length} open ${openBranches.length === 1 ? 'branch' : 'branches'}`}
              accent={T.violet}
              onPress={() => go('branches')}
            />
          )}
        </View>

        {/* 5. Revenue trend — history, average and best month (the hero has the total) */}
        {revenueTrend.length > 1 && (
          <View style={{ marginBottom: SECTION }}>
            <SectionHeader title="Revenue trend" />
            <RevenueTrendCard trend={revenueTrend} />
          </View>
        )}

        {/* 6. Branch performance — ranked by revenue */}
        <View style={{ marginBottom: SECTION }}>
          <SectionHeader title="Branch performance" onPressAction={() => go('branches')} />
          {branches.length === 0 ? (
            <EmptyState icon="map-pin" title="No branches yet" subtitle="Add your first branch to see performance here." />
          ) : (
            <View style={{ borderRadius: R.lg, padding: SP.lg, backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.line }}>
              <BarList rows={branchRows} />
            </View>
          )}
        </View>

        {/* 7. Recent sign-ups */}
        <View style={{ marginBottom: 24 }}>
          <SectionHeader title="Recent sign-ups" onPressAction={() => go('members')} />
          {recentMembers.length === 0 ? (
            <EmptyState icon="user-plus" title="No sign-ups yet" subtitle="New members will show up here as they join." />
          ) : (
            recentMembers.map((member) => (
              <RecentMemberRow key={member.id} member={member} onPress={() => Number(member.id) > 0 ? open('member-detail', Number(member.id)) : go('members')} />
            ))
          )}
        </View>
      </ScrollView>
    </ScreenRoot>
  );
}
