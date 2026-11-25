// Preview-mode answers for the member's training (?preview=member): /me/training with the week
// strip and adherence, the plan calendar + skip / move / undo, workout structures with set targets
// and a superset, previous performance, completing a session (with personal records), history and
// records. In-memory and stateful, so the walkthrough works: open today → log → finish shows a PR
// (bench target 62.5 kg beats the 60 kg record) → the strip shows ✓ → skip tomorrow. Resets on reload.
// Return undefined to fall through.

type A = Record<string, any>;

const ok = <T,>(data: T, message = 'OK') => ({ success: true, message, data, errors: null });
const fail = (message: string, code?: string) => ({ success: false, message, code, data: null, errors: null });

const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');
const ds = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const add = (s: string, n: number) => { const d = parse(s); return ds(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); };
const diff = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / DAY);
const today = () => ds(new Date());
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── Plan: 8 weeks, today = week 2 day 1 (Push) ──
const AID = 9001;
const PLAN_ID = 501;
const WEEKS = 8;
const START = add(today(), -7);
const END = add(START, WEEKS * 7 - 1);

interface PatternDay { title: string | null; workoutId: number | null; rest: boolean }
const PATTERN: PatternDay[] = [
  { title: 'Push', workoutId: 601, rest: false },
  { title: 'Pull', workoutId: 602, rest: false },
  { title: null, workoutId: null, rest: true },
  { title: 'Legs', workoutId: 603, rest: false },
  { title: 'Upper', workoutId: 604, rest: false },
  { title: 'Conditioning', workoutId: 605, rest: false },
  { title: null, workoutId: null, rest: true },
];

// ── Exercises & structures ──
const EX: Record<number, string> = {
  11: 'Bench Press', 12: 'Incline Dumbbell Press', 13: 'Cable Fly', 14: 'Overhead Press', 15: 'Triceps Pushdown', 16: 'Band Pull-apart',
  21: 'Deadlift', 22: 'Pull-up', 23: 'Barbell Row', 24: 'Face Pull', 25: 'Biceps Curl',
  31: 'Back Squat', 32: 'Romanian Deadlift', 33: 'Leg Press', 34: 'Plank',
  41: 'Kettlebell Swing', 42: 'Burpee', 43: 'Row Erg',
};

const ex = (wid: number, i: number, exerciseId: number, extra: A = {}): A => ({
  workoutExerciseId: wid * 100 + i, exerciseId, exerciseName: EX[exerciseId], sets: 3, reps: '10', durationSeconds: null,
  restSeconds: 90, tempo: null, weightSuggestion: null, notes: null, setTargets: null, ...extra,
});
const work = (n: number, t: A) => Array.from({ length: n }, () => ({ type: 'normal', ...t }));
const section = (name: string | null, type: string, exercises: A[], rounds = 1, restSeconds: number | null = null) => ({ name, type, rounds, restSeconds, exercises });

const STRUCTURES: Record<number, A> = {
  601: { workoutName: 'Push', ownerPlanDayId: 7001, sections: [
    section('Warm-up', 'Warmup', [ex(601, 0, 16, { sets: 2, reps: '15', restSeconds: 30 })]),
    section('Bench press', 'Main', [ex(601, 1, 11, {
      sets: 4, reps: '6-8', restSeconds: 120, tempo: '3-1-1', notes: 'Pause the last rep on the chest.',
      setTargets: [{ type: 'warmup', repsMin: 10, repsMax: 10, weightKg: 40, restSec: 60 }, ...work(3, { repsMin: 6, repsMax: 8, weightKg: 62.5, restSec: 120 })],
    })]),
    section('Chest finisher', 'Superset', [
      ex(601, 2, 12, { reps: '10', restSeconds: 0, weightSuggestion: '22 kg dumbbells' }),
      ex(601, 3, 13, { reps: '12-15', restSeconds: 0 }),
    ], 3, 90),
    section('Shoulders & arms', 'Main', [ex(601, 4, 14, { reps: '8' }), ex(601, 5, 15, { reps: '12', restSeconds: 60 })]),
    section('Cool-down', 'Cooldown', [ex(601, 6, 34, { sets: 2, reps: null, durationSeconds: 45, restSeconds: 30 })]),
  ] },
  602: { workoutName: 'Pull', ownerPlanDayId: 7002, sections: [
    section(null, 'Main', [
      ex(602, 0, 21, { sets: 3, reps: '5', restSeconds: 180, setTargets: work(3, { repsMin: 5, repsMax: 5, weightKg: 120, restSec: 180 }) }),
      ex(602, 1, 22, { reps: '8-10' }), ex(602, 2, 23, { reps: '10', weightSuggestion: '50 kg' }),
    ]),
    section('Arms', 'Superset', [ex(602, 3, 24, { reps: '15', restSeconds: 0 }), ex(602, 4, 25, { reps: '12', restSeconds: 0 })], 3, 60),
  ] },
  603: { workoutName: 'Legs', ownerPlanDayId: 7004, sections: [
    section(null, 'Main', [
      ex(603, 0, 31, { sets: 4, reps: '5', restSeconds: 180, setTargets: work(4, { repsMin: 5, repsMax: 5, weightKg: 95, restSec: 180 }) }),
      ex(603, 1, 32, { reps: '8' }), ex(603, 2, 33, { reps: '12' }),
    ]),
    section('Core', 'Cooldown', [ex(603, 3, 34, { sets: 3, reps: null, durationSeconds: 60, restSeconds: 45 })]),
  ] },
  604: { workoutName: 'Upper', ownerPlanDayId: 7005, sections: [
    section(null, 'Main', [ex(604, 0, 14, { reps: '6' }), ex(604, 1, 23, { reps: '8' })]),
    section('Pump', 'Superset', [ex(604, 2, 12, { reps: '12', restSeconds: 0 }), ex(604, 3, 22, { reps: '8', restSeconds: 0 })], 3, 90),
  ] },
  605: { workoutName: 'Conditioning', ownerPlanDayId: 7006, sections: [
    section('Engine', 'Circuit', [
      ex(605, 0, 41, { reps: '20', restSeconds: 0, weightSuggestion: '16 kg' }),
      ex(605, 1, 42, { reps: '10', restSeconds: 0 }),
      ex(605, 2, 43, { reps: null, durationSeconds: 60, restSeconds: 0 }),
    ], 4, 60),
  ] },
};
// Library workouts 1–4 reuse plan structures under their own names.
const LIBRARY: Record<number, A> = {
  1: { name: 'Upper Body Power', from: 604, difficulty: 'Intermediate', durationMin: 45 },
  2: { name: 'HIIT Fat Burner', from: 605, difficulty: 'Advanced', durationMin: 30 },
  3: { name: 'Mobility Flow', from: 603, difficulty: 'Beginner', durationMin: 25 },
  4: { name: 'Leg Day Builder', from: 603, difficulty: 'Intermediate', durationMin: 50 },
};

function structureOf(wid: number): A | null {
  const lib = LIBRARY[wid];
  const base = STRUCTURES[lib ? lib.from : wid];
  if (!base) return null;
  return {
    workoutId: wid, workoutName: lib ? lib.name : base.workoutName, ownerPlanDayId: lib ? null : base.ownerPlanDayId,
    sections: base.sections.map((s: A) => ({ ...s, exercises: s.exercises.map((e: A) => ({ ...e, workoutExerciseId: wid * 100 + (e.workoutExerciseId % 100) })) })),
  };
}

function workoutOf(wid: number): A | null {
  const lib = LIBRARY[wid];
  const s = structureOf(wid);
  if (!s) return null;
  return {
    id: wid, tenantId: 1, name: s.workoutName, description: lib ? 'Coach-built session with progressive overload.' : 'Your plan day — follow the targets and beat last time.',
    category: null, goal: 'MuscleGain', difficulty: lib?.difficulty ?? 'Intermediate', durationMin: lib?.durationMin ?? null,
    isPublic: !!lib, isAiGenerated: false, version: 1, tags: [], createdAt: new Date(Date.now() - 30 * DAY).toISOString(), exercises: [],
  };
}

// ── State ──
let nextLogId = 8100;
let nextSetId = 1;
const doneDays = new Map<string, number>();                 // "week-day" → logId
const overrides = new Map<string, { action: 'skip' | 'moved'; movedToDate: string | null }>();
const directAssignments: A[] = [
  { assignmentId: 7301, workoutId: 3, workoutName: 'Mobility Flow', trainerName: 'Vikram Rao', assignedAt: add(today(), -3), dueDate: add(today(), 2), status: 'Assigned', notes: 'Do this on a rest day — 20 minutes, easy pace.' },
];
const history: A[] = [];
const records: A[] = [];
const last: Record<number, A> = {};

const loggedSet = (exerciseId: number, setNo: number, reps: number | null, kg: number | null, extra: A = {}): A => ({
  id: nextSetId++, exerciseId, exerciseName: EX[exerciseId], workoutExerciseId: null, setNo, setType: 'normal',
  reps, weightKg: kg, rpe: null, durationSec: null, distanceM: null, completed: true, ...extra,
});

function bestOf(sets: A[]): A | null {
  const work = sets.filter(s => s.completed && s.setType !== 'warmup');
  return work.sort((a, b) => (b.weightKg ?? 0) - (a.weightKg ?? 0) || (b.reps ?? 0) - (a.reps ?? 0))[0] ?? null;
}

function saveLog(wid: number, name: string, startedAt: Date, minutes: number, sets: A[], plan: { week: number; day: number } | null, extra: A = {}): A {
  const logId = nextLogId++;
  const completed = sets.filter(s => s.completed);
  const log = {
    logId, workoutId: wid, workoutName: name, startedAt: startedAt.toISOString(), endedAt: new Date(startedAt.getTime() + minutes * 60_000).toISOString(),
    durationMin: minutes, sessionRpe: extra.sessionRpe ?? null, sets: completed.length, exercises: new Set(completed.map(s => s.exerciseId)).size,
    volumeKg: Math.round(completed.reduce((v, s) => v + (s.reps ?? 0) * (s.weightKg ?? 0), 0)), recordCount: 0,
    planAssignmentId: plan ? AID : null, weekNumber: plan?.week ?? null, dayNumber: plan?.day ?? null, notes: extra.notes ?? null,
    setLogs: sets, records: [] as A[],
  };
  history.unshift(log);
  history.sort((a, b) => (b.startedAt > a.startedAt ? 1 : -1));
  // Last performance per exercise.
  const byEx = new Map<number, A[]>();
  sets.forEach(s => { if (!byEx.has(s.exerciseId)) byEx.set(s.exerciseId, []); byEx.get(s.exerciseId)!.push(s); });
  byEx.forEach((list, exerciseId) => {
    last[exerciseId] = { exerciseId, exerciseName: EX[exerciseId] ?? null, logId, performedAt: log.startedAt, sets: list, bestSet: bestOf(list) };
  });
  if (plan) doneDays.set(`${plan.week}-${plan.day}`, logId);
  return log;
}

/** Updates records from a log's sets; returns the beaten ones (first-ever values are stored silently). */
function updateRecords(log: A): A[] {
  const beaten: A[] = [];
  const byEx = new Map<number, A[]>();
  log.setLogs.filter((s: A) => s.completed && s.setType !== 'warmup').forEach((s: A) => {
    if (!byEx.has(s.exerciseId)) byEx.set(s.exerciseId, []);
    byEx.get(s.exerciseId)!.push(s);
  });
  byEx.forEach((sets, exerciseId) => {
    const cands: { type: string; value: number; reps: number | null; weightKg: number | null }[] = [];
    const weighted = sets.filter(s => (s.weightKg ?? 0) > 0 && (s.reps ?? 0) > 0);
    if (weighted.length) {
      const heavy = weighted.reduce((a, b) => ((b.weightKg > a.weightKg) || (b.weightKg === a.weightKg && b.reps > a.reps) ? b : a));
      cands.push({ type: 'heaviestWeight', value: heavy.weightKg, reps: heavy.reps, weightKg: heavy.weightKg });
      const e1 = weighted.reduce((a, b) => (b.weightKg * (1 + b.reps / 30) > a.weightKg * (1 + a.reps / 30) ? b : a));
      cands.push({ type: 'estimatedOneRepMax', value: Math.round(e1.weightKg * (1 + e1.reps / 30) * 10) / 10, reps: e1.reps, weightKg: e1.weightKg });
      const vol = weighted.reduce((a, b) => (b.weightKg * b.reps > a.weightKg * a.reps ? b : a));
      cands.push({ type: 'bestSetVolume', value: vol.weightKg * vol.reps, reps: vol.reps, weightKg: vol.weightKg });
    } else {
      const reps = sets.filter(s => (s.reps ?? 0) > 0);
      if (reps.length) { const m = reps.reduce((a, b) => (b.reps > a.reps ? b : a)); cands.push({ type: 'mostReps', value: m.reps, reps: m.reps, weightKg: null }); }
    }
    cands.forEach(c => {
      const cur = records.find(r => r.exerciseId === exerciseId && r.type === c.type);
      const rec = { exerciseId, exerciseName: EX[exerciseId] ?? null, type: c.type, value: c.value, reps: c.reps, weightKg: c.weightKg, achievedAt: log.startedAt, workoutLogId: log.logId };
      if (!cur) { records.push(rec); return; }
      if (c.value > cur.value) {
        beaten.push({ exerciseId, exerciseName: rec.exerciseName, type: c.type, value: c.value, previousValue: cur.value, reps: c.reps, weightKg: c.weightKg });
        Object.assign(cur, rec);
      }
    });
  });
  log.records = records.filter(r => r.workoutLogId === log.logId);
  history.forEach(h => { h.recordCount = records.filter(r => r.workoutLogId === h.logId).length; });
  return beaten;
}

// Seed: an older plan's sessions, then week 1 (days 1, 2, 4, 5 done; day 6 missed).
(function seed() {
  const at = (date: string, h = 18) => { const d = parse(date); d.setHours(h, 10); return d; };
  const benchOld = [loggedSet(11, 1, 10, 40, { setType: 'warmup' }), loggedSet(11, 2, 8, 57.5), loggedSet(11, 3, 8, 57.5), loggedSet(11, 4, 7, 57.5)];
  updateRecords(saveLog(1, 'Upper Body Power', at(add(START, -12)), 52, [...benchOld, loggedSet(14, 1, 8, 37.5), loggedSet(14, 2, 8, 37.5)], null));
  updateRecords(saveLog(4, 'Leg Day Builder', at(add(START, -10)), 61, [loggedSet(31, 1, 5, 90), loggedSet(31, 2, 5, 90), loggedSet(31, 3, 5, 90), loggedSet(32, 1, 8, 70)], null));
  const days: [number, number, A[]][] = [
    [1, 58, [loggedSet(16, 1, 15, null, { setType: 'warmup' }), loggedSet(11, 1, 10, 40, { setType: 'warmup' }), loggedSet(11, 2, 8, 60), loggedSet(11, 3, 8, 60), loggedSet(11, 4, 7, 60),
      loggedSet(12, 1, 10, 20), loggedSet(13, 1, 12, 12.5), loggedSet(12, 2, 10, 20), loggedSet(13, 2, 12, 12.5), loggedSet(14, 1, 8, 40), loggedSet(14, 2, 8, 40), loggedSet(15, 1, 12, 25),
      loggedSet(34, 1, null, null, { durationSec: 45 })]],
    [2, 64, [loggedSet(21, 1, 5, 115), loggedSet(21, 2, 5, 115), loggedSet(21, 3, 5, 115), loggedSet(22, 1, 9, null), loggedSet(22, 2, 8, null), loggedSet(23, 1, 10, 50)]],
    [4, 66, [loggedSet(31, 1, 5, 92.5), loggedSet(31, 2, 5, 92.5), loggedSet(31, 3, 5, 92.5), loggedSet(31, 4, 5, 92.5), loggedSet(32, 1, 8, 72.5), loggedSet(33, 1, 12, 160)]],
    [5, 49, [loggedSet(14, 1, 6, 42.5), loggedSet(23, 1, 8, 55), loggedSet(12, 1, 12, 18), loggedSet(22, 1, 8, null)]],
  ];
  days.forEach(([day, min, sets]) => {
    const p = PATTERN[day - 1];
    updateRecords(saveLog(p.workoutId!, p.title!, at(add(START, day - 1), 7), min, sets, { week: 1, day }, { sessionRpe: 7 + (day % 3) }));
  });
})();

// ── Calendar ──
const posOf = (date: string) => { const i = diff(START, date); return { week: Math.floor(i / 7) + 1, day: (i % 7) + 1 }; };
const inPlan = (date: string) => date >= START && date <= END;

function entryFor(date: string, week: number, day: number, extra: A = {}): A {
  const p = PATTERN[day - 1];
  const logId = doneDays.get(`${week}-${day}`) ?? null;
  const t = today();
  const status = p.rest ? 'rest' : logId ? 'done' : date < t ? 'missed' : 'scheduled';
  return {
    date, weekNumber: week, dayNumber: day, dayId: 7000 + week * 10 + day, title: p.title, isRestDay: p.rest, workoutId: p.workoutId,
    status, isToday: date === t, movedToDate: null, movedFromDate: null, completedLogId: logId, ...extra,
  };
}

function entriesOn(date: string): A[] {
  const out: A[] = [];
  if (inPlan(date)) {
    const { week, day } = posOf(date);
    const base = entryFor(date, week, day);
    const o = overrides.get(date);
    if (o?.action === 'skip' && base.status !== 'done') out.push({ ...base, status: 'skipped' });
    else if (o?.action === 'moved' && base.status !== 'done') out.push({ ...base, status: 'moved', movedToDate: o.movedToDate });
    else out.push(base);
  }
  overrides.forEach((o, from) => {
    if (o.action === 'moved' && o.movedToDate === date) {
      const { week, day } = posOf(from);
      const e = entryFor(date, week, day, { movedFromDate: from });
      out.push(e);
    }
  });
  return out;
}

function adherence() {
  const t = today();
  let scheduled = 0, completed = 0, total = 0, totalDone = 0;
  for (let d = START; d <= END; d = add(d, 1)) {
    const { day } = posOf(d);
    if (PATTERN[day - 1].rest) continue;
    total++;
    const done = entriesOn(d).some(e => e.status === 'done') || [...overrides.entries()].some(([from, o]) => from === d && o.action === 'moved' && entriesOn(o.movedToDate!).some(e => e.movedFromDate === d && e.status === 'done'));
    if (done) totalDone++;
    if (d < t || (d === t && done)) { scheduled++; if (done) completed++; }
  }
  return { completed, scheduled, percent: scheduled ? Math.round((completed / scheduled) * 100) : null, totalWorkoutDays: total, completedWorkoutDays: totalDone };
}

function weekStrip(): A[] {
  const t = today();
  const dow = (parse(t).getDay() + 6) % 7;
  const monday = add(t, -dow);
  return Array.from({ length: 7 }, (_, i) => {
    const date = add(monday, i);
    const list = entriesOn(date);
    const moved = list.find(e => e.movedFromDate);
    const own = list.find(e => !e.movedFromDate);
    const e = moved && (!own || own.isRestDay || own.status === 'moved' || own.status === 'skipped') ? moved : own;
    const weekday = WEEKDAY[parse(date).getDay()];
    if (!e) return { date, weekday, isToday: date === t, inPlan: false, weekNumber: null, dayNumber: null, title: null, isRestDay: false, workoutId: null, done: false, skipped: false, moved: false, movedToDate: null, movedFromDate: null, status: 'none' };
    return {
      date, weekday, isToday: date === t, inPlan: true, weekNumber: e.weekNumber, dayNumber: e.dayNumber, title: e.title, isRestDay: e.isRestDay,
      workoutId: e.workoutId, done: e.status === 'done', skipped: e.status === 'skipped', moved: e.status === 'moved' || !!e.movedFromDate,
      movedToDate: e.movedToDate, movedFromDate: e.movedFromDate, status: e.status,
    };
  });
}

function myTraining(): A {
  const t = today();
  const list = entriesOn(t);
  const moved = list.find(e => e.movedFromDate);
  const own = list.find(e => !e.movedFromDate)!;
  const eff = moved && (own.isRestDay || own.status === 'moved' || own.status === 'skipped') ? moved : own;
  const pos = posOf(t);
  const active = eff.status !== 'moved' && eff.status !== 'skipped';
  return {
    activePlanAssignmentId: AID,
    workouts: directAssignments,
    plans: [{
      assignmentId: AID, planId: PLAN_ID, planName: 'Hypertrophy 4-Day Split', durationWeeks: WEEKS, startDate: START, endDate: END, status: 'InProgress',
      currentWeek: pos.week, currentDay: pos.day,
      todayWorkoutId: active ? eff.workoutId : null, todayWorkoutName: active ? eff.title : null,
      todayIsRest: eff.isRestDay || eff.status === 'moved', todayTitle: eff.title,
      todayWeekNumber: eff.weekNumber, todayDayNumber: eff.dayNumber,
      todayDone: eff.status === 'done', todaySkipped: eff.status === 'skipped',
      weekStrip: weekStrip(), adherence: adherence(),
    }],
  };
}

function calendar(query: URLSearchParams): A {
  const from = query.get('from') || START;
  const to = query.get('to') || add(from, 119);
  const entries: A[] = [];
  for (let d = from; d <= to; d = add(d, 1)) entries.push(...entriesOn(d));
  return { assignmentId: AID, planId: PLAN_ID, planName: 'Hypertrophy 4-Day Split', durationWeeks: WEEKS, startDate: START, endDate: END, status: 'InProgress', from, to, adherence: adherence(), entries };
}

function override(kind: 'skip' | 'move', body: A): A {
  const t = today();
  const date = String(body?.date ?? '');
  if (!inPlan(date)) return fail('That date is outside your plan.');
  if (date < t) return fail('You can only change today or later.');
  const e = entriesOn(date).find(x => !x.movedFromDate);
  if (!e || e.isRestDay) return fail('Rest days can’t be skipped or moved.');
  if (e.status === 'done') return fail('This day is already done.');
  if (kind === 'skip') {
    overrides.set(date, { action: 'skip', movedToDate: null });
    return ok({ id: Date.now(), assignmentId: AID, date, action: 'skip', movedToDate: null }, 'Day skipped.');
  }
  const toDate = String(body?.toDate ?? '');
  if (!toDate || toDate < t || toDate > add(END, 7) || toDate === date) return fail('Pick a day from today until a week after the plan ends.');
  overrides.set(date, { action: 'moved', movedToDate: toDate });
  return ok({ id: Date.now(), assignmentId: AID, date, action: 'moved', movedToDate: toDate }, 'Day moved.');
}

function complete(wid: number, body: A): A {
  const structure = structureOf(wid);
  if (!structure) return fail('Workout not found.');
  const sets: A[] = (body?.sets ?? []).map((s: A) => loggedSet(s.exerciseId, s.setNo, s.reps ?? null, s.weightKg ?? null, {
    workoutExerciseId: s.workoutExerciseId ?? null, setType: s.setType ?? 'normal', durationSec: s.durationSec ?? null, distanceM: s.distanceM ?? null,
    rpe: s.rpe ?? null, completed: s.completed !== false,
  }));
  if (sets.length === 0) return fail('Log at least one set.');
  const startedAt = new Date(body.startedAt ?? Date.now());
  const minutes = Math.max(1, Math.round((new Date(body.endedAt ?? Date.now()).getTime() - startedAt.getTime()) / 60_000));
  let plan: { week: number; day: number } | null = null;
  if (body.planAssignmentId === AID && body.week && body.day) plan = { week: body.week, day: body.day };
  else if (!body.assignmentId) {
    const tr = myTraining().plans[0];
    if (tr.todayWorkoutId === wid && !tr.todayDone) plan = { week: tr.todayWeekNumber, day: tr.todayDayNumber };
  }
  const log = saveLog(wid, structure.workoutName, startedAt, minutes, sets, plan, { sessionRpe: body.sessionRpe, notes: body.notes });
  const newRecords = updateRecords(log);
  const direct = directAssignments.find(a => a.assignmentId === body.assignmentId || (!plan && a.workoutId === wid && a.status === 'Assigned'));
  if (direct) direct.status = 'Completed';
  return ok({
    id: log.logId, logId: log.logId, clientId: 100, startedAt: log.startedAt, endedAt: log.endedAt, durationMin: minutes, score: null, calories: null,
    notes: log.notes, assignmentId: direct?.assignmentId ?? null, planAssignmentId: plan ? AID : null, weekNumber: plan?.week ?? null, dayNumber: plan?.day ?? null,
    summary: { sets: log.sets, exercises: log.exercises, volumeKg: log.volumeKg, durationMin: minutes },
    newRecords,
  }, newRecords.length ? `Workout logged — ${newRecords.length} new record${newRecords.length === 1 ? '' : 's'}!` : 'Workout logged.');
}

const strip = ({ setLogs: _s, records: _r, ...item }: A) => item;

export function memberTrainingRoute(method: string, path: string, body: unknown, query: URLSearchParams): unknown {
  const b = (body ?? {}) as A;
  if (path === '/me/training') return ok(myTraining());

  let m = /^\/me\/plans\/(\d+)\/(calendar|days\/skip|days\/move)$/.exec(path);
  if (m) {
    if (Number(m[1]) !== AID) return fail('Plan not found.');
    if (m[2] === 'calendar') return ok(calendar(query));
    if (method === 'post') return override(m[2] === 'days/skip' ? 'skip' : 'move', b);
  }
  m = /^\/me\/plans\/(\d+)\/days\/(\d{4}-\d{2}-\d{2})\/override$/.exec(path);
  if (m && method === 'delete') {
    if (m[2] < today()) return fail('You can only change today or later.');
    if (!overrides.delete(m[2])) return fail('Nothing to undo on that day.');
    return ok(null, 'Day restored.');
  }

  if (path === '/me/exercises/last') {
    const ids = (query.get('ids') ?? '').split(',').map(Number).filter(Boolean);
    return ok(ids.map(id => last[id]).filter(Boolean));
  }
  m = /^\/me\/exercises\/(\d+)\/last$/.exec(path);
  if (m) return ok(last[Number(m[1])] ?? null);

  if (path === '/me/records') {
    const exId = Number(query.get('exerciseId') ?? 0);
    return ok(records.filter(r => !exId || r.exerciseId === exId));
  }
  if (path === '/me/workout-history') {
    const pageNumber = Math.max(1, Number(query.get('page') ?? 1));
    const pageSize = Math.min(50, Math.max(1, Number(query.get('pageSize') ?? 20)));
    const items = history.slice((pageNumber - 1) * pageSize, pageNumber * pageSize).map(strip);
    return ok({ items, pageNumber, pageSize, totalRecords: history.length, totalPages: Math.max(1, Math.ceil(history.length / pageSize)) });
  }
  m = /^\/me\/workout-history\/(\d+)$/.exec(path);
  if (m) {
    const log = history.find(h => h.logId === Number(m![1]));
    return log ? ok({ ...log, records: records.filter(r => r.workoutLogId === log.logId) }) : fail('Workout log not found.');
  }

  m = /^\/workouts\/(\d+)(\/structure|\/complete)?$/.exec(path);
  if (m) {
    const wid = Number(m[1]);
    if (m[2] === '/complete' && method === 'post') return complete(wid, b);
    if (m[2] === '/structure' && method === 'get') { const s = structureOf(wid); return s ? ok(s) : fail('Workout not found.'); }
    if (!m[2] && method === 'get') { const w = workoutOf(wid); return w ? ok(w) : fail('Workout not found.'); }
  }
  return undefined;
}
