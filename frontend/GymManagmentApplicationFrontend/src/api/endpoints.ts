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

};
