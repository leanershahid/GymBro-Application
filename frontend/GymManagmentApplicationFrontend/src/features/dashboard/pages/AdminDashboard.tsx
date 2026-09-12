import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, RefreshControl,
  ActivityIndicator, FlatList, Pressable, StatusBar, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { T } from '../../trainers/components/theme';

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
import { ADMIN_ACTIONS } from '../adminActions';

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

const DASHBOARD_STATS: StatStripItem[] = [
  { icon: 'map-pin',   label: 'Branches', value: '5',     accent: '#7ED321' },
  { icon: 'award',     label: 'Trainers', value: '18',    accent: '#7ED321' },
  { icon: 'briefcase', label: 'Tenants',  value: '3',     accent: '#7ED321' },
  { icon: 'users',     label: 'Members',  value: '1,284', accent: '#7ED321' },
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

interface AdminDashboardProps { adminName?: string; }

export default function AdminDashboard({ adminName = 'Admin' }: AdminDashboardProps) {
  const { data, loading, refreshing, error, refresh } = useDashboardStats();
  const [screen, setScreen] = useState<Screen>('home');
  const [activeTab, setActiveTab] = useState('home');

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
  if (screen === 'module-hub')  return <AdminModuleDevelopmentDashboard onBack={goHome} onNavigate={(k) => go(k as Screen)} />;
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
  if (screen === 'more-actions')       return <MoreActionsPage onBack={goHome} onNavigate={(k) => go(k as Screen)} />;

  // ── Loading / Error states ─────────────────────────────────────
  if (loading && !data) return (
    <View style={{ flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={T.brand} />
    </View>
  );

  if (error && !data) return (
    <View style={{ flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
      <Text style={{ color: T.text, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>Something went wrong</Text>
      <Text style={{ color: T.textSub, fontSize: 14, textAlign: 'center', marginBottom: 24 }}>{error}</Text>
      <Pressable onPress={refresh} style={{ backgroundColor: T.brand, borderRadius: 999, paddingHorizontal: 28, paddingVertical: 14 }}>
        <Text style={{ color: T.onBrand, fontSize: 16, fontWeight: '700' }}>Try again</Text>
      </Pressable>
    </View>
  );

  if (!data) return null;

  const { stats, revenueTrend, branches, recentMembers } = data;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0 }}>
      <StatusBar barStyle="light-content" backgroundColor={T.bg} />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={T.brand} colors={[T.brand]} />}
      >
        {/* Header */}
        <View style={{ paddingTop: 16, marginBottom: 20 }}>
          <DashboardBanner
            adminName={adminName}
            roleLabel="Administrator"
            hasUnreadNotifications
            onPressNotifications={() => {}}
            onPressAvatar={() => {}}
          />
        </View>

        {/* Monthly insight (replaces the old plain headline text) */}
        <View style={{ marginBottom: 20 }}>
          <MonthlyInsightCard
            growthPct={stats.revenueGrowthPct}
            activeBranches={stats.activeBranches}
            trend={revenueTrend}
          />
        </View>

        {/* Stats strip — borderless inline row, per the reference */}
        <View style={{ marginBottom: 24 }}>
          <StatsStrip items={DASHBOARD_STATS} bare />
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
            {ADMIN_ACTIONS.map(q => (
              <Pressable key={q.screen} onPress={() => go(q.screen as Screen)}
                style={({ pressed }) => ({
                  flexGrow: 1, flexBasis: '22%', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 14,
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
        <View style={{ marginBottom: 12 }}>
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

      {/* ── Bottom nav ── */}
      <View style={{
        position: 'absolute', bottom: Platform.OS === 'ios' ? 32 : 20,
        left: 24, right: 24,
        backgroundColor: 'rgba(10,30,15,0.92)',
        borderRadius: 36, borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)',
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 10, paddingHorizontal: 8,
        shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.55, shadowRadius: 24, elevation: 18,
      }}>
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.key;
          const isHub    = item.key === 'hub';
          return (
            <Pressable key={item.key} onPress={() => handleTab(item.key)} hitSlop={8}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
              accessibilityRole="button" accessibilityLabel={item.label}>
              {isHub ? (
                <LinearGradient
                  colors={T.brandGradient}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', shadowColor: T.brand, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 8 }}
                >
                  <Feather name="plus" size={22} color={T.onBrand} />
                </LinearGradient>
              ) : (
                <View style={{ alignItems: 'center', justifyContent: 'center', height: 44 }}>
                  <View style={{ width: 44, height: 36, borderRadius: 18, backgroundColor: isActive ? T.brandDim : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name={item.icon} size={21} color={isActive ? T.brand : T.textSub} />
                  </View>
                  {/* Active indicator dot */}
                  {isActive && <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: T.brand, marginTop: 2 }} />}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
