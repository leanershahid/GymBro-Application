/**
 * Design preview mode — DEVELOPMENT WEB BUILDS ONLY.
 *
 * Open http://localhost:8084/?preview=admin | trainer | member to see that app's screens
 * filled with realistic sample data, without a backend or an account. Every API call is
 * answered locally by a mock axios adapter; nothing leaves the browser.
 *
 * Never active in production: guarded by __DEV__ and by Platform.OS === 'web'.
 */
import { Platform } from 'react-native';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import axiosInstance from '../api/axios';
import { getSession, setSession } from '../api/session';

export type PreviewRole = 'admin' | 'superadmin' | 'trainer' | 'member';

export function getPreviewRole(): PreviewRole | null {
  if (!__DEV__ || Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const role = new URLSearchParams(window.location.search).get('preview');
  return role === 'admin' || role === 'superadmin' || role === 'trainer' || role === 'member' ? role : null;
}

const ok = <T,>(data: T) => ({ success: true, message: 'OK', data, errors: null });
const page = <T,>(items: T[]) => ok({ items, pageNumber: 1, pageSize: 20, totalRecords: items.length, totalPages: 1 });
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

const MEMBERS = [
  ['Aarav Mehta', 'Downtown', 0], ['Sara Khan', 'Westside', 1], ['Rohan Das', 'Downtown', 1],
  ['Meera Nair', 'Harbour', 2], ['Kabir Shah', 'Westside', 3], ['Ananya Iyer', 'Harbour', 4],
] as const;

const WORKOUTS = [
  { id: 1, name: 'Upper Body Power', goal: 'MuscleGain', difficulty: 'Intermediate', durationMin: 45 },
  { id: 2, name: 'HIIT Fat Burner', goal: 'WeightLoss', difficulty: 'Advanced', durationMin: 30 },
  { id: 3, name: 'Mobility Flow', goal: 'General', difficulty: 'Beginner', durationMin: 25 },
  { id: 4, name: 'Leg Day Builder', goal: 'MuscleGain', difficulty: 'Intermediate', durationMin: 50 },
].map(w => ({
  ...w, description: 'Coach-built session with progressive overload.',
  exercises: [
    { exerciseId: 1, name: 'Barbell Squat', sets: 4, reps: 8, restSec: 90 },
    { exerciseId: 2, name: 'Bench Press', sets: 4, reps: 10, restSec: 90 },
    { exerciseId: 3, name: 'Pull-ups', sets: 3, reps: 12, restSec: 60 },
  ],
}));

// Mirror of the backend's ModuleCatalog (Application/Access/ModuleCatalog.cs), for previews only:
// [key, app, parentKey, name, route, icon, apiModules, sortOrder, 'tab' | 'hidden' | 'adminOnly' | '']
type Row = [string, 'admin' | 'trainer' | 'member', string | null, string, string | null, string, string, number, string];
const CATALOG: Row[] = [
  ['admin.home', 'admin', null, 'Dashboard', 'home', 'home', 'analytics,reports', 1, ''],
  ['admin.members', 'admin', null, 'Members', 'members', 'users', 'members,onboarding', 2, ''],
  ['admin.hub', 'admin', null, 'Hub', 'module-hub', 'grid', '', 3, ''],
  ['admin.workouts', 'admin', null, 'Activity', 'workouts', 'activity', 'workouts', 4, ''],
  ['admin.more', 'admin', null, 'More', 'more-actions', 'menu', '', 5, ''],
  ['admin.trainers', 'admin', 'admin.more', 'Trainers', 'trainers', 'award', 'trainers', 1, ''],
  ['admin.branches', 'admin', 'admin.more', 'Branches', 'branches', 'map-pin', 'branches', 2, ''],
  ['admin.tenants', 'admin', 'admin.more', 'Tenants', 'tenants', 'briefcase', 'tenants', 3, 'adminOnly'],
  ['admin.leads', 'admin', 'admin.more', 'Leads', 'leads', 'target', 'leads', 4, ''],
  ['admin.billing', 'admin', 'admin.more', 'Billing', 'billing', 'credit-card', 'billing,invoices,payments,subscriptions,corporate', 5, ''],
  ['admin.classes', 'admin', 'admin.more', 'Classes', 'classes', 'calendar', 'classes', 6, ''],
  ['admin.pt-sessions', 'admin', 'admin.more', 'PT', 'pt-sessions', 'clock', 'pt-sessions', 7, ''],
  ['admin.exercises', 'admin', 'admin.more', 'Exercises', 'exercises', 'zap', 'exercises', 8, ''],
  ['admin.plans', 'admin', 'admin.more', 'Plans', 'plans', 'book-open', 'plans,workout-automation', 9, ''],
  ['admin.challenges', 'admin', 'admin.more', 'Challenges', 'challenges-admin', 'award', 'challenges,gamification', 10, ''],
  ['admin.stats', 'admin', 'admin.more', 'Stats', 'stats-admin', 'bar-chart-2', 'stats', 11, ''],
  ['admin.live-coaching', 'admin', 'admin.more', 'Live Coaching', 'live-coaching-admin', 'video', 'live-coaching', 12, ''],
  ['admin.ai-coach', 'admin', 'admin.more', 'AI Coach', 'ai-coach-admin', 'cpu', 'ai-insights', 13, ''],
  ['admin.attendance', 'admin', 'admin.more', 'Attendance', 'attendance', 'map-pin', 'attendance', 14, ''],
  ['admin.roles', 'admin', 'admin.more', 'Roles', 'roles', 'shield', 'roles', 15, 'adminOnly'],
  ['admin.user-access', 'admin', 'admin.more', 'Access', 'user-access', 'lock', 'access', 16, 'adminOnly'],
  ['trainer.home', 'trainer', null, 'Today', 'home', 'home', '', 1, ''],
  ['trainer.clients', 'trainer', null, 'Clients', 'clients', 'users', 'members', 2, ''],
  ['trainer.sessions', 'trainer', null, 'PT', 'sessions', 'clock', 'pt-sessions', 3, ''],
  ['trainer.classes', 'trainer', null, 'Classes', 'classes', 'calendar', 'classes', 4, ''],
  ['trainer.programs', 'trainer', null, 'Programs', 'builder', 'activity', '', 5, ''],
  ['trainer.profile', 'trainer', null, 'Profile', 'profile', 'user', '', 6, ''],
  ['trainer.programs.workouts', 'trainer', 'trainer.programs', 'Workouts', 'workouts', 'activity', 'workouts', 1, 'tab'],
  ['trainer.programs.plans', 'trainer', 'trainer.programs', 'Plans', 'plans', 'book-open', 'plans,workout-automation', 2, 'tab'],
  ['trainer.programs.exercises', 'trainer', 'trainer.programs', 'Exercises', 'exercises', 'zap', 'exercises', 3, 'tab'],
  ['member.home', 'member', null, 'Home', 'home', 'home', '', 1, ''],
  ['member.book', 'member', null, 'Book', 'book', 'calendar', '', 2, ''],
  ['member.community', 'member', null, 'Community', 'community', 'users', '', 3, ''],
  ['member.stats', 'member', null, 'Stats', 'stats', 'bar-chart-2', 'stats', 4, ''],
  ['member.progress', 'member', null, 'Progress', 'progress', 'trending-up', 'plans', 5, ''],
  ['member.profile', 'member', null, 'Profile', 'profile', 'user', '', 6, ''],
  ['member.book.classes', 'member', 'member.book', 'Classes', 'classes', 'calendar', 'classes', 1, 'tab'],
  ['member.book.mine', 'member', 'member.book', 'My bookings', 'mine', 'list', 'classes,pt-sessions', 2, 'tab'],
  ['member.book.pt', 'member', 'member.book', 'Personal training', 'pt', 'clock', 'pt-sessions', 3, 'tab'],
  ['member.community.coaches', 'member', 'member.community', 'Live coaching', 'coaches', 'video', 'live-coaching', 1, 'tab'],
  ['member.community.challenges', 'member', 'member.community', 'Challenges', 'challenges', 'award', 'challenges', 2, 'tab'],
  ['member.train', 'member', 'member.home', 'Train', 'train', 'activity', '', 1, 'hidden'],
  ['member.plans', 'member', 'member.home', 'Plans', 'plans', 'book-open', 'plans', 2, 'hidden'],
  ['member.billing', 'member', 'member.home', 'Billing', 'billing', 'credit-card', 'billing', 3, 'hidden'],
  ['member.ai-coach', 'member', 'member.home', 'AI Coach', null, 'cpu', 'ai-coach', 4, 'hidden'],
  ['member.train.workouts', 'member', 'member.train', 'Workouts', 'workouts', 'activity', 'workouts', 1, 'tab'],
  ['member.train.exercises', 'member', 'member.train', 'Exercises', 'exercises', 'zap', 'exercises', 2, 'tab'],
];
const levelOf = (key: string): number => {
  const parent = CATALOG.find(r => r[0] === key)?.[2];
  return parent ? levelOf(parent) + 1 : 1;
};
const treeRow = ([key, app, parentKey, name, route, icon, api, sortOrder, flag]: Row) => ({
  key, app, name, level: levelOf(key), parentKey, sortOrder, icon, route,
  hideFromMenu: flag === 'hidden', isTab: flag === 'tab', adminOnly: flag === 'adminOnly',
  apiModules: api ? api.split(',') : [],
});
const fullGrant = (key: string) => ({ moduleKey: key, canView: true, canCreate: true, canEdit: true, canDelete: true, canExport: true });

/**
 * The preview user's access list: every module of their app, minus `?deny=key1,key2` (and what
 * sits under those) — so a preview can show what someone without those modules sees.
 */
function previewAccess(tabs: boolean) {
  const role = getSession()?.role;
  const app = role === 'client' ? 'member' : role === 'trainer' ? 'trainer' : 'admin';
  const denied = (new URLSearchParams(window.location.search).get('deny') ?? '').split(',').filter(Boolean);
  const isDenied = (key: string): boolean => {
    const parent = CATALOG.find(r => r[0] === key)?.[2];
    return denied.includes(key) || (!!parent && isDenied(parent));
  };
  return CATALOG
    .filter(r => r[1] === app && !isDenied(r[0]) && (r[8] === 'tab') === tabs)
    .map(treeRow)
    .map(({ app: _app, adminOnly: _adminOnly, ...m }) => ({ ...m, canCreate: true, canEdit: true, canDelete: true, canExport: true }));
}

function route(method: string, url: string): unknown {
  const path = url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/api/, '').split('?')[0];

  // ── Admin ──
  if (path === '/dashboard/overview')
    return ok({
      stats: {
        totalRevenue: 1_248_600, revenueGrowthPct: 12.4, totalMembers: 1284, memberGrowthPct: 8.1,
        activeBranches: 4, totalBranches: 5, newSignupsToday: 23, trainersOnline: 11,
        totalTrainers: 18, totalTenants: 3,
      },
      revenueTrend: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'].map((label, i) => ({
        label, value: [862, 905, 891, 978, 1_034, 1_111, 1_249][i] * 1000,
      })),
      branches: [
        { id: 1, name: 'Downtown', city: 'Mumbai', memberCount: 512, revenue: 486_000, occupancyPct: 78, isOpen: true },
        { id: 2, name: 'Westside', city: 'Mumbai', memberCount: 341, revenue: 322_400, occupancyPct: 64, isOpen: true },
        { id: 3, name: 'Harbour', city: 'Kochi', memberCount: 287, revenue: 268_900, occupancyPct: 71, isOpen: true },
        { id: 4, name: 'Lakeview', city: 'Pune', memberCount: 144, revenue: 171_300, occupancyPct: 42, isOpen: false },
      ],
      recentMembers: MEMBERS.map(([name, branchName, d], i) => ({
        id: 100 + i, name, avatarUrl: null, branchName, joinedAt: daysAgo(d), status: i === 4 ? 'Pending' : 'Active',
      })),
    });
  if (path === '/me/training') return ok({ workouts: [], plans: [] });
  // These return plain arrays, not pages.
  if (['/classes', '/classes/me', '/pt/types', '/pt/sessions'].includes(path)) return ok([]);
  if (path === '/access/me') return ok(previewAccess(false));
  if (path === '/access/me/tabs') return ok(previewAccess(true));
  if (path === '/access/modules') return ok(CATALOG.map(treeRow));
  if (/^\/access\/roles\/\d+\/grants$/.test(path)) {
    const roleId = Number(path.split('/')[3]);
    const slug = ['', 'superadmin', 'admin', 'trainer', 'client', 'staff'][roleId] ?? 'custom';
    const app = slug === 'trainer' ? 'trainer' : slug === 'client' ? 'member' : 'admin';
    const grants = CATALOG.filter(r => r[1] === app && (slug !== 'staff' || r[0] === 'admin.members')).map(r => fullGrant(r[0]));
    return ok({ roleId, roleName: slug[0].toUpperCase() + slug.slice(1), roleSlug: slug, app, grants });
  }
  if (/^\/access\/users\/\d+$/.test(path)) {
    const fromRoles = ['member.home', 'member.book', 'member.book.classes', 'member.billing', 'member.profile'].map(fullGrant);
    return ok({
      userId: Number(path.split('/')[3]), app: 'member', fromRoles, effective: fromRoles,
      overrides: [{ moduleKey: 'member.stats', isEnabled: true, canAdd: true, canEdit: false, canDelete: false }],
    });
  }
  if (/^\/access\/users\/\d+\/extra-roles/.test(path)) return ok([]);
  if (path === '/roles')
    return ok([
      { id: '1', name: 'Super Admin', slug: 'superadmin', isSystem: true },
      { id: '2', name: 'Admin', slug: 'admin', isSystem: true },
      { id: '3', name: 'Trainer', slug: 'trainer', isSystem: true },
      { id: '4', name: 'Client', slug: 'client', isSystem: true },
    ].map(r => ({ ...r, description: null, permissions: [], createdAt: daysAgo(300) })));
  if (path === '/tenants')
    return ok([
      { id: 1, name: 'GymBro Fitness', slug: 'gymbro', plan: 'Pro', status: 'Active' },
      { id: 2, name: 'Iron Temple', slug: 'iron-temple', plan: 'Starter', status: 'Trial' },
    ].map(t => ({ ...t, uuid: `t-${t.id}`, logoUrl: '', primaryColor: '', timezone: 'Asia/Kolkata', locale: 'en-IN', currency: 'INR', customDomain: '', trialEndsAt: '', createdAt: daysAgo(200) })));
  if (path === '/branches')
    return ok([
      { id: 1, name: 'Downtown', code: 'DT', city: 'Mumbai', status: 'Active' },
      { id: 2, name: 'Westside', code: 'WS', city: 'Mumbai', status: 'Active' },
      { id: 3, name: 'Harbour', code: 'HB', city: 'Kochi', status: 'Active' },
    ].map(b => ({ ...b, tenantId: 1, parentId: null, address: '', state: '', country: 'India', zip: '', phone: '', email: '', timezone: 'Asia/Kolkata', capacity: 200, logoUrl: '', createdAt: daysAgo(300) })));
  if (path === '/health/admin/overview')
    return ok({ clients: [], averageSteps: 7400, averageSleepHours: 7.1, averageRecoveryScore: 74 });

  // ── Trainer ──
  if (path === '/trainers/me') return ok({ id: 7 });
  if (/^\/trainers\/\d+\/performance$/.test(path))
    return ok({ trainerId: 7, totalClients: 14, totalSessions: 236, rating: 4.8 });
  if (/^\/trainers\/\d+\/earnings$/.test(path))
    return ok({ trainerId: 7, month: 11, year: 2026, totalEarnings: 84_500, commissionEarned: 12_300 });
  if (/^\/trainers\/\d+\/clients$/.test(path))
    return ok(MEMBERS.map((_, i) => ({ assignmentId: i + 1, clientId: 100 + i, status: 'Active', assignedAt: daysAgo(10 + i * 7) })));
  if (/^\/trainers\/\d+\/schedule$/.test(path))
    return ok([1, 2, 3, 4, 5].map(d => ({ dayOfWeek: d, startTime: '06:00:00', endTime: '14:00:00', isActive: true })));
  if (/^\/trainers\/\d+$/.test(path))
    return ok({
      id: 7, userId: 2, branchId: 1, branchName: 'Downtown', trainerCode: 'TR-007', displayName: 'Vikram Rao',
      bio: 'Strength & conditioning coach.', experienceYears: 8, gender: 'Male', dateOfBirth: null, phone: null,
      email: 'vikram@gymbro.app', specializations: ['Strength', 'HIIT', 'Mobility'], certifications: null,
      employment: null, bookingSettings: null, rating: 4.8, isAvailable: true, createdAt: daysAgo(400),
    });
  if (path === '/trainers')
    return page([
      { id: 7, userId: 2, branchId: 1, trainerCode: 'TR-007', displayName: 'Vikram Rao', isAvailable: true, rating: 4.8 },
      { id: 8, userId: 3, branchId: 2, trainerCode: 'TR-008', displayName: 'Nisha Pillai', isAvailable: false, rating: 4.6 },
    ].map(t => ({ ...t, profileImage: null, bio: null, experienceYears: 5, gender: null, dateOfBirth: null, phone: null, email: `${t.displayName.split(' ')[0].toLowerCase()}@gymbro.app`, address: null, languagesKnown: null, specializations: null, employment: null, notes: null, createdAt: daysAgo(300) })));

  // ── Member ──
  if (/^\/members\/\d+$/.test(path)) {
    const id = Number(path.split('/')[2]);
    const m = MEMBERS[(id - 100 + MEMBERS.length) % MEMBERS.length] ?? MEMBERS[0];
    const [first, last] = m[0].split(' ');
    return ok({
      id, tenantId: 1, email: `${first.toLowerCase()}@mail.com`, firstName: first, lastName: last, phone: null,
      gender: null, dob: null, avatarUrl: null, status: 'Active', trainerId: 7, branchId: 1, branchName: m[1],
      createdAt: daysAgo(90),
    });
  }
  if (/^\/members\/\d+\/timeline$/.test(path)) return ok([]);
  if (path === '/health/today')
    return ok({
      rings: { move: { current: 6420, goal: 8000 }, train: { current: 38, goal: 45 }, stand: { current: 9, goal: 12 } },
      stats: { bpm: 72, waterLiters: 1.8, sleepHours: 7.4, energyPct: 82 },
      streakDays: 12, coachTip: 'Great recovery — today is a good day to push your squat top set.',
    });
  if (path === '/challenges/active')
    return ok([
      { id: 1, title: '30-Day Squat Challenge', participantCount: 128, prizeLabel: 'Free month', progressPct: 64, isJoined: true },
      { id: 2, title: '10K Steps Streak', participantCount: 342, prizeLabel: 'Gym merch', progressPct: 0, isJoined: false },
    ]);
  if (path === '/workouts') return page(WORKOUTS);
  if (/^\/workouts\/\d+$/.test(path)) return ok(WORKOUTS[0]);
  if (path === '/plans')
    return page([{ id: 1, name: '12-Week Strength Base', goal: 'MuscleGain', difficulty: 'Intermediate', durationWeeks: 12, isActive: true }]);

  // ── Attendance ──
  if (path === '/attendance/settings')
    return ok({
      settings: { faceEnabled: true, fingerprintEnabled: false, defaultRadiusM: 100, maxAccuracyM: 150 },
      branches: [
        { branchId: 1, name: 'Downtown', city: 'Mumbai', lat: 19.076, lng: 72.8777, radiusM: 150, hasOwnRadius: true, enabled: true, isConfigured: true, isActive: true },
        { branchId: 2, name: 'Westside', city: 'Mumbai', lat: null, lng: null, radiusM: null, hasOwnRadius: false, enabled: false, isConfigured: false, isActive: false },
      ],
    });
  if (/^\/attendance\/branches\/\d+\/geofence$/.test(path)) return ok({});
  if (path === '/attendance/me/status')
    return ok({
      locationEnabled: true, openVisit: null, visitsThisMonth: 9,
      branches: [{ branchId: 1, name: 'Downtown', city: 'Mumbai', lat: 19.076, lng: 72.8777, radiusM: 150, hasOwnRadius: true, enabled: true, isConfigured: true, isActive: true }],
    });
  if (path === '/attendance/check-in')
    return { success: false, message: 'Out of range', data: { checkedIn: false, message: '', visit: null, distanceM: 2400, nearestBranch: 'Downtown' }, errors: null };
  if (path === '/attendance')
    return page(MEMBERS.slice(0, 4).map(([name, branchName], i) => ({
      id: i + 1, userId: 100 + i, userName: name, branchId: 1, branchName, method: i % 2 ? 'Face' : 'Location',
      checkInAt: new Date(Date.now() - (i + 1) * 3_600_000).toISOString(), checkOutAt: i === 0 ? null : new Date(Date.now() - i * 1_800_000).toISOString(),
      durationMin: null, distanceM: i % 2 ? null : 40 + i * 10,
    })));

  if (method === 'get') return page([]);
  return ok(null);
}

const mockAdapter: AxiosAdapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
  await new Promise(r => setTimeout(r, 150)); // let loading states flash briefly
  const data = route((config.method ?? 'get').toLowerCase(), `${config.baseURL ?? ''}${config.url ?? ''}`);
  return { data, status: 200, statusText: 'OK', headers: {}, config };
};

/** Installs the mock API and a matching session; returns the user id to open the app with. */
export function startPreview(role: PreviewRole): number {
  axiosInstance.defaults.adapter = mockAdapter;
  const userId = role === 'trainer' ? 2 : role === 'member' ? 100 : 1;
  setSession({ userId, role: role === 'member' ? 'client' : role, tenantId: 1, branchId: 1 });
  return userId;
}
