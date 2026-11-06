// Pure route helpers (no screens), so the area routers and their tests can import them cheaply.
import { idSegment } from '../../navigation/paths';

/** Member area: Help & feedback (always open, no module). */
export type SupportMemberRoute =
  | { id: 'help' }
  | { id: 'help-new'; category?: string }
  | { id: 'help-request'; requestId: number };

export const SUPPORT_MEMBER_IDS = ['help', 'help-new', 'help-request'] as const;
export type SupportMemberRouteId = typeof SUPPORT_MEMBER_IDS[number];
export const isSupportRouteId = (s: string): s is SupportMemberRouteId => (SUPPORT_MEMBER_IDS as readonly string[]).includes(s);

export function supportRouteFromPath([id, sub]: readonly string[]): SupportMemberRoute | null {
  switch (id) {
    case 'help': return { id };
    case 'help-new': return { id };
    case 'help-request': {
      const requestId = idSegment(sub);
      return requestId ? { id, requestId } : null;
    }
    default: return null;
  }
}

export function supportRouteToPath(r: SupportMemberRoute): string[] {
  return r.id === 'help-request' ? ['help-request', String(r.requestId)] : [r.id];
}

/** Admin route keys (ModuleCatalog `admin.support` → Route "support"; the detail is owned by it). */
export const SUPPORT_ADMIN_ROUTE = 'support' as const;
export const SUPPORT_REQUEST_ADMIN_ROUTE = 'support-request' as const;

/** Trainer area: requests assigned to the trainer (always open; the list is empty when nothing is assigned). */
export type SupportTrainerRoute =
  | { id: 'support' }
  | { id: 'support-request'; requestId: number };
