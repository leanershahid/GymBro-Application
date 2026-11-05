/** Every screen the admin area can show (ARCH-059: route table split out of AdminDashboard). */
export type AdminScreen =
  | 'home'
  | 'members' | 'add-member' | 'member-detail' | 'edit-member'
  | 'trainers' | 'add-trainer'
  | 'branches' | 'add-branch' | 'edit-branch'
  | 'tenants'  | 'add-tenant' | 'edit-tenant'
  | 'leads'    | 'add-lead'
  | 'exercises' | 'add-exercise'
  | 'workouts'  | 'add-workout'
  | 'plans'     | 'add-plan'
  | 'roles'
  | 'billing' | 'new-invoice' | 'new-membership'
  | 'classes' | 'pt-sessions'
  | 'shop'
  | 'social'
  | 'module-access'
  | 'user-access'
  | 'challenges-admin'
  | 'stats-admin'
  | 'live-coaching-admin'
  | 'ai-coach-admin'
  | 'attendance'
  | 'attendance-log' | 'attendance-settings'
  | 'more-actions'
  | 'profile-details';

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
};

/** Always open, whatever the access list says. */
export const ALWAYS_OPEN = new Set<AdminScreen>(['more-actions', 'profile-details']);

/** The menu module a screen belongs to (itself for top-level screens). */
export const ownerOf = (screen: AdminScreen) => OWNER_ROUTE[screen] ?? screen;
