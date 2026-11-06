import React, { useCallback, useState } from 'react';
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
import { OpenRequest, ShellHosted } from '../../access/types/access.types';
import { pathKey } from '../../../navigation/paths';
import { PathChange, useOpenRequest, useReportLocation } from '../../../navigation/useAreaRoute';
import { AdminLocation, AdminScreen, ALWAYS_OPEN, adminFromPath, adminPath, isAdminScreen, ownerOf } from '../admin/adminRoutes';
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
  const landingRoute = useLanding('home', 'more-actions');
  const landing: AdminScreen = isAdminScreen(landingRoute) ? landingRoute : 'more-actions';
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
  // A path from the shell (tab, Back, URL): unknown paths open the landing screen.
  const resolve = (o: OpenRequest | undefined): AdminLocation => {
    const l = o && adminFromPath(o.path);
    if (!l) return { screen: landing, id: 0, sub: [] };
    return l.screen === 'shop' ? { ...l, subOpen: { path: l.sub, at: o.at } } : l;
  };
  const [loc, setLoc] = useState<AdminLocation>(() => resolve(openRequest));
  useOpenRequest(openRequest, () => setLoc(resolve(openRequest)));
  // ARCH-113: report the real screen + record (not just its module), so Back and the URL reach it.
  useReportLocation({ path: adminPath(loc), module: ownerOf(loc.screen) }, openRequest, onRouteChange);
  const screen = loc.screen;
  const selectedId = loc.id;
  const canOpen = (s: AdminScreen) => ALWAYS_OPEN.has(s) || routes.has(ownerOf(s));

  const access = useAdminAccess();

  // go keeps the record (detail → edit → back to detail); open switches to another record.
  // The record id carries over only within one module (member-detail → edit-member); a screen of
  // another module (e.g. branch-hours opened from the menu) starts without a stale id.
  const go = useCallback((s: AdminScreen) =>
    setLoc(l => ({ screen: s, id: ownerOf(s) === ownerOf(l.screen) ? l.id : 0, sub: [] })), []);
  const open = useCallback((s: AdminScreen, id: number) => setLoc({ screen: s, id, sub: [] }), []);
  const goHome = useCallback(() => setLoc(l => ({ screen: landing, id: l.id, sub: [] })), [landing]);
  // The shop's own screens become part of this area's path.
  const onShopPath = useCallback<PathChange>((sub, replace) => {
    setLoc(l => (l.screen === 'shop' && pathKey(l.sub) !== pathKey(sub) ? { ...l, sub } : l));
    if (replace) onRouteChange?.({ path: ['shop', ...sub], module: 'shop', replace });
  }, [onRouteChange]);

  const desk = useFrontDesk(access, go, open);


  // Sub-page routing — only screens of granted modules (and their own sub-screens) open,
  // even when reached some other way.
  const subPage = !canOpen(screen)
    ? <NoModuleAccess onBack={goHome} />
    : renderAdminScreen(screen, { access, desk, selectedId, go, open, goHome, roleLabel, confirmLogout, shop: { open: loc.subOpen, onPathChange: onShopPath } });

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
