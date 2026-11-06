// Pure route helpers (no screens), so the area routers and their tests can import them cheaply.
import { idSegment } from '../../navigation/paths';

export type SelfServiceMemberRoute =
  | { id: 'plans-browse' }
  | { id: 'join'; planId?: number; coupon?: string }
  | { id: 'my-membership' }
  | { id: 'membership-request'; requestId: number };

export const SELF_SERVICE_IDS = ['plans-browse', 'join', 'my-membership', 'membership-request'] as const;
export type SelfServiceRouteId = typeof SELF_SERVICE_IDS[number];

export const isSelfServiceRouteId = (s: string): s is SelfServiceRouteId => (SELF_SERVICE_IDS as readonly string[]).includes(s);

/** The route a path names, or null. */
export function selfServiceRouteFromPath([id, sub]: readonly string[]): SelfServiceMemberRoute | null {
  switch (id) {
    case 'plans-browse': return { id };
    case 'my-membership': return { id };
    case 'join': {
      const planId = idSegment(sub);
      return planId ? { id, planId } : { id };
    }
    case 'membership-request': {
      const requestId = idSegment(sub);
      return requestId ? { id, requestId } : null;
    }
    default: return null;
  }
}

export function selfServiceRouteToPath(r: SelfServiceMemberRoute): string[] {
  switch (r.id) {
    case 'join': return r.planId ? ['join', String(r.planId)] : ['join'];
    case 'membership-request': return ['membership-request', String(r.requestId)];
    default: return [r.id];
  }
}

/** Admin route key (ModuleCatalog `admin.membership-requests` → Route "membership-requests"). */
export const MEMBERSHIP_REQUESTS_ADMIN_ROUTE = 'membership-requests' as const;

