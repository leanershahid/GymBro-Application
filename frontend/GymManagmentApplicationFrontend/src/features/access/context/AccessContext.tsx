import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { T } from '../../../theme';
import LoadingState from '../../common/components/LoadingState';
import Screen from '../../common/components/Screen';
import EmptyState from '../../dashboard/components/EmptyState';
import { fetchMyAccess } from '../api/accessApi';
import { loadStoredAccess, storeAccess } from '../api/accessStore';
import { AccessApp, AccessList, AccessModule } from '../types/access.types';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

// ── Routes ────────────────────────────────────────────────────────────────

// Safety nets for a row whose route is missing in the database: by name, then by key.
const ROUTE_BY_NAME: Record<string, string> = {
  dashboard: 'home', today: 'home', home: 'home', profile: 'profile', more: 'more-actions',
};

/** The screen key a module opens: the database route, else the name map, else the key's last part, else ''. */
export function normalizeRoute(m: Pick<AccessModule, 'route' | 'name' | 'key'>): string {
  return m.route?.trim()
    || ROUTE_BY_NAME[m.name.trim().toLowerCase()]
    || m.key.split('.').pop()
    || '';
}

/** A Feather icon name from the server, or a neutral one when the name isn't a Feather glyph. */
export function moduleIcon(icon: string | null | undefined, fallback: FeatherIconName = 'grid'): FeatherIconName {
  return icon && icon in Feather.glyphMap ? (icon as FeatherIconName) : fallback;
}

const byOrder = (a: AccessModule, b: AccessModule) => a.sortOrder - b.sortOrder;

// ── Provider ──────────────────────────────────────────────────────────────

interface AccessContextValue {
  /** Granted modules and tabs of the app currently open. */
  modules: AccessModule[];
  tabs: AccessModule[];
  /** The app currently open, and every app the person holds modules in (theirs first). */
  app: AccessApp;
  apps: AccessApp[];
  /** Opens another app the person holds modules in. */
  switchApp: (app: AccessApp) => void;
  /** Fetches the list again — after an admin changed this user's access, for example. */
  refresh: () => Promise<void>;
  isRefreshing: boolean;
}

const AccessContext = createContext<AccessContextValue | null>(null);

const accessKey = (userId: number) => ['access', 'me', userId] as const;

interface ProviderProps {
  userId: number;
  /** The app being shown; the list may hold modules of other apps too. */
  app: AccessApp;
  /** The app the person's main role signs in to — always offered. */
  homeApp: AccessApp;
  onSwitchApp: (app: AccessApp) => void;
  /** Offered on the error screen, so a user is never stuck with nothing to tap. */
  onLogout: () => void;
  children: React.ReactNode;
}

/**
 * Loads the signed-in user's access list once (GET /access/me + /access/me/tabs) and gives it to
 * every menu, tab and screen below. The last list is restored from storage first, so the app opens
 * at once and still works if the network is slow; it is fetched again every minute and whenever
 * the app comes back to the foreground. Hiding things here is for usability only — the API checks
 * every request itself.
 */
export function AccessProvider({ userId, app, homeApp, onSwitchApp, onLogout, children }: ProviderProps) {
  const qc = useQueryClient();
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    let alive = true;
    loadStoredAccess(userId).then(stored => {
      if (!alive) return;
      // updatedAt 0 marks it stale, so the real fetch still runs.
      if (stored && !qc.getQueryData(accessKey(userId))) qc.setQueryData(accessKey(userId), stored, { updatedAt: 0 });
      setRestored(true);
    });
    return () => { alive = false; };
  }, [qc, userId]);

  const query = useQuery({
    queryKey: accessKey(userId),
    queryFn: async () => {
      const list = await fetchMyAccess();
      storeAccess(userId, list);
      return list;
    },
    enabled: restored,
    // An admin's change to this user's access shows up within a minute, without signing out.
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') qc.invalidateQueries({ queryKey: accessKey(userId) });
    });
    return () => sub.remove();
  }, [qc, userId]);

  const { refetch } = query;
  const refresh = useCallback(async () => { await refetch(); }, [refetch]);

  const data: AccessList | undefined = query.data;
  const value = useMemo<AccessContextValue>(() => {
    const all = data?.modules ?? [];
    const others = (['admin', 'trainer', 'member'] as AccessApp[]).filter(a => a !== homeApp && all.some(m => m.app === a));
    return {
      // A list saved before modules carried their app has none — treat those rows as the home app's.
      modules: all.filter(m => (m.app ?? homeApp) === app),
      tabs: (data?.tabs ?? []).filter(t => (t.app ?? homeApp) === app),
      app,
      apps: [homeApp, ...others],
      switchApp: onSwitchApp,
      refresh,
      isRefreshing: query.isFetching,
    };
  }, [data, app, homeApp, onSwitchApp, refresh, query.isFetching]);

  if (!data) {
    if (query.isError) {
      return (
        <Screen style={{ justifyContent: 'center', padding: 24, gap: 16 }}>
          <EmptyState
            icon="wifi-off" tone="error" title="Couldn't load your menu"
            subtitle="Check your connection and try again."
            action={{ label: 'Retry', onPress: () => query.refetch() }}
          />
          <Pressable
            onPress={onLogout} hitSlop={12} accessibilityRole="button" accessibilityLabel="Sign out"
            style={{ minHeight: 44, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 12 }}
          >
            <Text style={{ color: T.brand, fontWeight: '600' }}>Sign out</Text>
          </Pressable>
        </Screen>
      );
    }
    return <LoadingState fullScreen label="Loading your menu" />;
  }

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

// ── Hooks ─────────────────────────────────────────────────────────────────

const EMPTY: AccessContextValue = {
  modules: [], tabs: [], app: 'admin', apps: [], switchApp: () => {}, refresh: async () => {}, isRefreshing: false,
};

export function useAccess(): AccessContextValue {
  return useContext(AccessContext) ?? EMPTY;
}

/** Whether a module (by key, e.g. "member.book") is granted. */
export function useHasModule(key: string): boolean {
  const { modules, tabs } = useAccess();
  return modules.some(m => m.key === key) || tabs.some(t => t.key === key);
}

/**
 * Flags for an API permission key ("workouts", "billing", …), merged across every granted module
 * and tab that unlocks it. Fails closed: nothing granted means everything false.
 */
export function useApiAccess(apiModule: string) {
  const { modules, tabs } = useAccess();
  return useMemo(() => {
    const rows = [...modules, ...tabs].filter(m => m.apiModules.includes(apiModule));
    return {
      canView:   rows.length > 0,
      canCreate: rows.some(r => r.canCreate),
      canEdit:   rows.some(r => r.canEdit),
      canDelete: rows.some(r => r.canDelete),
      canExport: rows.some(r => r.canExport),
    };
  }, [modules, tabs, apiModule]);
}

/** The granted tabs of a page, in order. */
export function useTabs(parentKey: string): AccessModule[] {
  const { tabs } = useAccess();
  return useMemo(() => tabs.filter(t => t.parentKey === parentKey).sort(byOrder), [tabs, parentKey]);
}

/**
 * A page's tab switcher from its granted tabs: `items` for SegmentedTabs, the selected `tab`
 * (the first granted one until the user picks another) and `has(key)` for gating content.
 */
export function usePageTabs(parentKey: string) {
  const granted = useTabs(parentKey);
  const items = useMemo(() => granted.map(t => ({ key: normalizeRoute(t), label: t.name })), [granted]);
  const [picked, setPicked] = useState<string | null>(null);
  const tab = picked && items.some(i => i.key === picked) ? picked : items[0]?.key ?? null;
  return { items, tab, setTab: setPicked, has: (key: string) => items.some(i => i.key === key) };
}

/**
 * The menus of the current app: `rail` is the level-1 modules (the bottom tab bar), `childrenOf`
 * a module's visible submenu, and `routes` every screen key the user may open.
 */
export function useMenu() {
  const { modules } = useAccess();
  return useMemo(() => {
    const visible = modules.filter(m => !m.hideFromMenu);
    return {
      rail: visible.filter(m => m.level === 1).sort(byOrder),
      childrenOf: (key: string) => visible.filter(m => m.parentKey === key).sort(byOrder),
      routes: new Set(modules.map(normalizeRoute).filter(Boolean)),
      byRoute: (route: string) => modules.find(m => normalizeRoute(m) === route),
    };
  }, [modules]);
}

/**
 * The screen to open first: `preferred` (the dashboard / home) when it is granted, otherwise the
 * first main-menu module, otherwise `fallback` (an always-on screen such as profile).
 */
export function useLanding(preferred: string, fallback: string): string {
  const { rail, routes } = useMenu();
  if (routes.has(preferred)) return preferred;
  return rail.length ? normalizeRoute(rail[0]) : fallback;
}
