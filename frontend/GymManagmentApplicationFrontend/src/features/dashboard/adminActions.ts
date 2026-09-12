import React from 'react';
import { Feather } from '@expo/vector-icons';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

export interface AdminAction {
  label: string;
  icon: FeatherIconName;
  screen: string;
}

// Shared by AdminDashboard's Quick Access grid and MoreActionsPage (bottom nav "More" tab).
export const ADMIN_ACTIONS: AdminAction[] = [
  { label: 'Members',   icon: 'users',       screen: 'members' },
  { label: 'Trainers',  icon: 'award',       screen: 'trainers' },
  { label: 'Branches',  icon: 'map-pin',     screen: 'branches' },
  { label: 'Tenants',   icon: 'briefcase',   screen: 'tenants' },
  { label: 'Leads',     icon: 'target',      screen: 'leads' },
  { label: 'Exercises', icon: 'zap',         screen: 'exercises' },
  { label: 'Workouts',  icon: 'activity',    screen: 'workouts' },
  { label: 'Plans',     icon: 'book-open',   screen: 'plans' },
  { label: 'Roles',     icon: 'shield',      screen: 'module-access' },
  { label: 'Access',    icon: 'lock',        screen: 'user-access' },
  { label: 'Challenges',    icon: 'award',       screen: 'challenges-admin' },
  { label: 'Stats',         icon: 'bar-chart-2', screen: 'stats-admin' },
  { label: 'Live Coaching', icon: 'video',       screen: 'live-coaching-admin' },
  { label: 'AI Coach',      icon: 'cpu',         screen: 'ai-coach-admin' },
];
