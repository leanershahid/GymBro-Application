import { createContext, useContext } from 'react';

/** Screens pushed over the tabs (Shop · Cart · Wishlist · Orders). */
export type ShopRoute =
  | { id: 'listing'; category?: string; search?: string; featured?: boolean; isNew?: boolean; title?: string }
  | { id: 'product'; slug: string }
  | { id: 'checkout' }
  | { id: 'confirmed'; orderNumber: string }
  | { id: 'order'; orderNumber: string }
  | { id: 'addresses' };

export interface ShopNav {
  push: (r: ShopRoute) => void;
  /** Replaces the top screen (e.g. checkout → confirmation). */
  replace: (r: ShopRoute) => void;
  pop: () => void;
  /** Closes every pushed screen and shows a tab. */
  home: (tab?: string) => void;
  setTab: (tab: string) => void;
}

export const ShopNavContext = createContext<ShopNav | null>(null);

export function useShopNav(): ShopNav {
  const nav = useContext(ShopNavContext);
  if (!nav) throw new Error('useShopNav must be used inside ShopStoreApp');
  return nav;
}

const ROUTE_IDS: readonly string[] = ['listing', 'product', 'checkout', 'confirmed', 'order', 'addresses'];

/** A pushed screen's path, e.g. ['product', 'whey-protein'] — after /member/shop/ in the URL. */
export function shopRouteToPath(r: ShopRoute): string[] {
  switch (r.id) {
    case 'listing': return [
      'listing',
      ...(r.category ? ['category', r.category] : []),
      ...(r.search ? ['search', r.search] : []),
      ...(r.featured ? ['featured'] : []),
      ...(r.isNew ? ['new'] : []),
    ];
    case 'product': return ['product', r.slug];
    case 'confirmed': return ['confirmed', r.orderNumber];
    case 'order': return ['order', r.orderNumber];
    default: return [r.id];
  }
}

function shopRouteFromPath([id, ...rest]: readonly string[]): ShopRoute | null {
  switch (id) {
    case 'listing': {
      const after = (k: string) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
      return { id, category: after('category'), search: after('search'), featured: rest.includes('featured') || undefined, isNew: rest.includes('new') || undefined };
    }
    case 'product': return rest[0] ? { id, slug: rest[0] } : null;
    case 'confirmed':
    case 'order': return rest[0] ? { id, orderNumber: rest[0] } : null;
    case 'checkout':
    case 'addresses': return { id };
    default: return null;
  }
}

/** The shop's path: the tab (when not the first) then the top pushed screen. */
export function shopPath(tab: string | null, firstTab: string | null, top: ShopRoute | undefined): string[] {
  return [...(tab && tab !== firstTab ? [tab] : []), ...(top ? shopRouteToPath(top) : [])];
}

export function parseShopPath(path: readonly string[]): { tab: string | null; route: ShopRoute | null } {
  const [first, ...rest] = path;
  if (first && !ROUTE_IDS.includes(first)) return { tab: first, route: shopRouteFromPath(rest) };
  return { tab: null, route: shopRouteFromPath(path) };
}
