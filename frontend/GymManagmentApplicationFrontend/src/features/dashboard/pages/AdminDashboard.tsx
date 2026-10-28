import React, { useCallback, useState } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import ScreenRoot             from '../../common/components/Screen';
import LoadingState           from '../../common/components/LoadingState';
import BottomTabBar           from '../../common/components/BottomTabBar';
import ActionList, { ActionItem } from '../../common/components/dashboard/ActionList';
import KpiTile                from '../../common/components/dashboard/KpiTile';
import BarList                from '../../common/components/dashboard/BarList';

import DashboardHeader        from '../components/Dashboardheader';
import AdminRevenueHero       from '../components/AdminRevenueHero';
import RevenueTrendCard       from '../components/RevenueTrendCard';
import QuickAccessGrid        from '../components/QuickAccessGrid';
import SectionHeader          from '../components/Sectionheader';
import RecentMemberRow        from '../components/RecentMemberRow';
import EmptyState             from '../components/EmptyState';
import { formatInrCompact, formatPct } from '../components/formatInr';
import { useDashboardStats }  from '../hooks/useDashboardStats';
import { DashboardData }      from '../types/dashboard';
import AdminModuleDevelopmentDashboard from './AdminModuleDevelopmentDashboard';
import MoreActionsPage        from './MoreActionsPage';
import { useVisibleAdminActions } from '../adminActions';
import { getSession, isAdminRole, isSuperAdmin } from '../../../api/session';

// ─── Feature pages ────────────────────────────────────────────────
import ViewMembersPage   from '../../members/pages/ViewMembersPage';
import AddMemberPage     from '../../members/pages/AddMemberPage';
import ViewLeadsPage     from '../../leads/pages/ViewLeadsPage';
import ViewExercisesPage from '../../exercises/pages/ViewExercisesPage';
import ViewWorkoutsPage  from '../../workouts/pages/ViewWorkoutsPage';
import ViewPlansPage     from '../../workouts/pages/ViewPlansPage';
import ViewBranchesPage  from '../../branches/pages/ViewBranchesPage';
import AddBranchPage     from '../../branches/pages/AddBranchPage';
import ViewTenantsPage   from '../../tenants/pages/ViewTenantsPage';
import AddTenantPage     from '../../tenants/pages/AddTenantPage';
import ViewTrainersPage  from '../../trainers/pages/ViewTrainersPage';
import AddTrainerPage    from '../../trainers/pages/AddTrainerPage';
import ModuleAccessPage  from '../../module-access/pages/ModuleAccessPage';
import UserAccessListPage from '../../module-access/pages/UserAccessListPage';
import ChallengesAdminPage    from '../../challenges/pages/ChallengesAdminPage';
import StatsAdminPage         from '../../health/pages/StatsAdminPage';
import LiveCoachingAdminPage  from '../../trainers/pages/LiveCoachingAdminPage';
import AiCoachSettingsPage    from '../../ai-coach/pages/AiCoachSettingsPage';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];
type Screen =
  | 'home' | 'module-hub'
  | 'members' | 'add-member'
  | 'trainers' | 'add-trainer'
  | 'branches' | 'add-branch'
  | 'tenants'  | 'add-tenant'
  | 'leads'
  | 'exercises'
  | 'workouts'
  | 'plans'
  | 'module-access'
  | 'user-access'
  | 'challenges-admin'
  | 'stats-admin'
  | 'live-coaching-admin'
  | 'ai-coach-admin'
  | 'more-actions';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Today" — things that need the admin's attention, built only from live dashboard data. */
function buildTodayItems({ stats, branches, recentMembers }: DashboardData, go: (s: Screen) => void): ActionItem[] {
  const items: ActionItem[] = [];

  if (stats.newSignupsToday > 0) items.push({
    key: 'signups', icon: 'user-plus', tone: 'brand', badge: 'Today',
    title: plural(stats.newSignupsToday, 'new sign-up', 'new sign-ups'),
    subtitle: 'Assign a trainer',
    onPress: () => go('members'),
  });

  const pending = recentMembers.filter(m => m.status === 'pending');
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

  return items;
}

const SECTION = SP.xxl; // 28px between home sections

// Labels match the reference (Dashboard/Members/+/Activity/More); destinations are
// unchanged from before — "Activity" still opens Workouts, "More" replaces the old
// direct "Leads" shortcut with the full action list (Leads included) since the
// reference has no per-feature nav slot beyond these five.
const NAV_ITEMS: { icon: FeatherIconName; label: string; key: string }[] = [
  { icon: 'home',       label: 'Dashboard', key: 'home'    },
  { icon: 'users',      label: 'Members',   key: 'members' },
  { icon: 'plus-circle',label: 'Hub',       key: 'hub'     },
  { icon: 'activity',   label: 'Activity',  key: 'workouts'},
  { icon: 'grid',       label: 'More',      key: 'more'    },
];

interface AdminDashboardProps { adminName?: string; onLogout?: () => void; }

export default function AdminDashboard({ adminName = 'Admin', onLogout }: AdminDashboardProps) {
  const { data, loading, refreshing, error, refresh } = useDashboardStats();
  const actions = useVisibleAdminActions();
  const role = getSession()?.role;
  const superAdmin = isSuperAdmin(role);
  const roleLabel = superAdmin ? 'Super Admin' : isAdminRole(role) ? 'Administrator' : 'Staff';
  const [screen, setScreen] = useState<Screen>('home');
  const activeTab = tabForScreen(screen);
  const { tileW } = useLayout();
  const kpiW = tileW(2, 12);

  const go = useCallback((s: Screen) => setScreen(s), []);
  const goHome = useCallback(() => setScreen('home'), []);

  const handleTab = useCallback((key: string) => {
    if (key === 'hub')      go('module-hub');
    else if (key === 'members')  go('members');
    else if (key === 'workouts') go('workouts');
    else if (key === 'more')     go('more-actions');
    else                         go('home');
  }, []);

  // ── Sub-page routing — rendered above the persistent bottom nav ──
  const subPage = (() => {
    if (screen === 'module-hub')  return <AdminModuleDevelopmentDashboard onBack={goHome} onNavigate={(k) => go(k as Screen)} stats={data?.stats} />;
    if (screen === 'members')     return <ViewMembersPage   onBack={goHome} onAddMember={() => go('add-member')} />;
    if (screen === 'add-member')  return <AddMemberPage     onBack={() => go('members')} />;
    if (screen === 'trainers')    return <ViewTrainersPage  onBack={goHome} onAddTrainer={() => go('add-trainer')} />;
    if (screen === 'add-trainer') return <AddTrainerPage    onBack={() => go('trainers')} />;
    if (screen === 'branches')    return <ViewBranchesPage  onBack={goHome} onAddBranch={() => go('add-branch')} />;
    if (screen === 'add-branch')  return <AddBranchPage     onBack={() => go('branches')} />;
    if (screen === 'tenants')     return <ViewTenantsPage   onBack={goHome} onAddTenant={() => go('add-tenant')} />;
    if (screen === 'add-tenant')  return <AddTenantPage     onBack={() => go('tenants')} />;
    if (screen === 'leads')       return <ViewLeadsPage     onBack={goHome} />;
    if (screen === 'exercises')   return <ViewExercisesPage onBack={goHome} />;
    if (screen === 'workouts')    return <ViewWorkoutsPage  onBack={goHome} />;
    if (screen === 'plans')       return <ViewPlansPage     onBack={goHome} />;
    if (screen === 'module-access') return <ModuleAccessPage  onBack={goHome} />;
    if (screen === 'user-access')   return <UserAccessListPage onBack={goHome} />;
    if (screen === 'challenges-admin')   return <ChallengesAdminPage   onBack={goHome} />;
    if (screen === 'stats-admin')        return <StatsAdminPage        onBack={goHome} />;
    if (screen === 'live-coaching-admin') return <LiveCoachingAdminPage onBack={goHome} />;
    if (screen === 'ai-coach-admin')     return <AiCoachSettingsPage   onBack={goHome} />;
    if (screen === 'more-actions')       return <MoreActionsPage onBack={goHome} onNavigate={(k) => go(k as Screen)} onLogout={onLogout} />;
    return null;
  })();

  // ── Loading / Error states ─────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <View style={{ flex: 1 }}>
        {subPage ?? renderHome()}
      </View>
      {/* Bottom nav stays fixed on every admin screen */}
      <BottomTabBar tabs={NAV_ITEMS} active={activeTab} onChange={handleTab} />
    </View>
  );

  function renderHome() {
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
  const todayItems = buildTodayItems(data, go);

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
            adminName={adminName}
            roleLabel={roleLabel}
            onPressAvatar={() => {}}
          />
        </View>

        {/* 2. Today — action-first: what needs doing before any statistics */}
        {todayItems.length > 0 && (
          <View style={{ marginBottom: SECTION }}>
            <SectionHeader title="Today" />
            <ActionList items={todayItems} />
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
            hint="vs last month"
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

        {/* 7. Quick access — lighter, below the data */}
        {actions.length > 0 && (
          <View style={{ marginBottom: SECTION }}>
            <SectionHeader title="Quick access" />
            <QuickAccessGrid actions={actions} onPress={(s) => go(s as Screen)} />
          </View>
        )}

        {/* 8. Recent sign-ups */}
        <View style={{ marginBottom: 24 }}>
          <SectionHeader title="Recent sign-ups" onPressAction={() => go('members')} />
          {recentMembers.length === 0 ? (
            <EmptyState icon="user-plus" title="No sign-ups yet" subtitle="New members will show up here as they join." />
          ) : (
            recentMembers.map((member) => (
              <RecentMemberRow key={member.id} member={member} onPress={() => go('members')} />
            ))
          )}
        </View>
      </ScrollView>
    </ScreenRoot>
  );
  }
}

/** Which bottom tab is highlighted for each screen. */
function tabForScreen(screen: Screen): string {
  if (screen === 'home') return 'home';
  if (screen === 'members' || screen === 'add-member') return 'members';
  if (screen === 'workouts') return 'workouts';
  if (screen === 'module-hub') return 'hub';
  return 'more';
}
