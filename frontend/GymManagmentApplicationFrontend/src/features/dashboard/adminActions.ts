import React from 'react';
import { Feather } from '@expo/vector-icons';
import { getSession, isAdminRole, isSuperAdmin } from '../../api/session';
import { useMyModuleGrants } from '../module-access/hooks/useRoleModuleAccess';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

export interface AdminAction {
  label: string;
  icon: FeatherIconName;
  screen: string;
  /** Key in the role/module access matrix; staff/custom roles only see granted modules. */
  module?: string;
  /** Hidden from everyone but these roles (checked before the matrix). */
  onlyFor?: 'superadmin' | 'admin';
}

// Shared by AdminDashboard's Quick Access grid and MoreActionsPage (bottom nav "More" tab).
export const ADMIN_ACTIONS: AdminAction[] = [
  { label: 'Members',   icon: 'users',       screen: 'members',   module: 'members' },
  { label: 'Trainers',  icon: 'award',       screen: 'trainers',  module: 'trainers' },
  { label: 'Branches',  icon: 'map-pin',     screen: 'branches',  module: 'branches' },
  { label: 'Tenants',   icon: 'briefcase',   screen: 'tenants',   module: 'tenants' },
  { label: 'Leads',     icon: 'target',      screen: 'leads',     module: 'leads' },
  { label: 'Billing',   icon: 'credit-card', screen: 'billing',   module: 'billing' },
  { label: 'Classes',   icon: 'calendar',    screen: 'classes',   module: 'classes' },
  { label: 'PT',        icon: 'clock',       screen: 'pt-sessions', module: 'pt-sessions' },
  { label: 'Exercises', icon: 'zap',         screen: 'exercises', module: 'exercises' },
  { label: 'Workouts',  icon: 'activity',    screen: 'workouts',  module: 'workouts' },
  { label: 'Plans',     icon: 'book-open',   screen: 'plans',     module: 'plans' },
  { label: 'Roles',     icon: 'shield',      screen: 'roles',         module: 'roles' },
  { label: 'Access',    icon: 'lock',        screen: 'user-access',   module: 'access' },
  { label: 'Challenges',    icon: 'award',       screen: 'challenges-admin',    module: 'gamification' },
  { label: 'Stats',         icon: 'bar-chart-2', screen: 'stats-admin',         module: 'stats' },
  { label: 'Live Coaching', icon: 'video',       screen: 'live-coaching-admin', module: 'live-coaching' },
  { label: 'AI Coach',      icon: 'cpu',         screen: 'ai-coach-admin',      module: 'ai-insights' },
  { label: 'Attendance',    icon: 'map-pin',     screen: 'attendance',          module: 'attendance' },
];

/** Modules that always stay visible to the Admin/SuperAdmin role, regardless of the matrix —
 * these are the screens that configure module access itself, so hiding them from admins would
 * leave no way back in if the admin role's own row is ever restricted here by mistake. Staff/
 * custom roles still can't be delegated these (see ModuleAccessService._adminOnlyModules). */
const ADMIN_ALWAYS_VISIBLE = new Set(['roles', 'access']);

/**
 * Actions the signed-in user may open. Every tile is gated by the per-role Module Access matrix
 * via its `module` key — any role, including admin, defaults to seeing everything a module with
 * no explicit matrix row grants (their access is a privilege dialed down by exception, not
 * granted from zero), but once a role's row restricts a module, it's respected. The exception is
 * Roles/Access, which always stay visible to admin/superadmin (see ADMIN_ALWAYS_VISIBLE above).
 */
export function useVisibleAdminActions(): AdminAction[] {
  const role = getSession()?.role;
  const admin = isAdminRole(role);
  const { data: grants = [] } = useMyModuleGrants();

  const viewable = new Set(grants.filter(g => g.canView).map(g => g.module));
  return ADMIN_ACTIONS.filter(a => {
    if (a.onlyFor === 'superadmin') return isSuperAdmin(role);
    if (a.onlyFor === 'admin') return admin;
    if (admin && a.module && ADMIN_ALWAYS_VISIBLE.has(a.module)) return true;
    return a.module ? viewable.has(a.module) : false;
  });
}
