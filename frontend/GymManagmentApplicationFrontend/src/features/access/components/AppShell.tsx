import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, withAlpha } from '../../../theme';
import BottomTabBar from '../../common/components/BottomTabBar';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import AdminDashboard from '../../dashboard/pages/AdminDashboard';
import TrainerApp from '../../trainer-app/TrainerApp';
import MemberApp from '../../member-app/MemberApp';
import { AppScope, moduleIcon, normalizeRoute, useAccess } from '../context/AccessContext';
import { AccessApp, AccessModule, OpenRequest } from '../types/access.types';

const MORE = 'more';
/** Menu holders that only exist to list other modules — the shell's own More replaces them. */
const CONTAINER_ROUTES = new Set(['more-actions']);
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
      !m.isTab && !m.hideFromMenu && !CONTAINER_ROUTES.has(normalizeRoute(m)) && normalizeRoute(m) !== PROFILE_ROUTE[m.app]);
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

/** Every module that isn't on the bar, then Profile and Sign out. */
function MoreScreen({ items, onOpen, onProfile, onLogout }: {
  items: Item[]; onOpen: (item: Item) => void; onProfile: () => void; onLogout: () => void;
}) {
  const row = (key: string, label: string, icon: React.ComponentProps<typeof Feather>['name'], onPress: () => void, tone = T.brand) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16,
        borderRadius: 16, borderWidth: 1, borderColor: T.line,
        backgroundColor: pressed ? withAlpha(tone, 0.08) : T.bgPanel,
      })}
    >
      <Feather name={icon} size={20} color={tone} />
      <Text style={{ flex: 1, color: T.text, fontSize: 16, fontWeight: '600' }}>{label}</Text>
      <Feather name="chevron-right" size={18} color={T.textFaint} />
    </Pressable>
  );
  return (
    <Screen>
      <ScreenHeader eyebrow="Menu" title="More" />
      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48, gap: 10 }}>
        {items.map(i => row(i.key, i.name, moduleIcon(i.icon), () => onOpen(i)))}
        <View style={{ height: 8 }} />
        {row('profile', 'Profile', 'user', onProfile)}
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
 */
export default function AppShell({ userId, onLogout }: { userId: number; onLogout: () => void }) {
  const { homeApp } = useAccess();
  const items = useShellItems();
  const bar = items.slice(0, BAR_SLOTS);
  const more = items.slice(BAR_SLOTS);

  type Current = { app: AccessApp; open: OpenRequest } | { app: typeof MORE };
  const first: Current = bar[0]
    ? { app: bar[0].app, open: { route: bar[0].route, at: 0 } }
    : { app: homeApp, open: { route: PROFILE_ROUTE[homeApp], at: 0 } };
  const [current, setCurrent] = useState<Current>(first);
  // The screen the hosted area reports, to light the matching tab.
  const [shown, setShown] = useState<{ app: AccessApp; route: string } | null>(null);

  const openItem = useCallback((app: AccessApp, route: string) => {
    setShown({ app, route });
    setCurrent({ app, open: { route, at: Date.now() } });
  }, []);

  const activeKey = current.app === MORE
    ? MORE
    : bar.find(b => b.app === shown?.app && b.route === shown?.route)?.key ?? MORE;

  const tabs = [
    ...bar.map(b => ({ key: b.key, label: b.name, icon: moduleIcon(b.icon) })),
    { key: MORE, label: 'More', icon: 'menu' as const },
  ];
  const onTab = (key: string) => {
    if (key === MORE) { setCurrent({ app: MORE }); return; }
    const b = bar.find(x => x.key === key);
    if (b) openItem(b.app, b.route);
  };

  const hosted = (app: AccessApp, open: OpenRequest) => {
    const onRouteChange = (route: string) => setShown({ app, route });
    return (
      // Keyed by area, so moving between areas starts that area's screens fresh.
      <AppScope key={app} app={app}>
        {app === 'admin' && <AdminDashboard onLogout={onLogout} open={open} onRouteChange={onRouteChange} />}
        {app === 'trainer' && <TrainerApp userId={userId} onLogout={onLogout} open={open} onRouteChange={onRouteChange} />}
        {app === 'member' && <MemberApp userId={userId} onLogout={onLogout} open={open} onRouteChange={onRouteChange} />}
      </AppScope>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <View style={{ flex: 1 }}>
        {current.app === MORE ? (
          <MoreScreen
            items={more}
            onOpen={i => openItem(i.app, i.route)}
            onProfile={() => openItem(homeApp, PROFILE_ROUTE[homeApp])}
            onLogout={onLogout}
          />
        ) : hosted(current.app, current.open)}
      </View>
      <BottomTabBar tabs={tabs} active={activeKey} onChange={onTab} />
    </View>
  );
}
