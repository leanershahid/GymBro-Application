// Preview-mode answers for /api/safety and /api/consents (waivers, health check, emergency contact,
// consents). In-memory and stateful, so ?preview=member can walk the whole Get-started flow and
// ?preview=admin can edit waivers and open a member's "Waivers & health". Resets on reload.
// Return undefined to fall through.

const ok = <T,>(data: T) => ({ success: true, message: 'OK', data, errors: null });
const fail = (message: string) => ({ success: false, message, data: null, errors: null });
const DAY = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();

const PLACEHOLDER_BODY = `[PLACEHOLDER TEMPLATE — HAVE THIS REVIEWED BY A LAWYER BEFORE USE. NOT LEGAL ADVICE.]

## 1. Assumption of risk
I understand that exercise, including strength training, group classes, cardio and personal training, carries a risk of injury, illness and, in rare cases, death. I take part voluntarily and accept these risks.

## 2. Health
I confirm that I have answered the gym's health questionnaire truthfully, that I will tell staff about any change in my health, and that I will stop exercising and tell staff if I feel unwell.

## 3. Rules and equipment
I will follow the gym's rules and staff instructions, use equipment only as intended, and report damaged equipment.

## 4. Release
To the extent allowed by law, I release [GYM LEGAL NAME], its owners, staff and trainers from claims arising from my use of the facilities and services, except where caused by their negligence or wilful misconduct.

## 5. Emergency treatment
I consent to staff calling emergency services and giving first aid if I need it.

## 6. Personal belongings
The gym is not responsible for lost or stolen belongings.

## 7. Agreement
I have read this waiver, understand it, and sign it by typing my full name below.`;

const QUESTIONS = [
  { key: 'heart_or_bp', text: 'Has a doctor ever told you that you have a heart condition or high blood pressure?', help: null },
  { key: 'chest_pain', text: 'Do you feel pain in your chest when resting, during daily activities, or when you are active?', help: null },
  { key: 'dizziness', text: 'Do you lose your balance because of dizziness, or have you lost consciousness in the last 12 months?', help: 'Answer no if your dizziness was only from breathing hard during exercise.' },
  { key: 'chronic_condition', text: 'Have you ever been diagnosed with another long-term medical condition (other than heart disease or high blood pressure)?', help: 'For example diabetes, asthma, arthritis, cancer, osteoporosis, or a lung, kidney or liver condition.' },
  { key: 'medication', text: 'Are you currently taking prescribed medication for a long-term medical condition?', help: null },
  { key: 'bone_joint', text: 'Do you have (or have you had in the last 12 months) a bone, joint, muscle, ligament or tendon problem that could get worse with more activity?', help: "Answer no if it was a problem in the past that doesn't limit you now." },
  { key: 'supervised_only', text: 'Has a doctor ever said you should only do medically supervised physical activity?', help: null },
];

interface Version { id: number; waiverId: number; version: number; title: string; body: string; requiresResign: boolean; publishedAt: string }
interface Sig { id: number; userId: number; waiverId: number; waiverVersionId: number; version: number; title: string; signedName: string; signedAt: string; ip: string; userAgent: string; bodyHash: string }
interface Screening { id: number; userId: number; answers: boolean[]; conditions: string | null; medications: string | null; injuries: string | null; pregnancy: string | null; submittedAt: string; expiresAt: string; clearedAt: string | null; clearanceNote: string | null }
interface Consent { id: number; userId: number; type: string; granted: boolean; version: string; at: string; source: string }
interface Contact { name: string; relationship: string | null; phone: string; source: 'profile' | 'legacy'; updatedAt: string | null }

let nextId = 9000;
const settings = { gatingEnabled: true, healthValidDays: 365, blockUntilCleared: false, requireEmergencyContact: false };
const waivers = [{ id: 1, title: 'Liability waiver and release', isActive: true, createdAt: iso(-400) }];
const versions: Version[] = [1, 2, 3].map(v => ({
  id: 10 + v, waiverId: 1, version: v, title: 'Liability waiver and release',
  body: PLACEHOLDER_BODY + (v > 1 ? `\n\n## ${v + 6}. House rules\nWipe down equipment after use. (Added in version ${v}.)` : ''),
  requiresResign: v !== 2, publishedAt: iso(-400 + v * 100),
}));
const hash = (s: string) => Array.from(s).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(16).padStart(8, '0').repeat(8);

// Seeded people (admin preview): 100 = the preview member (starts with nothing done),
// 101 signed v3 + needs clearance, 102 signed v1 (re-sign needed) + expired health, 103 all good.
const sigs: Sig[] = [];
const screenings: Screening[] = [];
const consents: Consent[] = [];
const contacts = new Map<number, Contact>();
const overrides: { id: number; userId: number; context: string; missing: string[]; reason: string | null; overriddenByUserId: number; overriddenByName: string; at: string }[] = [];
const NAMES: Record<number, string> = { 100: 'Aarav Mehta', 101: 'Sara Khan', 102: 'Rohan Das', 103: 'Meera Nair', 104: 'Kabir Shah', 105: 'Ananya Iyer' };

function addSig(userId: number, versionId: number, daysAgo: number) {
  const v = versions.find(x => x.id === versionId)!;
  sigs.push({ id: nextId++, userId, waiverId: v.waiverId, waiverVersionId: v.id, version: v.version, title: v.title, signedName: NAMES[userId] ?? 'Member', signedAt: iso(-daysAgo), ip: '203.0.113.7', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', bodyHash: hash(v.title + v.body) });
}
function addScreening(userId: number, yes: boolean, daysAgo: number, cleared = false) {
  screenings.push({ id: nextId++, userId, answers: QUESTIONS.map((_, i) => yes && i === 5), conditions: yes ? 'Mild asthma' : null, medications: yes ? 'Inhaler before exercise' : null, injuries: yes ? 'Old ACL repair, left knee' : null, pregnancy: 'No', submittedAt: iso(-daysAgo), expiresAt: iso(-daysAgo + 365), clearedAt: cleared ? iso(-daysAgo + 3) : null, clearanceNote: cleared ? 'GP letter on file' : null });
  consents.push({ id: nextId++, userId, type: 'health_data', granted: true, version: '1', at: iso(-daysAgo), source: 'health_form' });
}
addSig(101, 13, 20); addScreening(101, true, 20);
contacts.set(101, { name: 'Imran Khan', relationship: 'Parent', phone: '+91 98200 11223', source: 'profile', updatedAt: iso(-20) });
addSig(102, 11, 300); addScreening(102, false, 400);
contacts.set(102, { name: 'Emergency contact', relationship: null, phone: '+91 99000 22334', source: 'legacy', updatedAt: null });
addSig(103, 13, 60); addScreening(103, false, 60);
contacts.set(103, { name: 'Arjun Nair', relationship: 'Partner', phone: '+91 98111 44556', source: 'profile', updatedAt: iso(-60) });
overrides.push({ id: nextId++, userId: 102, context: 'desk_checkin', missing: ['waiver', 'health_expired'], reason: 'Front desk override', overriddenByUserId: 1, overriddenByName: 'Front Desk', at: iso(-2) });

const latestVersion = (waiverId: number) => versions.filter(v => v.waiverId === waiverId).sort((a, b) => b.version - a.version)[0];
const latestScreening = (userId: number) => screenings.filter(s => s.userId === userId).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
const consentGranted = (userId: number, type: string) => consents.filter(c => c.userId === userId && c.type === type).sort((a, b) => b.at.localeCompare(a.at))[0]?.granted ?? false;

function waiverStatuses(userId: number) {
  return waivers.filter(w => w.isActive).map(w => {
    const latest = latestVersion(w.id);
    const best = sigs.filter(s => s.userId === userId && s.waiverId === w.id).sort((a, b) => b.version - a.version)[0];
    const status = !best ? 'unsigned' : best.version >= latest.version ? 'signed'
      : versions.some(v => v.waiverId === w.id && v.version > best.version && v.requiresResign) ? 'resign_required' : 'signed';
    return { waiverId: w.id, title: w.title, latestVersionId: latest.id, latestVersion: latest.version, signedVersion: best?.version ?? null, signedAt: best?.signedAt ?? null, signatureId: best?.id ?? null, status, ok: status === 'signed' };
  });
}

function compliance(userId: number) {
  const ws = waiverStatuses(userId);
  const s = latestScreening(userId);
  const now = new Date().toISOString();
  const status = !s ? 'missing' : s.expiresAt <= now ? 'expired' : s.answers.some(Boolean) ? (s.clearedAt ? 'cleared' : 'needs_clearance') : 'current';
  const ec = contacts.get(userId) ?? null;
  const missing: string[] = [];
  if (!ws.every(w => w.ok)) missing.push('waiver');
  if (status === 'missing') missing.push('health');
  if (status === 'expired') missing.push('health_expired');
  if (settings.blockUntilCleared && status === 'needs_clearance') missing.push('clearance');
  if (settings.requireEmergencyContact && !ec) missing.push('emergency_contact');
  const healthDone = ['current', 'needs_clearance', 'cleared'].includes(status);
  const stepsTotal = (ws.length ? 1 : 0) + 2;
  const stepsDone = (ws.length && ws.every(w => w.ok) ? 1 : 0) + (healthDone ? 1 : 0) + (ec ? 1 : 0);
  return {
    userId, gatingEnabled: settings.gatingEnabled, waivers: ws, waiverOk: ws.every(w => w.ok),
    health: { status, screeningId: s?.id ?? null, submittedAt: s?.submittedAt ?? null, expiresAt: s?.expiresAt ?? null, needsClearance: status === 'needs_clearance', clearedAt: s?.clearedAt ?? null, ok: healthDone },
    hasHealthDataConsent: consentGranted(userId, 'health_data'), emergencyContact: ec, emergencyOk: !!ec,
    missing, canBook: !settings.gatingEnabled || missing.length === 0, stepsDone, stepsTotal, checklistComplete: stepsDone === stepsTotal,
  };
}

const mapScreening = (s: Screening) => ({
  id: s.id, userId: s.userId, formVersion: 'parq-plus-style-v1',
  answers: QUESTIONS.map((q, i) => ({ key: q.key, question: q.text, answer: s.answers[i] })),
  yesCount: s.answers.filter(Boolean).length, conditions: s.conditions, medications: s.medications, injuries: s.injuries, pregnancy: s.pregnancy,
  needsClearance: s.answers.some(Boolean), submittedAt: s.submittedAt, expiresAt: s.expiresAt, expired: s.expiresAt <= new Date().toISOString(),
  clearedAt: s.clearedAt, clearanceNote: s.clearanceNote,
});
const mapSig = (s: Sig, withBody = false) => ({ ...s, memberName: NAMES[s.userId] ?? null, body: withBody ? versions.find(v => v.id === s.waiverVersionId)?.body ?? '' : null });

function consentsOf(userId: number) {
  const rows = consents.filter(c => c.userId === userId).sort((a, b) => b.at.localeCompare(a.at));
  return {
    current: ['health_data', 'marketing_email', 'marketing_push', 'photo_media', 'terms', 'privacy'].map(type => {
      const l = rows.find(r => r.type === type);
      return { type, granted: l?.granted ?? false, version: l?.version ?? null, at: l?.at ?? null, source: l?.source ?? null };
    }),
    history: rows,
  };
}

function adminWaivers() {
  return waivers.map(w => {
    const vs = versions.filter(v => v.waiverId === w.id).sort((a, b) => b.version - a.version);
    return {
      ...w, latestVersion: vs[0]?.version ?? 0, latestVersionId: vs[0]?.id ?? null, latestBody: vs[0]?.body ?? '',
      versions: vs.map(v => ({ id: v.id, version: v.version, title: v.title, requiresResign: v.requiresResign, publishedAt: v.publishedAt, signatureCount: sigs.filter(s => s.waiverVersionId === v.id).length })),
    };
  });
}

export function safetyRoute(method: string, path: string, body: unknown, me: number): unknown {
  const b = (body ?? {}) as Record<string, unknown>;
  let m: RegExpExecArray | null;

  // ── Consents ──
  if (path === '/consents/me') {
    if (method === 'post') {
      const cur = consentsOf(me).current.find(c => c.type === b.type);
      if (!cur) return fail('Type: unknown consent type.');
      if (cur.granted !== b.granted) consents.push({ id: nextId++, userId: me, type: String(b.type), granted: !!b.granted, version: String(b.version ?? '1'), at: new Date().toISOString(), source: String(b.source ?? 'app') });
    }
    return ok(consentsOf(me));
  }
  if (!path.startsWith('/safety/')) return undefined;

  // ── Me ──
  if (path === '/safety/me') return ok(compliance(me));
  if (path === '/safety/me/waivers/pending')
    return ok(waiverStatuses(me).filter(w => !w.ok).map(w => {
      const v = versions.find(x => x.id === w.latestVersionId)!;
      return { waiverId: v.waiverId, versionId: v.id, version: v.version, title: v.title, body: v.body, requiresResign: v.requiresResign, previouslySignedVersion: w.signedVersion, publishedAt: v.publishedAt };
    }));
  if ((m = /^\/safety\/me\/waivers\/(\d+)\/sign$/.exec(path))) {
    const v = versions.find(x => x.id === Number(m![1]));
    if (!v) return fail('Waiver not found.');
    if (String(b.signedName ?? '').trim().length < 2) return fail('Signature: type your full name to sign.');
    addSig(me, v.id, 0);
    sigs[sigs.length - 1].signedName = String(b.signedName).trim();
    return ok(mapSig(sigs[sigs.length - 1]));
  }
  if (path === '/safety/me/signatures') return ok(sigs.filter(s => s.userId === me).map(s => mapSig(s)));
  if (path === '/safety/me/health/questions') return ok({ formVersion: 'parq-plus-style-v1', validDays: settings.healthValidDays, questions: QUESTIONS });
  if (path === '/safety/me/health') {
    if (method === 'post') {
      if (!consentGranted(me, 'health_data')) {
        if (!b.grantHealthDataConsent) return fail('Please agree to the gym storing your health information before submitting.');
        consents.push({ id: nextId++, userId: me, type: 'health_data', granted: true, version: '1', at: new Date().toISOString(), source: 'health_form' });
      }
      const answers = (b.answers as boolean[]) ?? [];
      const s: Screening = { id: nextId++, userId: me, answers, conditions: (b.conditions as string) ?? null, medications: (b.medications as string) ?? null, injuries: (b.injuries as string) ?? null, pregnancy: (b.pregnancy as string) ?? null, submittedAt: new Date().toISOString(), expiresAt: iso(settings.healthValidDays), clearedAt: null, clearanceNote: null };
      screenings.push(s);
      return ok(mapScreening(s));
    }
    const s = latestScreening(me);
    return ok(s ? mapScreening(s) : null);
  }
  if (path === '/safety/me/emergency-contact') {
    if (method === 'put') {
      if (String(b.phone ?? '').replace(/\D/g, '').length < 6) return fail('Phone: enter a valid phone number (6–15 digits).');
      contacts.set(me, { name: String(b.name).trim(), relationship: (b.relationship as string) || null, phone: String(b.phone).trim(), source: 'profile', updatedAt: new Date().toISOString() });
    }
    return ok(contacts.get(me) ?? null);
  }

  // ── Staff ──
  if ((m = /^\/safety\/members\/(\d+)$/.exec(path))) {
    const id = Number(m[1]);
    return ok({
      compliance: compliance(id), signatures: sigs.filter(s => s.userId === id).map(s => mapSig(s)), canViewHealthAnswers: true,
      recentOverrides: overrides.filter(o => o.userId === id), consents: consentsOf(id).current,
    });
  }
  if ((m = /^\/safety\/members\/(\d+)\/health$/.exec(path)))
    return ok(screenings.filter(s => s.userId === Number(m![1])).sort((a, b2) => b2.submittedAt.localeCompare(a.submittedAt)).map(mapScreening));
  if ((m = /^\/safety\/members\/(\d+)\/health\/(\d+)\/clear$/.exec(path))) {
    const s = screenings.find(x => x.id === Number(m![2]));
    if (!s) return fail('Health check not found.');
    s.clearedAt = new Date().toISOString(); s.clearanceNote = (b.note as string) ?? null;
    return ok(mapScreening(s));
  }
  if ((m = /^\/safety\/signatures\/(\d+)$/.exec(path))) {
    const s = sigs.find(x => x.id === Number(m![1]));
    return s ? ok(mapSig(s, true)) : fail('Signature not found.');
  }

  // ── Admin ──
  if (path === '/safety/admin/settings') {
    if (method === 'put') Object.assign(settings, b);
    return ok({ ...settings });
  }
  if (path === '/safety/admin/waivers/template') return ok({ title: 'Liability waiver and release', body: PLACEHOLDER_BODY, isPlaceholder: true });
  if (path === '/safety/admin/waivers') {
    if (method === 'post') {
      const w = { id: nextId++, title: String(b.title), isActive: true, createdAt: new Date().toISOString() };
      waivers.push(w);
      versions.push({ id: nextId++, waiverId: w.id, version: 1, title: w.title, body: String(b.body), requiresResign: true, publishedAt: new Date().toISOString() });
      return ok(adminWaivers().find(x => x.id === w.id));
    }
    return ok(adminWaivers());
  }
  if ((m = /^\/safety\/admin\/waivers\/(\d+)\/versions$/.exec(path))) {
    const w = waivers.find(x => x.id === Number(m![1]));
    if (!w) return fail('Waiver not found.');
    if (b.title) w.title = String(b.title);
    versions.push({ id: nextId++, waiverId: w.id, version: latestVersion(w.id).version + 1, title: w.title, body: String(b.body), requiresResign: !!b.requiresResign, publishedAt: new Date().toISOString() });
    return ok(adminWaivers().find(x => x.id === w.id));
  }
  if ((m = /^\/safety\/admin\/waivers\/(\d+)$/.exec(path))) {
    const w = waivers.find(x => x.id === Number(m![1]));
    if (!w) return fail('Waiver not found.');
    if (typeof b.isActive === 'boolean') w.isActive = b.isActive;
    if (b.title) w.title = String(b.title);
    return ok(adminWaivers().find(x => x.id === w.id));
  }
  return undefined;
}
