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
import { setSession } from '../api/session';

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

const ALL_MODULES = ['workouts', 'exercises', 'plans', 'challenges', 'live-coaching', 'stats', 'ai-coach'];

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
  if (path === '/module-access/me') return ok([]);
  if (path === '/module-access/modules') return ok(ALL_MODULES);
  if (path === '/module-access') return ok([]);
  if (path === '/module-access/matrix') return ok({ tenantId: 1, matrix: {} });
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
  if (/^\/users\/\d+\/modules$/.test(path))
    return ok(ALL_MODULES.map((key, i) => ({ moduleId: i + 1, key, name: key, description: null, icon: null, isEnabled: true, grantedAt: null })));

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
