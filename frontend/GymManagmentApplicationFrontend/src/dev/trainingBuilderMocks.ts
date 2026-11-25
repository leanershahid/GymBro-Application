/**
 * Preview mocks for the staff side of training (weekly plan builder): plans, builder, day / week
 * operations, day workouts' structure, assign (with a PLAN_ALREADY_ACTIVE conflict), plan members, a
 * client copy's calendar + skip / move / undo, the workout library (DELETE of workout 1 answers
 * WORKOUT_IN_USE) and an exercise library with muscles / equipment. Stateful for the session, so a
 * walk-through works: create plan → edit a day → copy the week → assign.
 *
 * Conflicts come back as a 200 + `success: false` envelope with `code` (the mock adapter can't
 * throw); the API layer reads both forms.
 */
import type {
  BuilderDay, PlanBuilder, PlanMember, SectionType, StructureSection, WorkoutStructure, CalendarEntry,
} from '../features/training/api/training.types';

const ok = <T,>(data: T, message = 'OK') => ({ success: true, message, data, errors: null });
const fail = (message: string, code?: string, data: unknown = null) => ({ success: false, message, data, errors: null, code });
const page = <T,>(items: T[], pageNumber = 1, pageSize = 20) => ok({
  items: items.slice((pageNumber - 1) * pageSize, pageNumber * pageSize), pageNumber, pageSize,
  totalRecords: items.length, totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
});
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (s: string, n: number) => { const [y, m, d] = s.split('-').map(Number); return iso(new Date(y, m - 1, d + n)); };
const daysBetween = (a: string, b: string) => {
  const [y1, m1, d1] = a.split('-').map(Number); const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
};
const GOALS = ['WeightLoss', 'MuscleGain', 'Endurance', 'Flexibility', 'General', 'Rehab', 'Sport'];
const LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Elite'];
const enumName = (list: string[], v: unknown, fallback: string) => (typeof v === 'number' ? list[v] ?? fallback : typeof v === 'string' ? v : fallback);
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

// ─── Exercise library ────────────────────────────────────────────────────────
const EX: [number, string, string, string[], string[]][] = [
  [1, 'Barbell Back Squat', 'Strength', ['Quads', 'Glutes'], ['Barbell']],
  [2, 'Bench Press', 'Strength', ['Chest', 'Triceps'], ['Barbell', 'Bench']],
  [3, 'Pull-up', 'Strength', ['Lats', 'Biceps'], ['Pull-up bar']],
  [4, 'Romanian Deadlift', 'Strength', ['Hamstrings', 'Glutes'], ['Barbell']],
  [5, 'Overhead Press', 'Strength', ['Shoulders', 'Triceps'], ['Barbell']],
  [6, 'Dumbbell Row', 'Strength', ['Lats', 'Upper back'], ['Dumbbell', 'Bench']],
  [7, 'Walking Lunge', 'Strength', ['Quads', 'Glutes'], ['Dumbbell']],
  [8, 'Incline DB Press', 'Strength', ['Chest', 'Shoulders'], ['Dumbbell', 'Bench']],
  [9, 'Cable Face Pull', 'Strength', ['Rear delts'], ['Cable']],
  [10, 'Plank', 'Flexibility', ['Core'], []],
  [11, 'Rowing Machine', 'Cardio', ['Full body'], ['Rower']],
  [12, 'Assault Bike Sprint', 'Cardio', ['Full body'], ['Bike']],
  [13, 'Hip Thrust', 'Strength', ['Glutes'], ['Barbell', 'Bench']],
  [14, 'Lateral Raise', 'Strength', ['Shoulders'], ['Dumbbell']],
];
const exercises = EX.map(([id, name, category, muscles, equipment]) => ({
  id, name, slug: name.toLowerCase().replace(/\s+/g, '-'), description: null, instructions: null, category,
  difficulty: id % 3 === 0 ? 'Intermediate' : 'Beginner', videoUrl: null, thumbnailUrl: null, isCustom: false,
  tags: [category.toLowerCase(), ...(id % 2 ? ['compound'] : ['accessory'])],
  muscles: muscles.map((m, i) => ({ id: id * 10 + i, name: m, role: i ? 'secondary' : 'primary' })),
  equipment: equipment.map((q, i) => ({ id: id * 10 + i, name: q, category: null })),
  createdAt: new Date().toISOString(),
}));
const exName = (id: number) => exercises.find(e => e.id === id)?.name ?? `Exercise #${id}`;

// ─── Workouts (library + day workouts) ───────────────────────────────────────
let rowSeq = 1;
const ex = (exerciseId: number, sets: number, reps: string, rest = 90, kg: number | null = null) => {
  const [min, max] = reps.split('-').map(Number);
  return {
    workoutExerciseId: rowSeq++, exerciseId, exerciseName: exName(exerciseId), sets, reps, durationSeconds: null, restSeconds: rest,
    tempo: null, weightSuggestion: null, notes: null,
    setTargets: Array.from({ length: sets }, (_, i) => ({ setNo: i + 1, type: 'normal' as const, repsMin: min, repsMax: max || min, weightKg: kg, rpe: null, durationSec: null, distanceM: null, restSec: rest })),
  };
};
const section = (type: SectionType, exs: ReturnType<typeof ex>[], name: string | null = null, rounds = 1, rest: number | null = null): StructureSection =>
  ({ name, type, rounds, restSeconds: rest, exercises: exs });

interface MockWorkout { id: number; name: string; goal: string; difficulty: string; durationMin: number | null; ownerPlanDayId: number | null; sections: StructureSection[] }
const workouts: MockWorkout[] = [
  { id: 1, name: 'Upper Body Power', goal: 'MuscleGain', difficulty: 'Intermediate', durationMin: 45, ownerPlanDayId: null,
    sections: [section('Main', [ex(2, 4, '6-8', 120, 60), ex(3, 4, '8', 90)]), section('Superset', [ex(5, 3, '10', 0), ex(6, 3, '12', 60)], 'Finisher', 3, 90)] },
  { id: 2, name: 'HIIT Fat Burner', goal: 'WeightLoss', difficulty: 'Advanced', durationMin: 30, ownerPlanDayId: null,
    sections: [section('Circuit', [ex(12, 1, '1', 30), ex(7, 1, '12', 30), ex(10, 1, '1', 30)], 'Circuit', 4, 60)] },
  { id: 3, name: 'Mobility Flow', goal: 'General', difficulty: 'Beginner', durationMin: 25, ownerPlanDayId: null, sections: [section('Main', [ex(10, 3, '1', 30)])] },
  { id: 4, name: 'Leg Day Builder', goal: 'MuscleGain', difficulty: 'Intermediate', durationMin: 50, ownerPlanDayId: null,
    sections: [section('Main', [ex(1, 5, '5', 150, 80), ex(4, 3, '8-10', 120, 60)]), section('Main', [ex(13, 3, '10-12', 90), ex(7, 3, '10', 60)])] },
];
let workoutSeq = 1000;
const workoutById = (id: number) => workouts.find(w => w.id === id);
const newDayWorkout = (name: string, sections: StructureSection[] = []): MockWorkout => {
  const w: MockWorkout = { id: ++workoutSeq, name, goal: 'General', difficulty: 'Beginner', durationMin: null, ownerPlanDayId: null, sections: clone(sections) };
  workouts.push(w);
  return w;
};

// ─── Plans ───────────────────────────────────────────────────────────────────
interface MockDay { dayId: number | null; title: string | null; notes: string | null; isRestDay: boolean; workoutId: number | null }
interface MockWeek { notes: string | null; days: MockDay[] }
interface MockPlan {
  id: number; name: string; description: string | null; goal: string; difficulty: string; isActive: boolean; isTemplate: boolean;
  sourcePlanId: number | null; ownerClientId: number | null; ownerClientName: string | null; daysPerWeekHint: number | null;
  createdAt: string; weeks: MockWeek[];
}
interface MockAssignment { id: number; planId: number; sourcePlanId: number; clientId: number; clientName: string; startDate: string; status: PlanMember['status']; createdAt: string }

let planSeq = 10;
let daySeq = 5000;
let assignSeq = 900;
const blankWeek = (): MockWeek => ({ notes: null, days: Array.from({ length: 7 }, () => ({ dayId: null, title: null, notes: null, isRestDay: false, workoutId: null })) });

const seedWeek = (): MockWeek => {
  const w = blankWeek();
  const fill = (d: number, title: string, src: number) => {
    const wk = newDayWorkout(title, workoutById(src)?.sections ?? []);
    w.days[d - 1] = { dayId: ++daySeq, title, notes: null, isRestDay: false, workoutId: wk.id };
    wk.ownerPlanDayId = daySeq;
  };
  fill(1, 'Upper', 1); fill(2, 'Lower', 4);
  w.days[2] = { dayId: ++daySeq, title: null, notes: null, isRestDay: true, workoutId: null };
  fill(4, 'Conditioning', 2); fill(5, 'Full body', 4);
  w.days[5] = { dayId: ++daySeq, title: null, notes: null, isRestDay: true, workoutId: null };
  w.days[6] = { dayId: ++daySeq, title: null, notes: null, isRestDay: true, workoutId: null };
  return w;
};

const plans: MockPlan[] = [
  { id: 1, name: '12-Week Strength Base', description: 'Four training days a week with progressive overload.', goal: 'MuscleGain', difficulty: 'Intermediate',
    isActive: true, isTemplate: true, sourcePlanId: null, ownerClientId: null, ownerClientName: null, daysPerWeekHint: 4,
    createdAt: new Date(Date.now() - 40 * 86_400_000).toISOString(), weeks: [seedWeek(), blankWeek(), blankWeek(), blankWeek()] },
  { id: 2, name: 'Fat-loss Kickstart', description: null, goal: 'WeightLoss', difficulty: 'Beginner', isActive: true, isTemplate: true,
    sourcePlanId: null, ownerClientId: null, ownerClientName: null, daysPerWeekHint: 3,
    createdAt: new Date(Date.now() - 10 * 86_400_000).toISOString(), weeks: [blankWeek(), blankWeek()] },
];
const assignments: MockAssignment[] = [];
const overrides = new Map<string, { action: 'skip' | 'moved'; movedToDate: string | null }>();

const NAMES: Record<number, string> = { 100: 'Aarav Mehta', 101: 'Sara Khan', 102: 'Rohan Das', 103: 'Meera Nair', 104: 'Kabir Shah', 105: 'Ananya Iyer' };

/** Deep copy of a plan (every day gets its own workout copy). */
function copyPlan(src: MockPlan, patch: Partial<MockPlan>): MockPlan {
  const p: MockPlan = { ...clone(src), id: ++planSeq, createdAt: new Date().toISOString(), ...patch };
  p.weeks = src.weeks.map(w => ({ notes: w.notes, days: w.days.map(d => copyDayInto(d)) }));
  plans.push(p);
  return p;
}
function copyDayInto(d: MockDay): MockDay {
  const src = d.workoutId ? workoutById(d.workoutId) : undefined;
  const dayId = d.dayId ? ++daySeq : null;
  const wk = src ? newDayWorkout(src.name, src.sections) : null;
  if (wk) wk.ownerPlanDayId = dayId;
  return { dayId, title: d.title, notes: d.notes, isRestDay: d.isRestDay, workoutId: wk?.id ?? null };
}

// Seed: Sara (101) is already on a copy of plan 1 (started 9 days ago) → assigning her again conflicts.
(() => {
  const copy = copyPlan(plans[0], { isTemplate: false, sourcePlanId: 1, ownerClientId: 101, ownerClientName: NAMES[101] });
  assignments.push({ id: ++assignSeq, planId: copy.id, sourcePlanId: 1, clientId: 101, clientName: NAMES[101], startDate: addDays(iso(new Date()), -9), status: 'InProgress', createdAt: new Date().toISOString() });
})();

function estMinutes(sections: StructureSection[]): number | null {
  let sec = 0;
  for (const s of sections) for (const e of s.exercises) {
    const sets = e.setTargets?.length ?? e.sets ?? 1;
    sec += (s.rounds || 1) * sets * (40 + (e.setTargets?.[0]?.restSec ?? e.restSeconds ?? 60));
  }
  return sec ? Math.max(5, Math.round(sec / 60 / 5) * 5) : null;
}

function toBuilderDay(p: MockPlan, w: number, d: number): BuilderDay {
  const day = p.weeks[w - 1].days[d - 1];
  const wk = day.workoutId ? workoutById(day.workoutId) : undefined;
  const sections = wk?.sections ?? [];
  const names = sections.flatMap(s => s.exercises.map(e => e.exerciseName ?? exName(e.exerciseId)));
  return {
    dayId: day.dayId, weekNumber: w, dayNumber: d, title: day.title, notes: day.notes, isRestDay: day.isRestDay,
    workoutId: day.workoutId, workoutName: wk?.name ?? null, ownsWorkout: !!wk, sectionCount: sections.length,
    exerciseCount: names.length, exerciseNames: names.slice(0, 12),
    hasSuperset: sections.some(s => s.type === 'Superset' || s.type === 'Circuit'), estimatedMinutes: estMinutes(sections),
  };
}

const today = () => iso(new Date());
function memberOf(a: MockAssignment): PlanMember {
  const p = plans.find(x => x.id === a.planId)!;
  const weeks = p.weeks.length;
  const idx = daysBetween(a.startDate, today());
  const inPlan = idx >= 0 && idx < weeks * 7;
  const done = Math.max(0, Math.min(idx, weeks * 7));
  const scheduled = Array.from({ length: done }, (_, i) => p.weeks[Math.floor(i / 7)]?.days[i % 7]).filter(d => d && !d.isRestDay && d.workoutId).length;
  const completed = Math.round(scheduled * 0.8);
  return {
    assignmentId: a.id, clientId: a.clientId, clientName: a.clientName, planId: a.planId, planName: p.name, sourcePlanId: a.sourcePlanId,
    startDate: a.startDate, endDate: addDays(a.startDate, weeks * 7 - 1), status: a.status,
    currentWeek: inPlan ? Math.floor(idx / 7) + 1 : null, currentDay: inPlan ? (idx % 7) + 1 : null,
    adherence: { completed, scheduled, percent: scheduled ? Math.round((completed / scheduled) * 100) : null, totalWorkoutDays: 0, completedWorkoutDays: completed },
    lastWorkoutAt: scheduled ? new Date(Date.now() - 86_400_000).toISOString() : null, createdAt: a.createdAt,
  };
}

function toBuilder(p: MockPlan): PlanBuilder {
  const a = assignments.find(x => x.planId === p.id);
  return {
    planId: p.id, name: p.name, description: p.description, goal: p.goal, difficulty: p.difficulty, durationWeeks: p.weeks.length,
    daysPerWeekHint: p.daysPerWeekHint, isTemplate: p.isTemplate, isActive: p.isActive, sourcePlanId: p.sourcePlanId,
    ownerClientId: p.ownerClientId, ownerClientName: p.ownerClientName, createdBy: 2, canEdit: true,
    clientAssignment: !p.isTemplate && a ? memberOf(a) : null,
    weeks: p.weeks.map((w, wi) => ({ weekNumber: wi + 1, notes: w.notes, days: w.days.map((_, di) => toBuilderDay(p, wi + 1, di + 1)) })),
  };
}

const planRow = (p: MockPlan) => ({
  id: p.id, tenantId: 1, name: p.name, description: p.description, durationWeeks: p.weeks.length, goal: p.goal, difficulty: p.difficulty,
  isActive: p.isActive, isTemplate: p.isTemplate, sourcePlanId: p.sourcePlanId, ownerClientId: p.ownerClientId, daysPerWeekHint: p.daysPerWeekHint,
  createdBy: 2, createdAt: p.createdAt,
});
const workoutRow = (w: MockWorkout) => ({
  id: w.id, tenantId: 1, name: w.name, description: 'Coach-built session with progressive overload.', category: null, goal: w.goal, difficulty: w.difficulty,
  durationMin: w.durationMin, isPublic: true, isAiGenerated: false, version: 1, tags: [], createdAt: new Date().toISOString(),
});

function findDay(p: MockPlan, dayId: number) {
  for (let wi = 0; wi < p.weeks.length; wi++) {
    const di = p.weeks[wi].days.findIndex(d => d.dayId === dayId);
    if (di >= 0) return { w: wi + 1, d: di + 1, day: p.weeks[wi].days[di] };
  }
  return null;
}

/** Replaces a day's content with a copy of `src` (keeps the target's own id). */
function replaceDay(p: MockPlan, w: number, d: number, src: MockDay) {
  const c = copyDayInto(src);
  p.weeks[w - 1].days[d - 1] = { ...c, dayId: p.weeks[w - 1].days[d - 1].dayId ?? c.dayId ?? ++daySeq };
}

function calendar(a: MockAssignment, from: string, to: string) {
  const p = plans.find(x => x.id === a.planId)!;
  const m = memberOf(a);
  const entries: CalendarEntry[] = [];
  for (let date = from; daysBetween(date, to) >= 0; date = addDays(date, 1)) {
    const idx = daysBetween(a.startDate, date);
    if (idx < 0 || idx >= p.weeks.length * 7) continue;
    const w = Math.floor(idx / 7) + 1; const d = (idx % 7) + 1;
    const day = p.weeks[w - 1].days[d - 1];
    const o = overrides.get(`${a.id}:${date}`);
    const past = daysBetween(date, today()) > 0;
    const rest = day.isRestDay || !day.workoutId;
    entries.push({
      date, weekNumber: w, dayNumber: d, dayId: day.dayId, title: day.title ?? workoutById(day.workoutId ?? 0)?.name ?? null, isRestDay: rest,
      workoutId: day.workoutId, status: rest ? 'rest' : o?.action === 'skip' ? 'skipped' : o?.action === 'moved' ? 'moved' : past ? 'done' : 'scheduled',
      isToday: date === today(), movedToDate: o?.movedToDate ?? null, movedFromDate: null, completedLogId: null,
    });
  }
  for (const [k, o] of overrides) {
    const [aid, date] = k.split(':');
    if (Number(aid) !== a.id || o.action !== 'moved' || !o.movedToDate || daysBetween(from, o.movedToDate) < 0 || daysBetween(o.movedToDate, to) < 0) continue;
    const src = entries.find(e => e.date === date);
    if (src) entries.push({ ...src, date: o.movedToDate, status: 'scheduled', movedToDate: null, movedFromDate: date, isToday: o.movedToDate === today() });
  }
  entries.sort((x, y) => x.date.localeCompare(y.date));
  return { assignmentId: a.id, planId: p.id, planName: p.name, durationWeeks: p.weeks.length, startDate: a.startDate, endDate: m.endDate, status: a.status, from, to, adherence: m.adherence!, entries };
}

// ─── Router ──────────────────────────────────────────────────────────────────
type Body = Record<string, unknown> | undefined;

export function trainingBuilderRoute(method: string, path: string, rawBody: unknown, query: URLSearchParams): unknown {
  const body = (rawBody ?? {}) as Body & Record<string, unknown>;
  let m: RegExpExecArray | null;

  // Exercise library
  if (path === '/exercises' && method === 'get') return page(exercises, Number(query.get('pageNumber') ?? 1), Number(query.get('pageSize') ?? 20));

  // Workouts
  if (path === '/workouts' && method === 'get') return page(workouts.filter(w => w.ownerPlanDayId === null).map(workoutRow), Number(query.get('pageNumber') ?? 1), Number(query.get('pageSize') ?? 20));
  if ((m = /^\/workouts\/(\d+)\/structure$/.exec(path))) {
    const w = workoutById(Number(m[1]));
    if (!w) return fail('Workout not found.');
    if (method === 'put') {
      const s = body as unknown as WorkoutStructure;
      w.sections = (s.sections ?? []).map(sec => ({
        ...sec, exercises: sec.exercises.map(e => ({ ...e, workoutExerciseId: rowSeq++, exerciseName: exName(e.exerciseId), setTargets: (e.setTargets ?? []).map((t, i) => ({ ...t, setNo: i + 1 })) })),
      }));
    }
    return ok({ workoutId: w.id, workoutName: w.name, ownerPlanDayId: w.ownerPlanDayId, sections: w.sections }, method === 'put' ? 'Workout saved.' : 'OK');
  }
  if ((m = /^\/workouts\/(\d+)$/.exec(path))) {
    const id = Number(m[1]);
    const w = workoutById(id);
    if (method === 'delete') {
      if (id === 1) return fail('This workout is still in use.', 'WORKOUT_IN_USE', { planDays: 3, assignments: 1, logs: 12 });
      const i = workouts.findIndex(x => x.id === id);
      if (i >= 0) workouts.splice(i, 1);
      return ok(null, 'Workout deleted.');
    }
    if (method === 'get' && w && w.ownerPlanDayId !== null) return ok(workoutRow(w));
  }

  if (!path.startsWith('/plans')) return undefined;

  // Plans list / create
  if (path === '/plans') {
    if (method === 'post') {
      const weeks = Math.max(1, Math.min(52, Number(body.durationWeeks) || 4));
      const p: MockPlan = {
        id: ++planSeq, name: String(body.name ?? 'New plan'), description: (body.description as string) ?? null,
        goal: enumName(GOALS, body.goal, 'General'), difficulty: enumName(LEVELS, body.difficulty, 'Beginner'), isActive: true, isTemplate: true,
        sourcePlanId: null, ownerClientId: null, ownerClientName: null, daysPerWeekHint: (body.daysPerWeekHint as number) ?? null,
        createdAt: new Date().toISOString(), weeks: Array.from({ length: weeks }, blankWeek),
      };
      plans.push(p);
      return ok(planRow(p), 'Plan created.');
    }
    const copies = query.get('includeClientCopies') === 'true';
    const list = plans.filter(p => p.isActive && (copies || p.isTemplate)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return page(list.map(planRow), Number(query.get('pageNumber') ?? 1), Number(query.get('pageSize') ?? 20));
  }

  // Client copy (by assignment)
  if ((m = /^\/plans\/assignments\/(\d+)\/(builder|calendar|days\/skip|days\/move|days\/([\d-]+)\/override)$/.exec(path))) {
    const a = assignments.find(x => x.id === Number(m![1]));
    if (!a) return fail('Assignment not found.');
    const p = plans.find(x => x.id === a.planId)!;
    if (m[2] === 'builder') return ok(toBuilder(p));
    if (m[2] === 'calendar') return ok(calendar(a, query.get('from') || a.startDate, query.get('to') || addDays(a.startDate, p.weeks.length * 7 - 1)));
    const date = String(body.date ?? '');
    if (m[2] === 'days/skip') { overrides.set(`${a.id}:${date}`, { action: 'skip', movedToDate: null }); return ok({ id: 1, assignmentId: a.id, date, action: 'skip', movedToDate: null }); }
    if (m[2] === 'days/move') { overrides.set(`${a.id}:${date}`, { action: 'moved', movedToDate: String(body.toDate) }); return ok({ id: 2, assignmentId: a.id, date, action: 'moved', movedToDate: body.toDate }); }
    overrides.delete(`${a.id}:${m[3]}`);
    return ok(null, 'Undone.');
  }

  if (!(m = /^\/plans\/(\d+)(\/.*)?$/.exec(path))) return undefined;
  const plan = plans.find(p => p.id === Number(m![1]));
  if (!plan) return fail('Plan not found.');
  const rest = m[2] ?? '';

  if (rest === '') {
    if (method === 'put') {
      if (body.name !== undefined) plan.name = String(body.name);
      if (body.description !== undefined) plan.description = (body.description as string) || null;
      if (body.goal !== undefined) plan.goal = enumName(GOALS, body.goal, plan.goal);
      if (body.difficulty !== undefined) plan.difficulty = enumName(LEVELS, body.difficulty, plan.difficulty);
      if (body.daysPerWeekHint !== undefined) plan.daysPerWeekHint = Number(body.daysPerWeekHint) || null;
      return ok(planRow(plan), 'Plan updated.');
    }
    if (method === 'delete') { plan.isActive = false; return ok(null, 'Plan deleted.'); }
    return ok(planRow(plan));
  }
  if (rest === '/builder') return ok(toBuilder(plan));
  if (rest === '/analytics') {
    const n = assignments.filter(a => a.sourcePlanId === plan.id || a.planId === plan.id).length;
    return ok({ planId: plan.id, totalAssigned: n, completed: 0, inProgress: n, completionRate: 0 });
  }
  if (rest === '/members') return ok(assignments.filter(a => a.sourcePlanId === plan.id || a.planId === plan.id).map(memberOf));
  if (rest === '/duplicate') {
    const c = copyPlan(plan, { name: (body.name as string) || `${plan.name} (copy)`, isTemplate: true, sourcePlanId: null, ownerClientId: null, ownerClientName: null });
    return ok(toBuilder(c), 'Plan duplicated.');
  }
  if (rest === '/assign') {
    const ids = (body.memberIds as number[]) ?? [];
    const conflicts = assignments.filter(a => ids.includes(a.clientId) && (a.status === 'Assigned' || a.status === 'InProgress'));
    if (conflicts.length && !body.replaceExisting) {
      return fail('Some members already have an active plan.', 'PLAN_ALREADY_ACTIVE', conflicts.map(a => ({
        clientId: a.clientId, clientName: a.clientName, assignmentId: a.id, planName: plans.find(p => p.id === a.planId)?.name ?? 'Plan', startDate: a.startDate,
      })));
    }
    conflicts.forEach(a => { a.status = 'Expired'; });
    const offset = ((Number(body.startWeek) || 1) - 1) * 7 + ((Number(body.startDay) || 1) - 1);
    const out = ids.map(clientId => {
      const name = NAMES[clientId] ?? `Member #${clientId}`;
      const copy = copyPlan(plan, { isTemplate: false, sourcePlanId: plan.id, ownerClientId: clientId, ownerClientName: name });
      const a: MockAssignment = { id: ++assignSeq, planId: copy.id, sourcePlanId: plan.id, clientId, clientName: name, startDate: addDays(String(body.startDate ?? today()), -offset), status: 'Assigned', createdAt: new Date().toISOString() };
      assignments.push(a);
      return memberOf(a);
    });
    return ok(out, 'Plan assigned.');
  }

  // Weeks
  if (rest === '/weeks' && method === 'post') {
    const from = body.copyFrom as number | null | undefined;
    plan.weeks.push(from ? { notes: null, days: plan.weeks[from - 1].days.map(copyDayInto) } : blankWeek());
    return ok(toBuilder(plan), 'Week added.');
  }
  if ((m = /^\/weeks\/(\d+)\/copy$/.exec(rest))) {
    const src = Number(m[1]);
    for (const t of (body.toWeeks as number[]) ?? []) {
      while (plan.weeks.length < t) plan.weeks.push(blankWeek());
      plan.weeks[src - 1].days.forEach((d, di) => replaceDay(plan, t, di + 1, d));
    }
    return ok(toBuilder(plan), 'Week copied.');
  }
  if ((m = /^\/weeks\/(\d+)$/.exec(rest)) && method === 'delete') {
    if (plan.weeks.length <= 1) return fail('A plan needs at least one week.');
    plan.weeks.splice(Number(m[1]) - 1, 1);
    return ok(toBuilder(plan), 'Week deleted.');
  }
  // Days
  if ((m = /^\/weeks\/(\d+)\/days\/(\d+)$/.exec(rest)) && method === 'put') {
    const w = Number(m[1]); const d = Number(m[2]);
    const day = plan.weeks[w - 1]?.days[d - 1];
    if (!day) return fail('Day not found.');
    day.dayId = day.dayId ?? ++daySeq;
    day.title = (body.title as string) ?? null;
    day.notes = (body.notes as string) ?? null;
    day.isRestDay = !!body.isRestDay;
    if (!day.isRestDay && !day.workoutId) { const wk = newDayWorkout(day.title ?? `Week ${w} day ${d}`); wk.ownerPlanDayId = day.dayId; day.workoutId = wk.id; }
    if (day.workoutId && day.title) { const wk = workoutById(day.workoutId); if (wk) wk.name = day.title; }
    return ok(toBuilderDay(plan, w, d), 'Day saved.');
  }
  if ((m = /^\/days\/(\d+)\/(copy|from-library|content)$/.exec(rest))) {
    const found = findDay(plan, Number(m[1]));
    if (!found) return fail('Day not found.');
    if (m[2] === 'copy') {
      for (const t of (body.targets as { week: number; day: number }[]) ?? []) {
        while (plan.weeks.length < t.week) plan.weeks.push(blankWeek());
        replaceDay(plan, t.week, t.day, found.day);
      }
      return ok(toBuilder(plan), 'Day copied.');
    }
    if (m[2] === 'from-library') {
      const lib = workoutById(Number(body.workoutId));
      if (!lib) return fail('Workout not found.');
      if (!found.day.workoutId) { const wk = newDayWorkout(found.day.title ?? lib.name); found.day.workoutId = wk.id; }
      const wk = workoutById(found.day.workoutId)!;
      wk.sections = body.append ? [...wk.sections, ...clone(lib.sections)] : clone(lib.sections);
      found.day.isRestDay = false;
      return ok(toBuilderDay(plan, found.w, found.d), 'Workout added.');
    }
    const wk = found.day.workoutId ? workoutById(found.day.workoutId) : undefined;
    if (wk) wk.sections = [];
    return ok(toBuilderDay(plan, found.w, found.d), 'Day cleared.');
  }
  return undefined;
}
