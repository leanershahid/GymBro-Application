// Preview-mode answers for face check-in: attendance settings (face fields), the member's location +
// selfie check-in (?preview=member: not enrolled → consent + enrolment; first selfie "doesn't match",
// the retry checks in), Profile → Face check-in, and the staff side (?preview=admin: member detail
// enrol / reset / delete, attendance log badges, failed attempts, selfie vs reference photo).
// In-memory and stateful; resets on reload. Return undefined to fall through.

/** A mock HTTP error: the preview adapter turns it into an AxiosError with this status and body. */
export class MockHttpError {
  constructor(readonly status: number, readonly body: unknown) {}
}

const ok = <T,>(data: T, message = 'OK') => ({ success: true, message, data, errors: null });
const fail = <T,>(message: string, data: T) => ({ success: false, message, data, errors: null });
const coded = (status: number, code: string, message: string, data: unknown = null) =>
  new MockHttpError(status, { success: false, message, code, data, errors: null });
const page = <T,>(items: T[]) => ok({ items, pageNumber: 1, pageSize: 50, totalRecords: items.length, totalPages: 1 });
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

/** Placeholder "photos" (no real faces in preview mode). */
const placeholder = (label: string, hue: number) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="hsl(${hue},25%,22%)"/>` +
    `<ellipse cx="150" cy="180" rx="80" ry="105" fill="hsl(${hue},20%,40%)"/><text x="150" y="360" font-size="22" fill="#ddd" text-anchor="middle" font-family="sans-serif">${label}</text></svg>`,
  )}`;

const settings = { faceEnabled: true, fingerprintEnabled: false, defaultRadiusM: 100, maxAccuracyM: 150, faceCheckEnabled: true, faceMatchThreshold: 90, keepCheckInSelfiesDays: 30 };
const branch = { branchId: 1, name: 'Downtown', city: 'Mumbai', lat: 19.076, lng: 72.8777, radiusM: 150, hasOwnRadius: true, enabled: true, isConfigured: true, isActive: true };

const me = { enrolled: false, consent: false, enrolledAt: null as string | null, removed: false };
let selfieTries = 0;
let openVisit: Record<string, unknown> | null = null;

interface MemberFace { status: 'active' | 'reset_required' | null; enrolledAt: string | null; source: 'self' | 'desk' | null; by: string | null; consent: boolean }
const members: Record<number, MemberFace> = {
  100: { status: 'active', enrolledAt: ago(60 * 24 * 12), source: 'self', by: null, consent: true },
  101: { status: null, enrolledAt: null, source: null, by: null, consent: false },
  102: { status: 'reset_required', enrolledAt: ago(60 * 24 * 40), source: 'desk', by: 'Ada Admin', consent: true },
};
const memberOf = (id: number): MemberFace => (members[id] ??= { status: null, enrolledAt: null, source: null, by: null, consent: false });

const attempts = [
  { id: 901, userId: 101, userName: 'Sara Khan', branchId: 1, branchName: 'Downtown', at: ago(35), outcome: 'mismatch', similarity: 61.4, threshold: 90, detail: null, hasSelfie: true, attendanceId: null },
  { id: 902, userId: 101, userName: 'Sara Khan', branchId: 1, branchName: 'Downtown', at: ago(33), outcome: 'not_clear', similarity: null, threshold: 90, detail: 'multiple_faces', hasSelfie: true, attendanceId: null },
  { id: 903, userId: 104, userName: 'Kabir Shah', branchId: 1, branchName: 'Downtown', at: ago(140), outcome: 'unavailable', similarity: null, threshold: 90, detail: 'timeout', hasSelfie: false, attendanceId: null },
];

const myStatus = () => ({
  required: settings.faceCheckEnabled, enrolled: me.enrolled, status: me.enrolled ? 'active' : null, enrolledAt: me.enrolledAt,
  source: me.enrolled ? 'self' : null, consentGranted: me.consent, photoUrl: me.enrolled ? placeholder('Your photo', 120) : null,
  keepCheckInSelfiesDays: settings.keepCheckInSelfiesDays, faceProvider: 'local',
});

const memberStatus = (id: number) => {
  const m = memberOf(id);
  return {
    userId: id, faceCheckEnabled: settings.faceCheckEnabled, enrolled: m.status === 'active', status: m.status, enrolledAt: m.enrolledAt,
    source: m.source, enrolledByName: m.by, consentGranted: m.consent, photoUrl: m.status === 'active' ? placeholder('Reference', 200) : null,
    recentAttempts: attempts.filter(a => a.userId === id), keepCheckInSelfiesDays: settings.keepCheckInSelfiesDays, faceProvider: 'local',
  };
};

export function faceCheckInRoute(method: string, path: string, body: unknown): unknown {
  // ── Admin settings ──
  if (path === '/attendance/settings') {
    if (method === 'put' && body && typeof body === 'object') Object.assign(settings, body);
    return ok({ settings, branches: [branch, { ...branch, branchId: 2, name: 'Westside', lat: null, lng: null, radiusM: null, enabled: false, isConfigured: false, isActive: false }],
      faceServiceConfigured: true, privateStorageConfigured: true, faceProvider: 'local' }, method === 'put' ? 'Attendance settings saved.' : 'OK');
  }

  // ── Member: status, location check-in, selfie check-in ──
  if (path === '/attendance/me/status')
    return ok({ locationEnabled: true, openVisit, visitsThisMonth: 9, branches: [branch], faceCheckRequired: settings.faceCheckEnabled, faceEnrolled: me.enrolled });
  if (path === '/attendance/check-in' && method === 'post') {
    if (!settings.faceCheckEnabled) return undefined; // fall through to the plain location mock
    if (!me.enrolled) return coded(422, 'FACE_ENROLL_REQUIRED', 'Set up face check-in first: take a reference selfie.');
    return fail('You’re at Downtown. Take a selfie to finish checking in.', { checkedIn: false, faceRequired: true, message: '', visit: null, distanceM: 12, nearestBranch: 'Downtown' });
  }
  if (path === '/attendance/check-in/face' && method === 'post') {
    selfieTries += 1;
    if (selfieTries === 1)
      return coded(422, 'FACE_MISMATCH', 'Your selfie didn’t match your face check-in photo. Try again in good light, facing the camera (2 attempts left).', { attemptsLeft: 2 });
    openVisit = { id: 77, userId: 100, userName: 'Aarav Mehta', branchId: 1, branchName: 'Downtown', method: 'Location', checkInAt: new Date().toISOString(), checkOutAt: null, durationMin: null, distanceM: 12, faceVerified: true, faceScore: 97.3 };
    return ok({ checkedIn: true, message: 'Face verified. Checked in at Downtown.', visit: openVisit, distanceM: 12, nearestBranch: 'Downtown' }, 'Face verified. Checked in at Downtown.');
  }
  if (path === '/attendance/check-out' && openVisit) {
    const v = { ...openVisit, checkOutAt: new Date().toISOString() };
    openVisit = null;
    return ok(v, 'Checked out.');
  }

  // ── Member: Profile → Face check-in ──
  if (path === '/attendance/face/me') {
    if (method === 'delete') { me.enrolled = false; me.consent = false; me.enrolledAt = null; return ok(myStatus(), 'Your face data was deleted.'); }
    return ok(myStatus());
  }
  if (path === '/attendance/face/me/enroll') {
    me.enrolled = true; me.consent = true; me.enrolledAt = new Date().toISOString(); selfieTries = 0;
    return ok(myStatus(), 'Face check-in is set up.');
  }

  // ── Staff ──
  let m = /^\/attendance\/face\/members\/(\d+)(\/enroll|\/reset)?$/.exec(path);
  if (m) {
    const id = Number(m[1]);
    const f = memberOf(id);
    if (m[2] === '/enroll') Object.assign(f, { status: 'active', enrolledAt: new Date().toISOString(), source: 'desk', by: 'Ada Admin', consent: true });
    else if (m[2] === '/reset') Object.assign(f, { status: 'reset_required' });
    else if (method === 'delete') { Object.assign(f, { status: null, enrolledAt: null, source: null, by: null }); return ok(null, 'Face check-in enrolment deleted.'); }
    return ok(memberStatus(id));
  }
  if (path === '/attendance/face/attempts') return page(attempts);
  m = /^\/attendance\/face\/attempts\/(\d+)\/photos$/.exec(path);
  if (m) {
    const a = attempts.find(x => x.id === Number(m![1])) ?? { id: 950, outcome: 'matched', similarity: 97.3, at: ago(60) };
    return ok({ attemptId: a.id, selfieUrl: placeholder('Check-in selfie', 30), referenceUrl: placeholder('Reference', 200), similarity: a.similarity, outcome: a.outcome, at: a.at });
  }

  // ── Attendance log with face badges ──
  if (path === '/attendance' && method === 'get') {
    const rows = [
      ['Aarav Mehta', true, 97.3, 950], ['Rohan Das', true, 93.8, 951], ['Meera Nair', null, null, null], ['Kabir Shah', null, null, null],
    ] as const;
    return page(rows.map(([name, face, score, attemptId], i) => ({
      id: i + 1, userId: 100 + i, userName: name, branchId: 1, branchName: 'Downtown', method: face ? 'Location' : i === 3 ? 'Manual' : 'Location',
      checkInAt: ago((i + 1) * 60), checkOutAt: i === 0 ? null : ago(i * 30), durationMin: null, distanceM: i === 3 ? null : 20 + i * 10,
      faceVerified: face, faceScore: score, faceAttemptId: attemptId, hasFaceSelfie: !!attemptId,
    })));
  }
  return undefined;
}
