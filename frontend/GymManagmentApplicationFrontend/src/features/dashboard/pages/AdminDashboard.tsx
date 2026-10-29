import React, { useCallback, useState } from 'react';
import { View, ScrollView, RefreshControl, Alert } from 'react-native';
import ChangePasswordSheet from '../../auth/components/ChangePasswordSheet';
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
import ProfileSheet           from '../components/ProfileSheet';
import AdminProfileDetailsPage from './AdminProfileDetailsPage';
import { useMe }              from '../../auth/api/authQueries';
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
import { getSession, isSuperAdmin, isAdminRole } from '../../../api/session';
import { useRoleModuleAccess } from '../../module-access/hooks/useRoleModuleAccess';

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
import AttendanceSettingsPage from '../../attendance/pages/AttendanceSettingsPage';
import AttendanceLogPage      from '../../attendance/pages/AttendanceLogPage';
import MemberDetailPage  from '../../members/pages/MemberDetailPage';
import EditMemberPage    from '../../members/pages/EditMemberPage';
import EditBranchPage    from '../../branches/pages/EditBranchPage';
import EditTenantPage    from '../../tenants/pages/EditTenantPage';
import AddExercisePage   from '../../exercises/pages/AddExercisePage';
import AddWorkoutPage    from '../../workouts/pages/AddWorkoutPage';
import AddPlanPage       from '../../workouts/pages/AddPlanPage';
import AddLeadPage       from '../../leads/pages/AddLeadPage';
import RolesPage         from '../../module-access/pages/RolesPage';
import BillingHomePage   from '../../billing/pages/BillingHomePage';
import NewInvoicePage    from '../../billing/pages/NewInvoicePage';
import NewMembershipPage from '../../billing/pages/NewMembershipPage';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];
type Screen =
  | 'home' | 'module-hub'
  | 'members' | 'add-member' | 'member-detail' | 'edit-member'
  | 'trainers' | 'add-trainer'
  | 'branches' | 'add-branch' | 'edit-branch'
  | 'tenants'  | 'add-tenant' | 'edit-tenant'
  | 'leads'    | 'add-lead'
  | 'exercises' | 'add-exercise'
  | 'workouts'  | 'add-workout'
  | 'plans'     | 'add-plan'
  | 'roles'
  | 'billing' | 'new-invoice' | 'new-membership'
  | 'module-access'
  | 'user-access'
  | 'challenges-admin'
  | 'stats-admin'
  | 'live-coaching-admin'
  | 'ai-coach-admin'
  | 'attendance'
  | 'attendance-log'
  | 'more-actions'
  | 'profile-details';

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

/** Shown instead of a page when the signed-in user's own module access doesn't grant it. */
function NoModuleAccess({ onBack }: { onBack: () => void }) {
  return (
    <ScreenRoot style={{ justifyContent: 'center' }}>
      <EmptyState
        icon="lock"
        tone="error"
        title="No access"
        subtitle="Your account doesn't have access to this module. Ask an admin to grant it."
        action={{ label: 'Go back', onPress: onBack }}
      />
    </ScreenRoot>
  );
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
  const { data: me, isLoading: meLoading, isError: meError } = useMe();
  const displayName = me ? `${me.firstName} ${me.lastName}`.trim() || adminName : adminName;
  const [profileOpen, setProfileOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const confirmLogout = onLogout && (() => Alert.alert('Log out', 'Are you sure you want to log out?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Log out', style: 'destructive', onPress: onLogout },
  ]));
  const [screen, setScreen] = useState<Screen>('home');
  // Record the current detail/edit screen is about (member, branch, tenant, role).
  const [selectedId, setSelectedId] = useState<number>(0);
  const activeTab = tabForScreen(screen);
  const { tileW } = useLayout();
  const kpiW = tileW(2, 12);

  // Every module's view/create flags come from the per-role Module Access matrix — the same
  // "Role Access" screen the admin uses to configure custom roles — so it works dynamically
  // for every role, including the signed-in admin's own.
  const members  = useRoleModuleAccess('members');
  const trainers = useRoleModuleAccess('trainers');
  const branches = useRoleModuleAccess('branches');
  const tenants  = useRoleModuleAccess('tenants');
  const attendance = useRoleModuleAccess('attendance');
  const leads    = useRoleModuleAccess('leads');
  const exercises = useRoleModuleAccess('exercises');
  const workouts  = useRoleModuleAccess('workouts');
  const plans     = useRoleModuleAccess('plans');
  const roles     = useRoleModuleAccess('roles');
  const billingAccess = useRoleModuleAccess('billing');
  const canViewMembers  = members.canView;
  const canViewTrainers = trainers.canView;
  const canViewBranches = branches.canView;
  const canAddMember    = members.canCreate;
  const canAddTrainer   = trainers.canCreate;
  const canAddBranch    = branches.canCreate;
  const canViewTenants  = tenants.canView;
  const canAddTenant    = tenants.canCreate;
  const canViewAttendance = attendance.canView;
  const canViewLeads    = leads.canView;

  const go = useCallback((s: Screen) => setScreen(s), []);
  const open = useCallback((s: Screen, id: number) => { setSelectedId(id); setScreen(s); }, []);
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
    if (screen === 'members') return canViewMembers
      ? <ViewMembersPage onBack={goHome} onAddMember={canAddMember ? () => go('add-member') : undefined} onOpenMember={(id) => open('member-detail', id)} />
      : <NoModuleAccess onBack={goHome} />;
    if (screen === 'member-detail') return canViewMembers
      ? <MemberDetailPage memberId={selectedId} onBack={() => go('members')} canEdit={members.canEdit}
          onEdit={members.canEdit ? () => go('edit-member') : undefined}
          onNewMembership={billingAccess.canCreate ? () => go('new-membership') : undefined} />
      : <NoModuleAccess onBack={() => go('members')} />;
    if (screen === 'edit-member') return members.canEdit
      ? <EditMemberPage memberId={selectedId} onBack={() => go('member-detail')} onSaved={() => go('member-detail')} />
      : <NoModuleAccess onBack={() => go('member-detail')} />;
    if (screen === 'add-member') return canAddMember
      ? <AddMemberPage onBack={() => go('members')} />
      : <NoModuleAccess onBack={() => go('members')} />;
    if (screen === 'trainers') return canViewTrainers
      ? <ViewTrainersPage onBack={goHome} onAddTrainer={canAddTrainer ? () => go('add-trainer') : undefined} />
      : <NoModuleAccess onBack={goHome} />;
    if (screen === 'add-trainer') return canAddTrainer
      ? <AddTrainerPage onBack={() => go('trainers')} />
      : <NoModuleAccess onBack={() => go('trainers')} />;
    if (screen === 'branches') return canViewBranches
      ? <ViewBranchesPage onBack={goHome} onAddBranch={canAddBranch ? () => go('add-branch') : undefined}
          onEditBranch={branches.canEdit ? (id) => open('edit-branch', id) : undefined} />
      : <NoModuleAccess onBack={goHome} />;
    if (screen === 'edit-branch') return branches.canEdit
      ? <EditBranchPage branchId={selectedId} onBack={() => go('branches')} onSaved={() => go('branches')} />
      : <NoModuleAccess onBack={() => go('branches')} />;
    if (screen === 'add-branch') return canAddBranch
      ? <AddBranchPage onBack={() => go('branches')} />
      : <NoModuleAccess onBack={() => go('branches')} />;
    if (screen === 'tenants') return canViewTenants
      ? <ViewTenantsPage onBack={goHome} onAddTenant={canAddTenant ? () => go('add-tenant') : undefined}
          onEditTenant={tenants.canEdit ? (id) => open('edit-tenant', id) : undefined} />
      : <NoModuleAccess onBack={goHome} />;
    if (screen === 'edit-tenant') return tenants.canEdit
      ? <EditTenantPage tenantId={selectedId} onBack={() => go('tenants')} onSaved={() => go('tenants')} />
      : <NoModuleAccess onBack={() => go('tenants')} />;
    if (screen === 'add-tenant') return canAddTenant
      ? <AddTenantPage onBack={() => go('tenants')} />
      : <NoModuleAccess onBack={() => go('tenants')} />;
    if (screen === 'leads') return canViewLeads
      ? <ViewLeadsPage onBack={goHome} onAddLead={leads.canCreate ? () => go('add-lead') : undefined} />
      : <NoModuleAccess onBack={goHome} />;
    if (screen === 'add-lead') return leads.canCreate
      ? <AddLeadPage onBack={() => go('leads')} />
      : <NoModuleAccess onBack={() => go('leads')} />;
    // Exercises/workouts/plans are gated here too, not only by hiding their tiles.
    if (screen === 'exercises') return exercises.canView
      ? <ViewExercisesPage onBack={goHome} onAddExercise={exercises.canCreate ? () => go('add-exercise') : undefined} />
      : <NoModuleAccess onBack={goHome} />;
    if (screen === 'add-exercise') return exercises.canCreate
      ? <AddExercisePage onBack={() => go('exercises')} />
      : <NoModuleAccess onBack={() => go('exercises')} />;
    if (screen === 'workouts') return workouts.canView
      ? <ViewWorkoutsPage onBack={goHome} onAddWorkout={workouts.canCreate ? () => go('add-workout') : undefined} />
      : <NoModuleAccess onBack={goHome} />;
    if (screen === 'add-workout') return workouts.canCreate
      ? <AddWorkoutPage onBack={() => go('workouts')} />
      : <NoModuleAccess onBack={() => go('workouts')} />;
    if (screen === 'plans') return plans.canView
      ? <ViewPlansPage onBack={goHome} onAddPlan={plans.canCreate ? () => go('add-plan') : undefined} />
      : <NoModuleAccess onBack={goHome} />;
    if (screen === 'add-plan') return plans.canCreate
      ? <AddPlanPage onBack={() => go('plans')} />
      : <NoModuleAccess onBack={() => go('plans')} />;
    if (screen === 'billing') return billingAccess.canView
      ? <BillingHomePage onBack={goHome} onOpenMember={canViewMembers ? (id) => open('member-detail', id) : undefined}
          onNewInvoice={billingAccess.canCreate ? () => go('new-invoice') : undefined} />
      : <NoModuleAccess onBack={goHome} />;
    if (screen === 'new-invoice') return billingAccess.canCreate
      ? <NewInvoicePage onBack={() => go('billing')} />
      : <NoModuleAccess onBack={() => go('billing')} />;
    if (screen === 'new-membership') return billingAccess.canCreate
      ? <NewMembershipPage memberId={selectedId} onBack={() => go('member-detail')} />
      : <NoModuleAccess onBack={() => go('member-detail')} />;
    if (screen === 'roles') return roles.canView
      ? <RolesPage onBack={goHome} onOpenRoleAccess={(id) => open('module-access', id)} />
      : <NoModuleAccess onBack={goHome} />;
    if (screen === 'module-access') return roles.canView
      ? <ModuleAccessPage onBack={() => go('roles')} initialRoleId={selectedId || undefined} />
      : <NoModuleAccess onBack={goHome} />;
    if (screen === 'user-access')   return <UserAccessListPage onBack={goHome} />;
    if (screen === 'challenges-admin')   return <ChallengesAdminPage   onBack={goHome} />;
    if (screen === 'stats-admin')        return <StatsAdminPage        onBack={goHome} />;
    if (screen === 'live-coaching-admin') return <LiveCoachingAdminPage onBack={goHome} />;
    if (screen === 'ai-coach-admin')     return <AiCoachSettingsPage   onBack={goHome} />;
    if (screen === 'attendance') return canViewAttendance
      ? <AttendanceSettingsPage onBack={goHome} onOpenLog={() => go('attendance-log')} />
      : <NoModuleAccess onBack={goHome} />;
    if (screen === 'attendance-log')     return <AttendanceLogPage     onBack={() => go('attendance')} />;
    if (screen === 'more-actions')       return <MoreActionsPage onBack={goHome} onNavigate={(k) => go(k as Screen)} onLogout={confirmLogout} />;
    if (screen === 'profile-details')    return <AdminProfileDetailsPage onBack={goHome} roleLabel={roleLabel} />;
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
      <ProfileSheet
        visible={profileOpen}
        onClose={() => setProfileOpen(false)}
        profile={me}
        isLoading={meLoading}
        isError={meError}
        roleLabel={roleLabel}
        onLogout={confirmLogout}
        onViewMore={() => { setProfileOpen(false); go('profile-details'); }}
        onChangePassword={() => { setProfileOpen(false); setPwOpen(true); }}
      />
      <ChangePasswordSheet visible={pwOpen} onClose={() => setPwOpen(false)} onChanged={() => onLogout?.()} />
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
            adminName={displayName}
            avatarUrl={me?.avatarUrl ?? undefined}
            roleLabel={roleLabel}
            onPressAvatar={() => setProfileOpen(true)}
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
              <RecentMemberRow key={member.id} member={member} onPress={() => Number(member.id) > 0 ? open('member-detail', Number(member.id)) : go('members')} />
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
