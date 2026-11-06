import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, withAlpha } from '../../../theme';
import BottomTabBar from '../../common/components/BottomTabBar';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import SearchBar from '../../common/components/SearchBar';
import AdminDashboard from '../../dashboard/pages/AdminDashboard';
import TrainerApp from '../../trainer-app/TrainerApp';
import MemberApp from '../../member-app/MemberApp';
import { AppScope, moduleIcon, normalizeRoute, useAccess } from '../context/AccessContext';
import { AccessApp, AccessModule, AreaLocation, OpenRequest } from '../types/access.types';
import { MENU_CONTAINER_ROUTES } from '../../common/constants/menuRoutes';
import { MORE, Place, ShellArea } from '../../../navigation/paths';
import { initialPlace, useShellHistory } from '../../../navigation/useShellHistory';
import NoAccessScreen from './NoAccessScreen';
import TwoFactorGraceBanner from '../../auth/components/twoFactor/TwoFactorGraceBanner';
import { onNotificationOpen, parseNotificationRoute } from '../../notifications';
import type { NotificationTarget } from '../../notifications';
import { openBookOn } from '../../member-booking/screens/BookScreen';

/** Each area's profile screen, always reachable from More. */
const PROFILE_ROUTE: Record<AccessApp, string> = { admin: 'profile-details', trainer: 'profile', member: 'profile' };
const AREAS: AccessApp[] = ['admin', 'trainer', 'member'];
const AREA_LABEL: Record<AccessApp, string> = { admin: 'Management', trainer: 'Training', member: 'Member' };

interface Item { key: string; app: AccessApp; route: string; name: string; icon: string | null }

/**
 * Every assigned module as one flat menu, home area first: main-menu modules, then submenus.
 * Profiles (always in More), container menus, inner pages and tabs are left out.
 */
function useShellItems(): Item[] {
  const { allModules, homeApp } = useAccess();
  return useMemo(() => {
    const order = [homeApp, ...AREAS.filter(a => a !== homeApp)];
    const visible = allModules.filter(m =>
      !m.isTab && !m.hideFromMenu && !MENU_CONTAINER_ROUTES.has(normalizeRoute(m)) && normalizeRoute(m) !== PROFILE_ROUTE[m.app]);
    const byOrder = (a: AccessModule, b: AccessModule) => a.sortOrder - b.sortOrder;
    const list = order.flatMap(app => [
      ...visible.filter(m => m.app === app && m.level === 1).sort(byOrder),
      ...visible.filter(m => m.app === app && m.level > 1).sort(byOrder),
    ]);
    // Two areas can have a module of the same name (Classes, PT, Plans): the later one says which.
    return list.map((m, i) => ({
      key: m.key, app: m.app, route: normalizeRoute(m), icon: m.icon,
      name: list.slice(0, i).some(x => x.name === m.name) ? `${m.name} · ${AREA_LABEL[m.app]}` : m.name,
    }));
  }, [allModules, homeApp]);
}

/** Every module that isn't on the bar — searchable, grouped by area — then Profile and Sign out. */
function MoreScreen({ items, onOpen, onProfile, onHelp, onLogout }: {
  items: Item[]; onOpen: (item: Item) => void; onProfile: () => void; onHelp?: () => void; onLogout: () => void;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = q ? items.filter(i => i.name.toLowerCase().includes(q)) : items;
  const groups = AREAS.map(a => ({ app: a, items: shown.filter(i => i.app === a) })).filter(g => g.items.length > 0);

  const row = (key: string, label: string, icon: React.ComponentProps<typeof Feather>['name'], onPress: () => void, tone = T.brand) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16,
        borderRadius: 14, borderWidth: 1, borderColor: T.line,
        backgroundColor: pressed ? withAlpha(tone, 0.08) : T.bgPanel,
      })}
    >
      <Feather name={icon} size={19} color={tone} />
      <Text style={{ flex: 1, color: T.text, fontSize: 15, fontWeight: '600' }}>{label}</Text>
      <Feather name="chevron-right" size={18} color={T.textFaint} />
    </Pressable>
  );
  const heading = (label: string) => (
    <Text key={`h-${label}`} style={{ color: T.textSub, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 10 }}>
      {label}
    </Text>
  );

  return (
    <Screen>
      <ScreenHeader eyebrow="Menu" title="More" />
      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 48, gap: 8 }}>
        {items.length > 6 && <SearchBar value={query} onChangeText={setQuery} placeholder="Search menu" />}
        {groups.map(g => [
          // One area needs no heading.
          groups.length > 1 || AREAS.some(a => a !== g.app && items.some(i => i.app === a)) ? heading(AREA_LABEL[g.app]) : null,
          ...g.items.map(i => row(i.key, i.name, moduleIcon(i.icon), () => onOpen(i))),
        ])}
        {q && shown.length === 0 && <Text style={{ color: T.textSub, fontSize: 14, paddingVertical: 12 }}>Nothing matches "{query}".</Text>}
        {heading('Account')}
        {row('profile', 'Profile', 'user', onProfile)}
        {onHelp && row('help', 'Help & feedback', 'life-buoy', onHelp)}
        {row('sign-out', 'Sign out', 'log-out', onLogout, T.err)}
      </ScrollView>
    </Screen>
  );
}

const BAR_SLOTS = 4;

/**
 * The one app every role uses. Its bottom bar and More screen are built from the modules the
 * person is assigned — of any area — so everyone sees the same design with only their own modules.
 * Each module opens the existing screens of its area (admin, trainer or member), hosted here.
 *
 * Navigation rules: the tab of the module a screen belongs to stays lit; tapping the lit tab again
 * returns to that module's first screen. Every screen an area reports (route + ids) is a history
 * entry (src/navigation): on web it is the URL (`/member/workout/12`), so reload, deep links and
 * browser Back/Forward work; on phones the Android back button steps back through them and leaves
 * the app only from the first one. A URL for an area the person has no modules in shows "Not
 * available"; each area gates its own unassigned routes the same way.
 */
export default function AppShell({ userId, onLogout }: { userId: number; onLogout: () => void }) {
  const { homeApp, allModules } = useAccess();
  const items = useShellItems();
  const bar = items.slice(0, BAR_SLOTS);
  const more = items.slice(BAR_SLOTS);

  const firstPlace: Place = bar[0] ? { area: bar[0].app, path: [bar[0].route] } : { area: homeApp, path: [PROFILE_ROUTE[homeApp]] };
  const hasArea = (a: ShellArea) => a !== MORE && (a === homeApp || allModules.some(m => m.app === a));

  const [start] = useState(() => initialPlace(firstPlace));
  const [current, setCurrent] = useState<{ place: Place; open: OpenRequest }>(() => ({ place: start, open: { path: start.path, at: 0 } }));
  // The module of the screen showing (as the area reports it), to light the matching tab.
  const [shown, setShown] = useState<{ app: ShellArea; module: string | undefined }>({ app: start.area, module: start.path[0] });
  // Remounts the hosted area — a second tap on the lit tab starts the module fresh.
  const [resetCount, setResetCount] = useState(0);

  const history = useShellHistory(start, {
    show: p => {
      setShown({ app: p.area, module: p.path[0] });
      setCurrent({ place: p, open: { path: p.path, at: Date.now() } });
    },
    expectsReport: p => hasArea(p.area),
  });

  const area = current.place.area;
  const activeKey = area === MORE
    ? MORE
    : bar.find(b => b.app === shown.app && b.route === shown.module)?.key ?? MORE;

  const tabs = [
    ...bar.map(b => ({ key: b.key, label: b.name, icon: moduleIcon(b.icon) })),
    { key: MORE, label: 'More', icon: 'menu' as const },
  ];
  const openModule = (app: AccessApp, route: string) => history.go({ area: app, path: [route] });
  const onTab = (key: string) => {
    if (key === MORE) { history.go({ area: MORE, path: [] }); return; }
    const b = bar.find(x => x.key === key);
    if (!b) return;
    if (key === activeKey) setResetCount(n => n + 1);           // second tap: back to the module's start
    openModule(b.app, b.route);
  };

  const hosted = (app: AccessApp, open: OpenRequest) => {
    const onRouteChange = (loc: AreaLocation) => {
      setShown({ app, module: loc.module });
      history.report({ area: app, path: loc.path }, loc.replace);
    };
    if (!hasArea(app)) return <NoAccessScreen onBack={() => history.go(firstPlace)} />;
    return (
      // Keyed by area (and resets), so moving between areas starts that area's screens fresh.
      <AppScope key={`${app}-${resetCount}`} app={app}>
        {app === 'admin' && <AdminDashboard onLogout={onLogout} open={open} onRouteChange={onRouteChange} />}
        {app === 'trainer' && <TrainerApp userId={userId} onLogout={onLogout} open={open} onRouteChange={onRouteChange} />}
        {app === 'member' && <MemberApp userId={userId} onLogout={onLogout} open={open} onRouteChange={onRouteChange} />}
      </AppScope>
    );
  };

  // A tapped push (or a cold-start tap) opens the matching screen in the user's main area.
  const goRef = useRef(history.go);
  goRef.current = history.go;
  useEffect(() => onNotificationOpen(payload => {
    const place = notificationPlace(homeApp, parseNotificationRoute(payload));
    if (place) goRef.current(place);
  }), [homeApp]);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* Shown only while the gym requires two-step sign-in and it isn't set up yet. */}
      <TwoFactorGraceBanner onPress={() => history.go({ area: homeApp, path: ['security'] })} />
      <View style={{ flex: 1 }}>
        {area === MORE ? (
          <MoreScreen
            items={more}
            onOpen={i => openModule(i.app, i.route)}
            onProfile={() => openModule(homeApp, PROFILE_ROUTE[homeApp])}
            onHelp={homeApp === 'member' ? () => openModule('member', 'help') : undefined}
            onLogout={onLogout}
          />
        ) : hosted(area, current.open)}
      </View>
      <BottomTabBar tabs={tabs} active={activeKey} onChange={onTab} />
    </View>
  );
}

/** Where a tapped notification goes in each area (unknown targets open the alerts list / home). */
function notificationPlace(app: AccessApp, t: NotificationTarget): Place | null {
  if (app === 'member') {
    switch (t.screen) {
      case 'class': openBookOn('mine'); return { area: app, path: ['book'] };
      case 'my-bookings': openBookOn('mine'); return { area: app, path: ['book'] };
      case 'pt': openBookOn('pt'); return { area: app, path: ['book'] };
      case 'billing': return { area: app, path: ['billing'] };
      case 'training': return { area: app, path: ['train'] };
      case 'announcement': return { area: app, path: t.announcementId ? ['announcements', String(t.announcementId)] : ['announcements'] };
      case 'membership-request': return { area: app, path: t.requestId ? ['membership-request', String(t.requestId)] : ['my-membership'] };
      case 'help-request': return { area: app, path: t.requestId ? ['help-request', String(t.requestId)] : ['help'] };
      case 'my-report': return { area: app, path: t.reportId ? ['my-report', String(t.reportId)] : ['my-reports'] };
      case 'message-thread': return { area: app, path: t.conversationId ? ['message-thread', String(t.conversationId)] : ['messages'] };
      default: return { area: app, path: ['notifications'] };
    }
  }
  if (app === 'trainer') {
    if (t.screen === 'class') return { area: app, path: ['classes'] };
    if (t.screen === 'pt') return { area: app, path: ['sessions'] };
    if (t.screen === 'support-request') return { area: app, path: t.requestId ? ['support-request', String(t.requestId)] : ['support'] };
    if (t.screen === 'message-thread') return { area: app, path: t.conversationId ? ['message-thread', String(t.conversationId)] : ['messages'] };
    return { area: app, path: ['home'] };
  }
  switch (t.screen) {
    case 'member': return { area: app, path: ['member-detail', String(t.memberId)] };
    case 'class': return { area: app, path: ['classes'] };
    case 'pt': return { area: app, path: ['pt-sessions'] };
    case 'billing': return { area: app, path: ['billing'] };
    case 'membership-request': return { area: app, path: ['membership-requests'] };
    case 'support-request': return { area: app, path: t.requestId ? ['support-request', String(t.requestId)] : ['support'] };
    case 'facility-report': return { area: app, path: t.reportId ? ['facility-report', String(t.reportId)] : ['facility-reports'] };
    default: return { area: app, path: ['home'] };
  }
}
