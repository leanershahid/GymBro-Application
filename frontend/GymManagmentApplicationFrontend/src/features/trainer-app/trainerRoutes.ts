import { idSegment } from '../../navigation/paths';
import { MessagingRoute, isMessagingRouteId, messagingRouteFromPath, messagingRouteToPath } from '../messaging/routePaths';

/** Trainer screens without parameters (each is also a module route the access list can grant). */
const SIMPLE = ['home', 'clients', 'builder', 'profile', 'classes', 'sessions', 'security',
  // Always open: help requests assigned to this trainer (Help & feedback).
  'support',
  // Always open: report broken / unsafe equipment (Facilities).
  'report-problem'] as const;
type SimpleId = typeof SIMPLE[number];

/** Every screen the trainer area can show (ARCH-114: typed, no `as any`). */
export type TrainerRoute =
  | { id: SimpleId }
  | { id: 'client'; clientId: number }
  | { id: 'support-request'; requestId: number }
  /** Always open: messages with my clients (inbox, one thread). */
  | MessagingRoute;

const isSimple = (s: string): s is SimpleId => (SIMPLE as readonly string[]).includes(s);

/** The route a path names, or null for unknown / incomplete paths. URL: /trainer/<path>. */
export function trainerRouteFromPath([id, ...rest]: readonly string[]): TrainerRoute | null {
  if (!id) return null;
  if (id === 'client') {
    const clientId = idSegment(rest[0]);
    return clientId ? { id, clientId } : null;
  }
  if (isMessagingRouteId(id)) return messagingRouteFromPath([id, ...rest]);
  if (id === 'support-request') {
    const requestId = idSegment(rest[0]);
    return requestId ? { id, requestId } : null;
  }
  return isSimple(id) ? { id } : null;
}

export function trainerRouteToPath(r: TrainerRoute): string[] {
  if (r.id === 'messages' || r.id === 'message-thread') return messagingRouteToPath(r);
  return r.id === 'client' ? ['client', String(r.clientId)] : r.id === 'support-request' ? ['support-request', String(r.requestId)] : [r.id];
}

/** The menu module whose tab stays lit for a route. */
export const trainerModuleOf = (r: TrainerRoute) => (r.id === 'client' ? 'clients' : r.id === 'security' ? 'profile' : r.id === 'support' || r.id === 'support-request' || r.id === 'report-problem' || isMessagingRouteId(r.id) ? 'home' : r.id);
