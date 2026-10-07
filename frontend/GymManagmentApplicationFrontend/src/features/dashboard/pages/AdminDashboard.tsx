import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, RefreshControl,
  FlatList, Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import ScreenRoot             from '../../common/components/Screen';
import LoadingState           from '../../common/components/LoadingState';
import BottomTabBar           from '../../common/components/BottomTabBar';

import DashboardBanner        from '../components/DashboardBanner';
import MonthlyInsightCard     from '../components/MonthlyInsightCard';
import RevenueOverviewCard    from '../components/Revenueoverviewcard';
import StatTile               from '../components/Stattile';
import SectionHeader          from '../components/Sectionheader';
import BranchCard             from '../components/Branchcard';
import RecentMemberRow        from '../components/RecentMemberRow';
import EmptyState             from '../components/EmptyState';
import { useDashboardStats }  from '../hooks/useDashboardStats';
import AdminModuleDevelopmentDashboard from './AdminModuleDevelopmentDashboard';
import MoreActionsPage        from './MoreActionsPage';
import StatsStrip, { StatStripItem }   from '../../common/StatsStrip';
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

const dashboardStats = (s: { totalBranches: number; totalTrainers: number; totalTenants: number; totalMembers: number }): StatStripItem[] => [
  { icon: 'map-pin',   label: 'Branches', value: s.totalBranches.toLocaleString('en-IN'), accent: T.brand },
  { icon: 'award',     label: 'Trainers', value: s.totalTrainers.toLocaleString('en-IN'), accent: T.brand },
  { icon: 'briefcase', label: 'Tenants',  value: s.totalTenants.toLocaleString('en-IN'),  accent: T.brand },
  { icon: 'users',     label: 'Members',  value: s.totalMembers.toLocaleString('en-IN'),  accent: T.brand },
];

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
  const roleLabel = isSuperAdmin(role) ? 'Super Admin' : isAdminRole(role) ? 'Administrator' : 'Staff';
  const [screen, setScreen] = useState<Screen>('home');
  const [activeTab, setActiveTab] = useState('home');
  const { tileW, tileCols } = useLayout();
  const quickTileW = tileW(tileCols, 10);

  const go = useCallback((s: Screen) => setScreen(s), []);
  const goHome = useCallback(() => { setScreen('home'); setActiveTab('home'); }, []);

  const handleTab = useCallback((key: string) => {
    setActiveTab(key);
    if (key === 'hub')      go('module-hub');
    else if (key === 'members')  go('members');
    else if (key === 'workouts') go('workouts');
    else if (key === 'more')     go('more-actions');
    else                         go('home');
  }, []);

  // ── Sub-page routing ──────────────────────────────────────────
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

  // ── Loading / Error states ─────────────────────────────────────
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

  return (
    <ScreenRoot>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={T.brand} colors={[T.brand]} />}
      >
        {/* Header */}
        <View style={{ paddingTop: 16, marginBottom: 24 }}>
          <DashboardBanner
            adminName={adminName}
            roleLabel={roleLabel}
            hasUnreadNotifications
            onPressNotifications={() => {}}
            onPressAvatar={() => {}}
          />
        </View>

        {/* Monthly insight (replaces the old plain headline text) */}
        <View style={{ marginBottom: 24 }}>
          <MonthlyInsightCard
            growthPct={stats.revenueGrowthPct}
            activeBranches={stats.activeBranches}
            trend={revenueTrend}
          />
        </View>

        {/* Stats strip — borderless inline row, per the reference */}
        <View style={{ marginBottom: 24 }}>
          <StatsStrip items={dashboardStats(stats)} bare />
        </View>

        {/* Revenue */}
        <View style={{ marginBottom: 24 }}>
          <RevenueOverviewCard totalRevenue={stats.totalRevenue} growthPct={stats.revenueGrowthPct} trend={revenueTrend} />
        </View>

        {/* Stat tiles — no direct slot in the reference crop; placed here as a
            secondary "today at a glance" row since this live data isn't shown
            anywhere else on the screen. */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
          <StatTile icon="users"     label="Total members"     value={stats.totalMembers.toLocaleString('en-IN')} deltaLabel={`+${stats.memberGrowthPct}%`} />
          <StatTile icon="home"      label="Active branches"   value={`${stats.activeBranches}/${stats.totalBranches}`} />
          <StatTile icon="user-plus" label="New sign-ups today" value={`${stats.newSignupsToday}`} />
          <StatTile icon="activity"  label="Trainers online"   value={`${stats.trainersOnline}`} />
        </View>

        {/* Quick access — every action shown directly, no expand/collapse needed. */}
        <View style={{ marginBottom: 28 }}>
          <SectionHeader title="Quick access" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {actions.map(q => (
              <Pressable key={q.screen} onPress={() => go(q.screen as Screen)}
                accessibilityRole="button" accessibilityLabel={q.label}
                style={({ pressed }) => ({
                  width: quickTileW, alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 14,
                  backgroundColor: pressed ? T.brandDim : T.bgInput,
                  borderRadius: 18, borderWidth: 1,
                  borderColor: pressed ? T.brandBorder : T.line,
                })}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: T.brandDim, borderWidth: 1, borderColor: T.brandBorder, alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name={q.icon} size={18} color={T.brand} />
                </View>
                <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600' }} numberOfLines={1}>{q.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Branch performance */}
        <View style={{ marginBottom: 28 }}>
          <SectionHeader title="Branch performance" onPressAction={() => go('branches')} />
          {branches.length === 0 ? (
            <EmptyState icon="map-pin" title="No branches yet" subtitle="Add your first branch to see performance here." />
          ) : (
            <FlatList
              data={branches} keyExtractor={(item) => item.id} horizontal
              showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 4 }}
              renderItem={({ item }) => <BranchCard branch={item} onPress={() => go('branches')} />}
            />
          )}
        </View>

        {/* Recent sign-ups */}
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

      {/* ── Bottom nav — shared tab bar (same style as the member/trainer apps) ── */}
      <BottomTabBar tabs={NAV_ITEMS} active={activeTab} onChange={handleTab} />
    </ScreenRoot>
  );
}
