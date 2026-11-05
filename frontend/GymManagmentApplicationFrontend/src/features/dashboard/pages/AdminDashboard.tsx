import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { showAlert } from '../../common/components/dialogs';
import ChangePasswordSheet from '../../auth/components/ChangePasswordSheet';
import { T } from '../../../theme';
import ProfileSheet from '../components/ProfileSheet';
import MemberPickerSheet from '../components/MemberPickerSheet';
import QuickCreateSheet from '../components/QuickCreateSheet';
import { useMe } from '../../auth/api/authQueries';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useVisibleAdminActions } from '../adminActions';
import { getSession, isSuperAdmin, isAdminRole } from '../../../api/session';
import { useLanding, useMenu } from '../../access/context/AccessContext';
import { ShellHosted } from '../../access/types/access.types';
import { AdminScreen, ALWAYS_OPEN, ownerOf } from '../admin/adminRoutes';
import { useAdminAccess } from '../admin/useAdminAccess';
import { useFrontDesk } from '../admin/useFrontDesk';
import { renderAdminScreen } from '../admin/AdminRouter';
import AdminHome from '../admin/AdminHome';
import NoModuleAccess from '../admin/NoModuleAccess';

interface AdminDashboardProps extends ShellHosted { adminName?: string; onLogout?: () => void; }

/**
 * The admin screens. The app shell (AppShell) hosts them and owns the tab bar; which screens open
 * comes from the access list. The route table lives in ../admin/AdminRouter, the home screen in
 * ../admin/AdminHome and the front-desk tools in ../admin/useFrontDesk (ARCH-059).
 */
export default function AdminDashboard({ adminName = 'Admin', onLogout, open: openRequest, onRouteChange }: AdminDashboardProps) {
  const { routes } = useMenu();
  const landing = useLanding('home', 'more-actions') as AdminScreen;
  const { data, loading, refreshing, error, refresh } = useDashboardStats(routes.has('home'));
  const actions = useVisibleAdminActions();
  const role = getSession()?.role;
  const superAdmin = isSuperAdmin(role);
  const roleLabel = superAdmin ? 'Super Admin' : isAdminRole(role) ? 'Administrator' : 'Staff';
  const { data: me, isLoading: meLoading, isError: meError } = useMe();
  const displayName = me ? `${me.firstName} ${me.lastName}`.trim() || adminName : adminName;
  const [profileOpen, setProfileOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const confirmLogout = onLogout && (() => showAlert('Log out', 'Are you sure you want to log out?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Log out', style: 'destructive', onPress: onLogout },
  ]));
  const [screen, setScreen] = useState<AdminScreen>((openRequest?.route ?? landing) as AdminScreen);
  // Record the current detail/edit screen is about (member, branch, tenant, role).
  const [selectedId, setSelectedId] = useState<number>(0);
  const canOpen = (s: AdminScreen) => ALWAYS_OPEN.has(s) || routes.has(ownerOf(s));

  const access = useAdminAccess();

  const go = useCallback((s: AdminScreen) => setScreen(s), []);
  const open = useCallback((s: AdminScreen, id: number) => { setSelectedId(id); setScreen(s); }, []);
  const goHome = useCallback(() => setScreen(landing), [landing]);

  const desk = useFrontDesk(access, go, open);

  useEffect(() => { if (openRequest) go(openRequest.route as AdminScreen); }, [openRequest, go]);
  // A detail or add screen reports the module it belongs to, so that module's tab stays lit.
  useEffect(() => { onRouteChange?.(ownerOf(screen)); }, [screen]);

  // Sub-page routing — only screens of granted modules (and their own sub-screens) open,
  // even when reached some other way.
  const subPage = !canOpen(screen)
    ? <NoModuleAccess onBack={goHome} />
    : renderAdminScreen(screen, { access, desk, selectedId, go, open, goHome, roleLabel, confirmLogout });

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <View style={{ flex: 1 }}>
        {subPage ?? (
          <AdminHome
            data={data}
            loading={loading}
            refreshing={refreshing}
            error={error}
            refresh={refresh}
            displayName={displayName}
            avatarUrl={me?.avatarUrl ?? undefined}
            roleLabel={roleLabel}
            superAdmin={superAdmin}
            actions={actions}
            onPressAvatar={() => setProfileOpen(true)}
            onSearch={access.members.canView ? () => desk.setPickFor('search') : undefined}
            onQuickCreate={desk.quickActions.length > 0 ? () => desk.setQuickOpen(true) : undefined}
            go={go}
            open={open}
          />
        )}
      </View>
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
      <MemberPickerSheet
        visible={desk.pickFor !== null}
        title={desk.pickerTitle}
        onClose={() => desk.setPickFor(null)}
        onPick={desk.onPicked}
        busyId={desk.checkIn.isPending ? desk.checkIn.variables ?? null : null}
      />
      <QuickCreateSheet visible={desk.quickOpen} actions={desk.quickActions} onClose={() => desk.setQuickOpen(false)} />
      <ChangePasswordSheet visible={pwOpen} onClose={() => setPwOpen(false)} onChanged={() => onLogout?.()} />
    </View>
  );
}
