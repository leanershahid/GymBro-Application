import type { OpenRequest } from '../../access/types/access.types';
import { idSegment } from '../../../navigation/paths';

/** Every screen the admin area can show (ARCH-059: route table split out of AdminDashboard). */
export const ADMIN_SCREENS = [
  'home',
  'members', 'add-member', 'member-detail', 'edit-member',
  'trainers', 'add-trainer',
  'branches', 'add-branch', 'edit-branch',
  'tenants', 'add-tenant', 'edit-tenant',
  'leads', 'add-lead',
  'exercises', 'add-exercise',
  'workouts', 'add-workout',
  'plans', 'add-plan',
  'roles',
  'billing', 'new-invoice', 'new-membership',
  'classes', 'pt-sessions', 'booking-rules',
  'shop',
  'social',
  'module-access',
  'user-access',
  'challenges-admin',
  'stats-admin',
  'live-coaching-admin',
  'ai-coach-admin',
  'attendance',
  'attendance-log', 'attendance-settings',
  'waivers',
  'privacy-requests',
  'membership-requests',
  'support', 'support-request',
  'messages-review', 'messages-review-thread',
  'facilities', 'facility-asset', 'facility-reports', 'facility-report', 'incidents', 'incident', 'incident-new',
  'announcements', 'announcement-editor', 'service-status', 'branch-hours',
  'more-actions',
  'profile-details',
  'security',
] as const;

export type AdminScreen = typeof ADMIN_SCREENS[number];

/** Type guard for route keys from the server (module routes) or a URL (ARCH-114). */
export const isAdminScreen = (s: string): s is AdminScreen => (ADMIN_SCREENS as readonly string[]).includes(s);

/** Screens reached from inside another module's page — open only when that module is granted. */
export const OWNER_ROUTE: Partial<Record<AdminScreen, string>> = {
  'add-member': 'members', 'member-detail': 'members', 'edit-member': 'members', 'new-membership': 'members',
  'add-trainer': 'trainers',
  'add-branch': 'branches', 'edit-branch': 'branches',
  'add-tenant': 'tenants', 'edit-tenant': 'tenants',
  'add-lead': 'leads',
  'add-exercise': 'exercises',
  'add-workout': 'workouts',
  'add-plan': 'plans',
  'new-invoice': 'billing',
  'module-access': 'roles',
  'attendance-log': 'attendance', 'attendance-settings': 'attendance',
  'booking-rules': 'classes',
  'announcement-editor': 'announcements',
  'support-request': 'support',
  'messages-review-thread': 'messages-review',
  'facility-asset': 'facilities', 'facility-report': 'facility-reports', 'incident': 'incidents', 'incident-new': 'incidents',
};

/** Always open, whatever the access list says. */
export const ALWAYS_OPEN = new Set<AdminScreen>(['more-actions', 'profile-details', 'security']);

/** The menu module a screen belongs to (itself for top-level screens). */
export const ownerOf = (screen: AdminScreen) => OWNER_ROUTE[screen] ?? screen;

/** Screens about one record (`selectedId`): their URL carries the id, e.g. /admin/member-detail/12. */
const ID_SCREENS = new Set<AdminScreen>(['membership-requests', 'member-detail', 'edit-member', 'new-membership', 'edit-branch', 'edit-tenant', 'module-access',
  'announcement-editor', 'branch-hours', 'support-request', 'messages-review-thread',
  'facility-asset', 'facility-report', 'incident', 'incident-new']);
/** ...and the ones that make no sense without it (module-access then just opens on the first role). */
const NEEDS_ID = new Set<AdminScreen>(['member-detail', 'edit-member', 'new-membership', 'edit-branch', 'edit-tenant', 'support-request', 'messages-review-thread',
  'facility-asset', 'facility-report', 'incident']);

/** Where the admin area is: the screen, its record, and the shop's own path when in the shop. */
export interface AdminLocation {
  screen: AdminScreen;
  /** Record the current detail/edit screen is about (member, branch, tenant, role); 0 = none. */
  id: number;
  /** The shop's path (tab / product / order / customer) while screen is 'shop'. */
  sub: string[];
  /** Asks the shop to show `sub` (set when the shell opened a shop path). */
  subOpen?: OpenRequest;
}

/** The location a path names, or null for unknown / incomplete paths. URL: /admin/<path>. */
export function adminFromPath([screen, ...rest]: readonly string[]): AdminLocation | null {
  if (!screen || !isAdminScreen(screen)) return null;
  if (screen === 'shop') return { screen, id: 0, sub: [...rest] };
  const id = ID_SCREENS.has(screen) ? idSegment(rest[0]) ?? 0 : 0;
  if (NEEDS_ID.has(screen) && !id) return null;
  return { screen, id, sub: [] };
}

export function adminPath(l: AdminLocation): string[] {
  if (l.screen === 'shop') return ['shop', ...l.sub];
  return ID_SCREENS.has(l.screen) && l.id ? [l.screen, String(l.id)] : [l.screen];
}
