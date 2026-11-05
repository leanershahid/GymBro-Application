// Shared React Query keys (ARCH-120). Convention:
//  - every feature owns a unique first element (its "root"), so invalidating one feature never
//    refetches another's cache by accident;
//  - list/detail keys extend the root (`[...root, 'detail', id]`), and invalidation uses the root
//    or a `*All` prefix from here — never an inline string literal;
//  - features with many keys (shop, social, billing, classes…) keep a local `K` factory in their
//    *Queries.ts, following the same rule.
export const queryKeys = {
  auth:       { me: ['auth-me'] as const },
  dashboard:  { overview: ['dashboard', 'overview'] as const },
  health:     {
    today:         (userId: number) => ['health-today', userId] as const,
    adminOverview: ['health-admin-overview'] as const,
  },
  challenges: {
    active:    (userId: number) => ['challenges-active', userId] as const,
    adminList: ['challenges-admin'] as const,
  },
  aiCoach:    { settings: ['ai-coach-settings'] as const },
  attendance: {
    settings: ['attendance-settings'] as const,
    myStatus: ['attendance-me-status'] as const,
    myHistoryAll: ['attendance-me'] as const,
    myHistory: (days: number) => ['attendance-me', days] as const,
    logAll:   ['attendance-log'] as const,
    log:      (date?: string, branchId?: number) => ['attendance-log', date, branchId] as const,
  },
  trainers:   { all: ['trainers']   as const },
  branches:   { all: ['branches']   as const },
  tenants:    { all: ['tenants']    as const },
  members:    { all: ['members']    as const },
  leads:      { all: ['leads']      as const },
  exercises:  { all: ['exercises']  as const },
  workouts:   { all: ['workouts']   as const },
  plans:      { all: ['plans']      as const },
  automation:    { all: ['automation']    as const },
  moduleAccess:  {
    byRole:   (tenantId: number, roleId: number) => ['module-access', tenantId, roleId] as const,
    matrix:   (tenantId: number)                 => ['module-access-matrix', tenantId]  as const,
    modules:  ()                                 => ['module-access-modules']            as const,
    roles:    ()                                 => ['roles']                            as const,
  },
  memberApp: {
    profile:    (id: number) => ['member-profile', id]   as const,
    timeline:   (id: number) => ['member-timeline', id]  as const,
    documents:  (id: number) => ['member-docs', id]      as const,
    workouts:   (id: number, p: number) => ['member-workouts', id, p] as const,
    workout:    (id: number) => ['workout-detail', id]   as const,
    exercises:  (p: number, tag?: string) => ['member-exercises', p, tag] as const, // not the admin ['exercises'] root
    plans:      (p: number) => ['member-plans', p]       as const,
  },
  trainerApp: {
    profile:      (id: number) => ['trainer-profile',   id] as const,
    schedule:     (id: number) => ['trainer-schedule',  id] as const,
    performance:  (id: number) => ['trainer-perf',      id] as const,
    earnings:     (id: number, m?: number, y?: number) => ['trainer-earnings', id, m, y] as const,
    clients:      (id: number) => ['trainer-clients',   id] as const,
    clientProf:   (id: number) => ['client-profile',    id] as const,
    clientTime:   (id: number) => ['client-timeline',   id] as const,
    clientNotes:  (id: number) => ['client-notes',      id] as const,
    clientDocs:   (id: number) => ['client-docs',       id] as const,
    planAnalytics:(id: number) => ['plan-analytics',    id] as const,
  },
};
