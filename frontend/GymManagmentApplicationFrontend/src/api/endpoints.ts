export const ENDPOINTS = {
  // Auth
  LOGIN:           '/auth/login',
  LOGOUT:          '/auth/logout',
  ME:              '/auth/me',

  // Dashboard
  DASHBOARD_OVERVIEW: '/dashboard/overview',

  // Health
  HEALTH_TODAY: '/health/today',
  HEALTH_ADMIN_OVERVIEW: '/health/admin/overview',

  // Challenges
  CHALLENGES_ACTIVE: '/challenges/active',
  CHALLENGES: '/challenges',
  challengeStatus: (id: number) => `/challenges/${id}/status`,

  // AI Coach
  AI_COACH_SETTINGS: '/ai-coach/settings',

  // Per-user feature modules (distinct from the role-based MODULE_ACCESS matrix above)
  USER_MODULES: '/modules',
  userModulesFor: (userId: number) => `/users/${userId}/modules`,

  // Roles & Permissions
  ROLES:           '/roles',
  PERMISSIONS:     '/permissions',

  // Tenants
  TENANTS:         '/tenants',
  ADD_TENANT:      '/tenants',

  // Branches
  BRANCHES:        '/branches',
  ADD_BRANCH:      '/branches',

  // Members
  MEMBERS:         '/members',
  ADD_MEMBER:      '/members',
  BULK_MEMBERS:    '/members/bulk',

  // Trainers
  TRAINERS:        '/trainers',
  ADD_TRAINER:     '/trainers',

  // Leads
  LEADS:           '/leads',
  ADD_LEAD:        '/leads',
  LEAD_SOURCES:    '/leads/sources',

  // Exercises
  EXERCISES:       '/exercises',
  ADD_EXERCISE:    '/exercises',
  EXERCISE_TAGS:   '/exercises/tags',
  EXERCISE_MUSCLES:'/exercises/muscles',

  // Workouts
  WORKOUTS:        '/workouts',
  ADD_WORKOUT:     '/workouts',
  ASSIGN_WORKOUT:  '/workouts/assign',

  // Workout Plans
  PLANS:           '/plans',
  ADD_PLAN:        '/plans',

  // Workout Automation
  AUTOMATION_RULES:  '/workout-automation/rules',
  AUTOMATION_LOGS:   '/workout-automation/logs',

  // Module Access
  MODULE_ACCESS:         '/module-access',
  MODULE_ACCESS_BULK:    '/module-access/bulk',
  MODULE_ACCESS_CHECK:   '/module-access/check',
  MODULE_ACCESS_MATRIX:  '/module-access/matrix',
  MODULE_ACCESS_MODULES: '/module-access/modules',
  MODULE_ACCESS_ROLE:    '/module-access/role',
};
