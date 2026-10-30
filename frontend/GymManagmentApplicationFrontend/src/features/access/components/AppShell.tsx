import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, Text, View } from 'react-native';
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

/** Sub-screens report their own route; this maps them to the menu module they belong to. */
const OWNER_ROUTE: Record<AccessApp, Record<string, string>> = {
  admin: {},                                  // AdminDashboard already reports the owning module
  trainer: { client: 'clients' },
  member: { workout: 'train', plans: 'progress' },
};

/** Every module that isn't on the bar — searchable, grouped by area — then Profile and Sign out. */
function MoreScreen({ items, onOpen, onProfile, onLogout }: {
  items: Item[]; onOpen: (item: Item) => void; onProfile: () => void; onLogout: () => void;
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
        {row('sign-out', 'Sign out', 'log-out', onLogout, T.err)}
      </ScrollView>
    </Screen>
  );
}

const BAR_SLOTS = 4;
type Place = { app: AccessApp; route: string };

/**
 * The one app every role uses. Its bottom bar and More screen are built from the modules the
 * person is assigned — of any area — so everyone sees the same design with only their own modules.
 * Each module opens the existing screens of its area (admin, trainer or member), hosted here.
 *
 * Navigation rules: the tab of the module a screen belongs to stays lit; tapping the lit tab again
 * returns to that module's first screen; the Android back button steps back through the screens
 * visited, and leaves the app only from the first one.
 */
export default function AppShell({ userId, onLogout }: { userId: number; onLogout: () => void }) {
  const { homeApp } = useAccess();
  const items = useShellItems();
  const bar = items.slice(0, BAR_SLOTS);
  const more = items.slice(BAR_SLOTS);

  type Current = { app: AccessApp; open: OpenRequest } | { app: typeof MORE };
  const firstPlace: Place = bar[0] ? { app: bar[0].app, route: bar[0].route } : { app: homeApp, route: PROFILE_ROUTE[homeApp] };
  const [current, setCurrent] = useState<Current>({ app: firstPlace.app, open: { route: firstPlace.route, at: 0 } });
  // The screen the hosted area reports, to light the matching tab.
  const [shown, setShown] = useState<Place | null>(firstPlace);
  // Remounts the hosted area — a second tap on the lit tab starts the module fresh.
  const [resetCount, setResetCount] = useState(0);

  // Places visited, for the Android back button. MORE is recorded as its own place.
  const history = useRef<(Place | typeof MORE)[]>([firstPlace]);
  const goingBack = useRef(false);
  const push = (p: Place | typeof MORE) => {
    if (goingBack.current) { goingBack.current = false; return; }
    const top = history.current[history.current.length - 1];
    const same = top === p || (top !== MORE && p !== MORE && top.app === p.app && top.route === p.route);
    if (!same) history.current = [...history.current.slice(-30), p];
  };

  const openItem = useCallback((app: AccessApp, route: string) => {
    setShown({ app, route });
    setCurrent({ app, open: { route, at: Date.now() } });
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (history.current.length <= 1) return false;            // first screen: let the OS leave the app
      history.current = history.current.slice(0, -1);
      const prev = history.current[history.current.length - 1];
      goingBack.current = true;
      if (prev === MORE) { goingBack.current = false; setCurrent({ app: MORE }); }
      else openItem(prev.app, prev.route);
      return true;
    });
    return () => sub.remove();
  }, [openItem]);

  const ownerOf = (p: Place | null) => p && { app: p.app, route: OWNER_ROUTE[p.app][p.route] ?? p.route };
  const owner = ownerOf(shown);
  const activeKey = current.app === MORE
    ? MORE
    : bar.find(b => b.app === owner?.app && b.route === owner?.route)?.key ?? MORE;

  const tabs = [
    ...bar.map(b => ({ key: b.key, label: b.name, icon: moduleIcon(b.icon) })),
    { key: MORE, label: 'More', icon: 'menu' as const },
  ];
  const onTab = (key: string) => {
    if (key === MORE) { push(MORE); setCurrent({ app: MORE }); return; }
    const b = bar.find(x => x.key === key);
    if (!b) return;
    if (key === activeKey) setResetCount(n => n + 1);           // second tap: back to the module's start
    openItem(b.app, b.route);
  };

  const hosted = (app: AccessApp, open: OpenRequest) => {
    const onRouteChange = (route: string) => { setShown({ app, route }); push({ app, route }); };
    return (
      // Keyed by area (and resets), so moving between areas starts that area's screens fresh.
      <AppScope key={`${app}-${resetCount}`} app={app}>
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
