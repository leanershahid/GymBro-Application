import React, { useMemo } from 'react';
import { Feather } from '@expo/vector-icons';
import { moduleIcon, normalizeRoute, useMenu } from '../access/context/AccessContext';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

export interface AdminAction {
  label: string;
  icon: FeatherIconName;
  screen: string;
}

/** The main-menu screens that hold the tiles, rather than being tiles themselves. */
const CONTAINER_ROUTES = new Set(['home', 'module-hub', 'more-actions']);

/**
 * Tiles for the dashboard's Quick Access grid and the More page (bottom nav "More" tab): every
 * admin-app module the signed-in user is granted — main-menu pages first, then the More submenu —
 * in the order the module master sets. Nothing is listed here; granting a module adds its tile.
 */
export function useVisibleAdminActions(): AdminAction[] {
  const { rail, childrenOf } = useMenu();
  return useMemo(() => {
    const pages = rail.filter(m => !CONTAINER_ROUTES.has(normalizeRoute(m)));
    const submenus = rail.flatMap(m => childrenOf(m.key));
    return [...pages, ...submenus].map(m => ({ label: m.name, icon: moduleIcon(m.icon), screen: normalizeRoute(m) }));
  }, [rail, childrenOf]);
}
