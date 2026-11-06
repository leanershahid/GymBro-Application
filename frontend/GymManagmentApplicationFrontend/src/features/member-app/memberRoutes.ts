import type { OpenRequest } from '../access/types/access.types';
import { idSegment } from '../../navigation/paths';
import { SafetyMemberRoute, safetyRouteFromPath, safetyRouteToPath } from '../safety/routes';
import { SelfServiceMemberRoute, isSelfServiceRouteId, selfServiceRouteFromPath, selfServiceRouteToPath } from '../self-service/routePaths';
import { SupportMemberRoute, isSupportRouteId, supportRouteFromPath, supportRouteToPath } from '../support/routePaths';
import { FacilitiesMemberRoute, isFacilitiesRouteId, facilitiesRouteFromPath, facilitiesRouteToPath } from '../facilities/routePaths';
import { MessagingRoute, isMessagingRouteId, messagingRouteFromPath, messagingRouteToPath } from '../messaging/routePaths';

/** Member screens without parameters (each is also a module route the access list can grant). */
const SIMPLE = ['home', 'community', 'stats', 'progress', 'profile', 'train', 'billing', 'book', 'social',
  // Always open (no module): alerts list, notification settings, two-step sign-in.
  'notifications', 'notification-settings', 'security',
  // Always open: Privacy & data (consents, download my data, delete my account).
  'privacy'] as const;
type SimpleId = typeof SIMPLE[number];

/** Every screen the member area can show (ARCH-114: typed, no `as any`). */
export type MemberRoute =
  | { id: SimpleId }
  | { id: 'plans'; planId?: number }
  /** `sub` is the shop's own path (tab / product / order); `open` asks the shop to show it. */
  | { id: 'shop'; sub?: string[]; open?: OpenRequest }
  // `from` is the screen Back returns to (defaults to Train, or the landing screen without it)
  | { id: 'workout'; workoutId: number; from?: MemberRoute }
  /** Waiver · health check · emergency contact (always open: it gates booking). */
  | SafetyMemberRoute
  /** Announcements feed / one announcement, and the gym's hours, status and amenities page. */
  | { id: 'announcements' }
  | { id: 'announcement'; announcementId: number }
  | { id: 'branch-info'; branchId?: number }
  /** Self-service (billing module): plan browser, join & pay, my membership, one pause/cancel/change request. */
  | SelfServiceMemberRoute
  /** Help & feedback (always open): FAQ + my requests, new request, one request's thread. */
  | SupportMemberRoute
  /** Facilities (always open): report a problem, my reports, one report. */
  | FacilitiesMemberRoute
  /** Messages (always open): inbox with my coaches, one thread. */
  | MessagingRoute;

export type MemberScreenId = MemberRoute['id'];

const isSimple = (s: string): s is SimpleId => (SIMPLE as readonly string[]).includes(s);

/** The route a path names, or null for unknown / incomplete paths. URL: /member/<path>. */
export function memberRouteFromPath([id, ...rest]: readonly string[]): MemberRoute | null {
  if (!id) return null;
  if (id === 'workout') {
    const workoutId = idSegment(rest[0]);
    return workoutId ? { id, workoutId } : null;
  }
  if (id === 'plans') {
    const planId = idSegment(rest[0]);
    return planId ? { id, planId } : { id };
  }
  if (id === 'shop') return { id, sub: [...rest] };
  if (id === 'safety') return safetyRouteFromPath([id, ...rest]);
  if (isSelfServiceRouteId(id)) return selfServiceRouteFromPath([id, ...rest]);
  if (isSupportRouteId(id)) return supportRouteFromPath([id, ...rest]);
  if (isFacilitiesRouteId(id)) return facilitiesRouteFromPath([id, ...rest]);
  if (isMessagingRouteId(id)) return messagingRouteFromPath([id, ...rest]);
  if (id === 'announcements') {
    const announcementId = idSegment(rest[0]);
    return announcementId ? { id: 'announcement', announcementId } : { id };
  }
  if (id === 'branch-info') {
    const branchId = idSegment(rest[0]);
    return branchId ? { id, branchId } : { id };
  }
  return isSimple(id) ? { id } : null;
}

export function memberRouteToPath(r: MemberRoute): string[] {
  switch (r.id) {
    case 'workout': return ['workout', String(r.workoutId)];
    case 'plans': return r.planId ? ['plans', String(r.planId)] : ['plans'];
    case 'shop': return ['shop', ...(r.sub ?? [])];
    case 'safety': return safetyRouteToPath(r);
    case 'plans-browse': case 'join': case 'my-membership': case 'membership-request': return selfServiceRouteToPath(r);
    case 'help': case 'help-new': case 'help-request': return supportRouteToPath(r);
    case 'report-problem': case 'my-reports': case 'my-report': return facilitiesRouteToPath(r);
    case 'messages': case 'message-thread': return messagingRouteToPath(r);
    case 'announcements': return ['announcements'];
    case 'announcement': return ['announcements', String(r.announcementId)];
    case 'branch-info': return r.branchId ? ['branch-info', String(r.branchId)] : ['branch-info'];
    default: return [r.id];
  }
}

/** The menu module whose tab stays lit for a route. */
export function memberModuleOf(r: MemberRoute): string {
  return r.id === 'workout' ? 'train' : r.id === 'plans' ? 'progress' : r.id === 'safety' || r.id === 'notifications' || r.id === 'announcements' || r.id === 'announcement' || r.id === 'branch-info' || isMessagingRouteId(r.id) ? 'home'
    : r.id === 'notification-settings' || r.id === 'security' || r.id === 'privacy' || isSupportRouteId(r.id) || isFacilitiesRouteId(r.id) ? 'profile'
    : r.id === 'plans-browse' || r.id === 'join' || r.id === 'my-membership' || r.id === 'membership-request' ? 'billing' : r.id;
}
