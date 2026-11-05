// Shared paths for the older admin features (auth, members, trainers, workouts…).
// Convention (ARCH-118): newer features keep a feature-local `EP` / `BASE` map in their *Api.ts
// (billing, classes, shop, social, access, member-billing…). Don't add new features here; when a
// feature here is next reworked, move its paths into its own api file. Create = POST to the
// collection path (there are no separate ADD_* constants).
export const ENDPOINTS = {
  // Auth
  LOGIN:           '/auth/login',
  LOGOUT:          '/auth/logout',
  ME:              '/auth/me',
  REFRESH_TOKEN:   '/auth/refresh-token',
  FORGOT_PASSWORD: '/auth/forgot-password',
  RESET_PASSWORD:  '/auth/reset-password',
  CHANGE_PASSWORD: '/auth/change-password',

  // Dashboard
  DASHBOARD_OVERVIEW: '/dashboard/overview',

  // Health
  HEALTH_TODAY: '/health/today',
  HEALTH_ADMIN_OVERVIEW: '/health/admin/overview',

  // Challenges
  CHALLENGES_ACTIVE: '/challenges/active',
  CHALLENGES: '/challenges',
  challengeStatus: (id: number) => `/challenges/${id}/status`,

  // Attendance
  ATTENDANCE:          '/attendance',
  ATTENDANCE_SETTINGS: '/attendance/settings',
  ATTENDANCE_ME:       '/attendance/me',
  ATTENDANCE_STATUS:   '/attendance/me/status',
  ATTENDANCE_CHECK_IN: '/attendance/check-in',
  ATTENDANCE_CHECK_OUT:'/attendance/check-out',
  branchGeofence: (branchId: number) => `/attendance/branches/${branchId}/geofence`,

  // AI Coach
  AI_COACH_SETTINGS: '/ai-coach/settings',

  // Roles & Permissions
  ROLES:           '/roles',

  // Tenants
  TENANTS:         '/tenants',

  // Branches
  BRANCHES:        '/branches',

  // Members
  MEMBERS:         '/members',

  // Trainers
  TRAINERS:        '/trainers',

  // Leads
  LEADS:           '/leads',
  LEAD_SOURCES:    '/leads/sources',

  // Exercises
  EXERCISES:       '/exercises',
  EXERCISE_MUSCLES:'/exercises/muscles',

  // Workouts
  WORKOUTS:        '/workouts',
  ASSIGN_WORKOUT:  '/workouts/assign',

  // Workout Plans
  PLANS:           '/plans',

  // Workout Automation
  AUTOMATION_RULES:  '/workout-automation/rules',
};
