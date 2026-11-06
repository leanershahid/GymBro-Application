import { ShopOrderStatus } from '../api/shop.types';
import { idSegment } from '../../../navigation/paths';

/** Filters a tab can be opened with (e.g. the dashboard's "Manage inventory" → low stock only). */
export interface TabParams {
  lowStock?: boolean;
  status?: ShopOrderStatus;
}

/** Navigation inside the shop admin: detail screens stack over the tab chips. */
export interface ShopNav {
  openProduct: (id: number | null) => void;
  openOrder: (orderNumber: string) => void;
  openCustomer: (id: number) => void;
  goTab: (key: string, params?: TabParams) => void;
  /** Whether a tab is granted. */
  can: (key: string) => boolean;
}

/** A detail screen stacked over the admin shop's tabs. */
export type ShopAdminRoute =
  | { kind: 'product'; id: number | null }
  | { kind: 'order'; orderNumber: string }
  | { kind: 'customer'; id: number };

const ROUTE_KINDS: readonly string[] = ['product', 'order', 'customer'];

export function shopAdminRouteToPath(r: ShopAdminRoute): string[] {
  switch (r.kind) {
    case 'product': return ['product', r.id ? String(r.id) : 'new'];
    case 'order': return ['order', r.orderNumber];
    case 'customer': return ['customer', String(r.id)];
  }
}

function routeFromPath([kind, arg]: readonly string[]): ShopAdminRoute | null {
  const id = idSegment(arg);
  if (kind === 'product') return arg === 'new' ? { kind, id: null } : id ? { kind, id } : null;
  if (kind === 'order') return arg ? { kind, orderNumber: arg } : null;
  if (kind === 'customer') return id ? { kind, id } : null;
  return null;
}

/** The admin shop's path (after /admin/shop/ in the URL): tab when not the first, then the top detail screen. */
export function shopAdminPath(tab: string | null, firstTab: string | null, top: ShopAdminRoute | undefined): string[] {
  return [...(tab && tab !== firstTab ? [tab] : []), ...(top ? shopAdminRouteToPath(top) : [])];
}

export function parseShopAdminPath(path: readonly string[]): { tab: string | null; route: ShopAdminRoute | null } {
  const [first, ...rest] = path;
  if (first && !ROUTE_KINDS.includes(first)) return { tab: first, route: routeFromPath(rest) };
  return { tab: null, route: routeFromPath(path) };
}
