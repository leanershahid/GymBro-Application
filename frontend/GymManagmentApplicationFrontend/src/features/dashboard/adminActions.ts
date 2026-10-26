import React from 'react';
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import axiosInstance from '../../api/axios';
import { ApiResponse } from '../../api/types';
import { getSession, isAdminRole, isSuperAdmin } from '../../api/session';

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
  { label: 'Tenants',   icon: 'briefcase',   screen: 'tenants',   onlyFor: 'admin' },
  { label: 'Leads',     icon: 'target',      screen: 'leads',     module: 'leads' },
  { label: 'Exercises', icon: 'zap',         screen: 'exercises', module: 'exercises' },
  { label: 'Workouts',  icon: 'activity',    screen: 'workouts',  module: 'workouts' },
  { label: 'Plans',     icon: 'book-open',   screen: 'plans',     module: 'plans' },
  { label: 'Roles',     icon: 'shield',      screen: 'module-access', onlyFor: 'admin' },
  { label: 'Access',    icon: 'lock',        screen: 'user-access',   onlyFor: 'admin' },
  { label: 'Challenges',    icon: 'award',       screen: 'challenges-admin',    module: 'gamification' },
  { label: 'Stats',         icon: 'bar-chart-2', screen: 'stats-admin',         onlyFor: 'admin' },
  { label: 'Live Coaching', icon: 'video',       screen: 'live-coaching-admin', onlyFor: 'admin' },
  { label: 'AI Coach',      icon: 'cpu',         screen: 'ai-coach-admin',      module: 'ai-insights' },
];

interface ModuleGrant { module: string; canView: boolean; }

/**
 * Actions the signed-in user may open. Admins see everything (Tenants management of other
 * gyms is still super-admin-only on the server); staff and custom roles see only the
 * modules their role was granted "view" on. The server enforces the same rules.
 */
export function useVisibleAdminActions(): AdminAction[] {
  const role = getSession()?.role;
  const admin = isAdminRole(role);

  const { data: grants = [] } = useQuery({
    queryKey: ['module-access', 'me'],
    queryFn: async () => (await axiosInstance.get<ApiResponse<ModuleGrant[]>>('/module-access/me')).data,
    select: r => r.data ?? [],
    enabled: !admin && !!role,
  });

  if (admin) return ADMIN_ACTIONS.filter(a => a.onlyFor !== 'superadmin' || isSuperAdmin(role));
  const viewable = new Set(grants.filter(g => g.canView).map(g => g.module));
  return ADMIN_ACTIONS.filter(a => !a.onlyFor && a.module && viewable.has(a.module));
}
