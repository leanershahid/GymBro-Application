import React, { useState } from 'react';
import { View } from 'react-native';
import { T } from '../../theme';
import { useLanding, useMenu } from '../access/context/AccessContext';
import NoAccessScreen      from '../access/components/NoAccessScreen';
import { OpenRequest, ShellHosted } from '../access/types/access.types';
import { pathKey } from '../../navigation/paths';
import { PathChange, useOpenRequest, useReportLocation } from '../../navigation/useAreaRoute';
import { MemberRoute, memberModuleOf, memberRouteFromPath, memberRouteToPath } from './memberRoutes';
import HomeScreen          from './screens/HomeScreen';
import TrainScreen         from './screens/TrainScreen';
import PlansScreen         from './screens/PlansScreen';
import ProfileScreen       from './screens/ProfileScreen';
import WorkoutDetailScreen from './screens/WorkoutDetailScreen';
import CommunityScreen     from './screens/CommunityScreen';
import StatsScreen         from './screens/StatsScreen';
import ProgressScreen      from './screens/ProgressScreen';
import MyBillingScreen     from '../member-billing/screens/MyBillingScreen';
import BookScreen          from '../member-booking/screens/BookScreen';
import ShopStoreApp        from '../shop/store/ShopStoreApp';
import SocialApp           from '../social/SocialApp';
import { SafetyFlowScreen, SafetyGateHost } from '../safety/routes';
import { NotificationsScreen, NotificationSettingsScreen, useNotifications } from '../notifications';
import SecuritySettingsScreen from '../auth/screens/SecuritySettingsScreen';
import { AnnouncementsScreen, AnnouncementDetailScreen, BranchInfoScreen } from '../operations/routes';
import { PendingDeletionBanner, PrivacyCentreScreen } from '../privacy/routes';
import { JoinFlowScreen, MembershipRequestScreen, MyMembershipScreen, PlansBrowseScreen, isSelfServiceRouteId } from '../self-service/routes';
import { HelpCentreScreen, HelpRequestScreen, NewHelpRequestScreen, isSupportRouteId } from '../support/routes';
import { MyReportScreen, MyReportsScreen, ReportProblemScreen, isFacilitiesRouteId } from '../facilities/routes';
import { MessagesScreen, MessageThreadScreen, isMessagingRouteId } from '../messaging/routes';

type Screen = MemberRoute;

/** Screens every member can open, whatever modules are granted. */
const ALWAYS_OPEN = new Set<Screen['id']>(['safety', 'notifications', 'notification-settings', 'security', 'privacy',
  // Help & feedback: the member's own requests and the gym's FAQ.
  'help', 'help-new', 'help-request',
  // Facilities: report a problem and follow my reports.
  'report-problem', 'my-reports', 'my-report',
  // Messages: the member's threads with their coaches.
  'messages', 'message-thread']);

interface Props extends ShellHosted {
  userId: number;
  onLogout: () => void;
}

/**
 * The member screens. The app shell (AppShell) hosts them and owns the tab bar; which screens open
 * comes from the access list.
 */
export default function MemberApp({ userId, onLogout, open, onRouteChange }: Props) {
  const { routes } = useMenu();
  const landingId = useLanding('home', 'profile');
  const landing: Screen = memberRouteFromPath([landingId]) ?? { id: 'profile' };

  // A path from the shell (tab, Back, URL): unknown paths open the landing screen.
  const resolve = (o: OpenRequest | undefined): Screen => {
    const r = o && memberRouteFromPath(o.path);
    if (!r) return landing;
    return r.id === 'shop' ? { ...r, open: { path: r.sub ?? [], at: o.at } } : r;
  };
  const [screen, setScreen] = useState<Screen>(() => resolve(open));
  useOpenRequest(open, () => setScreen(resolve(open)));
  useReportLocation({ path: memberRouteToPath(screen), module: memberModuleOf(screen) }, open, onRouteChange);

  // A workout opens from Train or from a plan day; profile is always there.
  const canOpen = (id: Screen['id']) =>
    id === 'profile' || ALWAYS_OPEN.has(id) || routes.has(id) ||
    (id === 'workout' && (routes.has('train') || routes.has('plans'))) ||
    (id === 'announcement' && routes.has('announcements')) ||
    // Self-service screens come with the Membership (billing) module.
    (isSelfServiceRouteId(id) && routes.has('billing'));

  const goLanding = () => setScreen(landing);
  const unread = useNotifications(userId).data?.unread ?? 0;
  const openBilling = canOpen('billing') ? () => setScreen({ id: 'billing' }) : undefined;

  // The shop's own screens (tab, product, order) become part of this area's path.
  const onShopPath: PathChange = (sub, replace) => {
    setScreen(s => (s.id === 'shop' && pathKey(s.sub ?? []) !== pathKey(sub) ? { ...s, sub } : s));
    if (replace) onRouteChange?.({ path: ['shop', ...sub], module: 'shop', replace });
  };

  const navigateFrom = (target: string) => {
    // Paths such as announcements/12 or branch-info (Home cards, announcement call-to-action).
    if (target.includes('/') || target === 'branch-info' || target === 'announcements' || isSelfServiceRouteId(target) || isSupportRouteId(target) || isFacilitiesRouteId(target) || isMessagingRouteId(target)) {
      const r = memberRouteFromPath(target.split('/'));
      if (r) { setScreen(r); return; }
    }
    if (target.startsWith('workout-')) {
      const wid = parseInt(target.replace('workout-', ''), 10);
      setScreen({ id: 'workout', workoutId: wid, from: screen });
      return;
    }
    if (target === 'train' || target === 'plans' || target === 'billing') {
      setScreen({ id: target });
      return;
    }
    // Only granted screens; unknown targets are ignored
    // instead of leaving an empty content area.
    const r = routes.has(target) ? memberRouteFromPath([target]) : null;
    if (r) setScreen(r);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* ── Screen content ── */}
      <View style={{ flex: 1 }}>
        {!canOpen(screen.id) && <NoAccessScreen onBack={goLanding} />}
        {canOpen(screen.id) && (<>
          {screen.id === 'workout' && (
            <WorkoutDetailScreen
              workoutId={screen.workoutId}
              userId={userId}
              onBack={() => setScreen(screen.from ?? (routes.has('train') ? { id: 'train' } : landing))}
            />
          )}
          {screen.id === 'train' && (
            <TrainScreen userId={userId} onOpenWorkout={(id) => setScreen({ id: 'workout', workoutId: id })} />
          )}
          {screen.id === 'plans' && (
            <PlansScreen
              userId={userId}
              initialPlanId={screen.planId}
              onBack={goLanding}
              onOpenWorkout={(id, planId) => setScreen({ id: 'workout', workoutId: id, from: { id: 'plans', planId } })}
            />
          )}
          {screen.id === 'book' && (
            <BookScreen userId={userId} onOpenBilling={openBilling} onContactGym={() => setScreen({ id: 'help' })} />
          )}
          {screen.id === 'shop' && <ShopStoreApp open={screen.open} onPathChange={onShopPath} />}
          {screen.id === 'social' && <SocialApp />}
          {screen.id === 'billing' && (
            <MyBillingScreen userId={userId} onBack={goLanding}
              onManageMembership={() => setScreen({ id: 'my-membership' })} onBrowsePlans={() => setScreen({ id: 'plans-browse' })} />
          )}
          {screen.id === 'plans-browse' && (
            <PlansBrowseScreen onBack={goLanding} onJoin={(planId, coupon) => setScreen({ id: 'join', planId, coupon })}
              onOpenMyMembership={() => setScreen({ id: 'my-membership' })} />
          )}
          {screen.id === 'join' && (
            <JoinFlowScreen userId={userId} planId={screen.planId} coupon={screen.coupon} onBack={() => setScreen({ id: 'plans-browse' })}
              onBookClass={routes.has('book') ? () => setScreen({ id: 'book' }) : undefined}
              onOpenMyMembership={() => setScreen({ id: 'my-membership' })} />
          )}
          {screen.id === 'my-membership' && (
            <MyMembershipScreen userId={userId} onBack={goLanding} onBrowsePlans={() => setScreen({ id: 'plans-browse' })}
              onOpenRequest={(requestId) => setScreen({ id: 'membership-request', requestId })} onOpenBilling={openBilling} />
          )}
          {screen.id === 'membership-request' && (
            <MembershipRequestScreen userId={userId} requestId={screen.requestId} onBack={() => setScreen({ id: 'my-membership' })}
              onOpenBilling={openBilling} />
          )}
          {screen.id === 'home' && (
            <HomeScreen userId={userId} onNavigate={navigateFrom}
              onOpenSafety={(step) => setScreen({ id: 'safety', step })}
              onOpenAlerts={() => setScreen({ id: 'notifications' })} unread={unread} />
          )}
          {screen.id === 'notifications' && (
            <NotificationsScreen userId={userId} onBack={goLanding}
              onOpenSettings={() => setScreen({ id: 'notification-settings' })} />
          )}
          {screen.id === 'notification-settings' && (
            <NotificationSettingsScreen userId={userId} onBack={() => setScreen({ id: 'profile' })} />
          )}
          {screen.id === 'security' && (
            <SecuritySettingsScreen onBack={() => setScreen({ id: 'profile' })} />
          )}
          {screen.id === 'announcements' && (
            <AnnouncementsScreen onBack={goLanding} onOpen={(id) => setScreen({ id: 'announcement', announcementId: id })} />
          )}
          {screen.id === 'announcement' && (
            <AnnouncementDetailScreen announcementId={screen.announcementId}
              onBack={() => setScreen({ id: 'announcements' })} onOpenRoute={navigateFrom} />
          )}
          {screen.id === 'branch-info' && (
            <BranchInfoScreen branchId={screen.branchId} onBack={goLanding} onReportProblem={() => setScreen({ id: 'report-problem' })} />
          )}
          {screen.id === 'safety' && (
            <SafetyFlowScreen start={screen.step} onClose={goLanding} />
          )}
          {screen.id === 'community' && (
            <CommunityScreen userId={userId} />
          )}
          {screen.id === 'stats' && (
            <StatsScreen userId={userId} />
          )}
          {screen.id === 'progress' && (
            <ProgressScreen userId={userId} onOpenPlans={canOpen('plans') ? () => setScreen({ id: 'plans' }) : undefined} />
          )}
          {screen.id === 'profile' && (
            <ProfileScreen userId={userId} onLogout={onLogout} onOpenBilling={openBilling}
              onOpenNotifications={() => setScreen({ id: 'notification-settings' })}
              onOpenSecurity={() => setScreen({ id: 'security' })}
              onOpenPrivacy={() => setScreen({ id: 'privacy' })}
              onOpenHelp={() => setScreen({ id: 'help' })}
              onOpenReports={() => setScreen({ id: 'my-reports' })}
              onOpenMessages={() => setScreen({ id: 'messages' })} />
          )}
          {screen.id === 'privacy' && (
            <PrivacyCentreScreen onBack={() => setScreen({ id: 'profile' })} onSignOut={onLogout} onOpenRoute={navigateFrom} />
          )}
          {screen.id === 'help' && (
            <HelpCentreScreen onBack={() => setScreen({ id: 'profile' })} onNew={() => setScreen({ id: 'help-new' })}
              onOpen={(requestId) => setScreen({ id: 'help-request', requestId })} />
          )}
          {screen.id === 'help-new' && (
            <NewHelpRequestScreen initialCategory={screen.category} onBack={() => setScreen({ id: 'help' })}
              onCreated={(requestId) => setScreen({ id: 'help-request', requestId })} />
          )}
          {screen.id === 'help-request' && (
            <HelpRequestScreen requestId={screen.requestId} onBack={() => setScreen({ id: 'help' })} onNew={() => setScreen({ id: 'help-new' })} />
          )}
          {screen.id === 'report-problem' && (
            <ReportProblemScreen onBack={goLanding} onOpenReport={(reportId) => setScreen({ id: 'my-report', reportId })}
              onOpenMyReports={() => setScreen({ id: 'my-reports' })} />
          )}
          {screen.id === 'my-reports' && (
            <MyReportsScreen onBack={() => setScreen({ id: 'profile' })} onOpen={(reportId) => setScreen({ id: 'my-report', reportId })}
              onNew={() => setScreen({ id: 'report-problem' })} />
          )}
          {screen.id === 'my-report' && (
            <MyReportScreen reportId={screen.reportId} onBack={() => setScreen({ id: 'my-reports' })} />
          )}
          {screen.id === 'messages' && (
            <MessagesScreen side="member" onBack={goLanding} onOpen={(conversationId) => setScreen({ id: 'message-thread', conversationId })} />
          )}
          {screen.id === 'message-thread' && (
            <MessageThreadScreen conversationId={screen.conversationId} onBack={() => setScreen({ id: 'messages' })}
              onOpenWorkout={canOpen('workout') ? (workoutId) => setScreen({ id: 'workout', workoutId, from: screen }) : undefined}
              onOpenPlan={canOpen('plans') ? (planId) => setScreen({ id: 'plans', planId }) : undefined} />
          )}
        </>)}
      </View>
      {/* Opens the waiver / health flow when booking or check-in is refused for safety. */}
      <SafetyGateHost />
      {/* "Your account will be deleted on …" with Keep my account, on every screen but Privacy itself. */}
      {screen.id !== 'privacy' && <PendingDeletionBanner onOpenPrivacy={() => setScreen({ id: 'privacy' })} />}
    </View>
  );
}
