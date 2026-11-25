// Pure helpers for the plan builder and the day editor (unit-tested in __tests__/builderUtils.test.ts).
import type {
  BuilderDay, PlanBuilder, PlanDayRef, SectionType, SetTarget, SetType, StructureExercise, StructureSection, WorkoutStructure,
} from '../api/training.types';

// ─── Plan / days ──────────────────────────────────────────────────────────────

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const weekdayOf = (dayNumber: number) => WEEKDAYS[(dayNumber - 1 + 7) % 7];

/** "Push", else "Day 3". */
export const dayTitle = (d: Pick<BuilderDay, 'title' | 'dayNumber'>) => (d.title?.trim() ? d.title.trim() : `Day ${d.dayNumber}`);

/** True when the day has nothing on it (not rest, no exercises). */
export const isEmptyDay = (d: BuilderDay) => !d.isRestDay && d.exerciseCount === 0;

/** Training days per week (most of any week), for the plan cards / header. */
export function trainingDaysPerWeek(b: Pick<PlanBuilder, 'weeks' | 'daysPerWeekHint'>): number {
  const counted = Math.max(0, ...b.weeks.map(w => w.days.filter(d => !d.isRestDay && d.exerciseCount > 0).length));
  return counted || b.daysPerWeekHint || 0;
}

export const dayKey = (week: number, day: number) => `${week}-${day}`;

/** Selected "week-day" keys → copy targets in plan order (the source day itself is never a target). */
export function dayCopyTargets(selected: Iterable<string>, source?: PlanDayRef): PlanDayRef[] {
  const out: PlanDayRef[] = [];
  for (const k of selected) {
    const [w, d] = k.split('-').map(Number);
    if (!Number.isInteger(w) || !Number.isInteger(d) || w < 1 || d < 1 || d > 7) continue;
    if (source && source.week === w && source.day === d) continue;
    if (!out.some(t => t.week === w && t.day === d)) out.push({ week: w, day: d });
  }
  return out.sort((a, b) => a.week - b.week || a.day - b.day);
}

export interface WeekOption { week: number; isNew: boolean }

/**
 * Weeks a week can be copied to: every other week of the plan, then up to `extra` new weeks past
 * the end (the server extends the plan), never beyond 52.
 */
export function weekCopyOptions(totalWeeks: number, source: number, extra = 1): WeekOption[] {
  const out: WeekOption[] = [];
  for (let w = 1; w <= totalWeeks; w++) if (w !== source) out.push({ week: w, isNew: false });
  for (let w = totalWeeks + 1; w <= Math.min(52, totalWeeks + extra); w++) out.push({ week: w, isNew: true });
  return out;
}

/** "Copy to all remaining weeks" helper: every week after `source`. */
export const laterWeeks = (totalWeeks: number, source: number) =>
  Array.from({ length: Math.max(0, totalWeeks - source) }, (_, i) => source + 1 + i);

// ─── Day editor draft ─────────────────────────────────────────────────────────

/** One row of an exercise's set table (strings for the inputs). */
export interface SetRow {
  key: string;
  type: SetType;
  /** "10" or "8-12" (blank = none) */
  reps: string;
  kg: string;
  rpe: string;
  /** seconds */
  rest: string;
  /** seconds */
  time: string;
  /** metres */
  dist: string;
}

export interface DraftExercise {
  key: string;
  exerciseId: number;
  name: string;
  showTime: boolean;
  showDist: boolean;
  notes: string;
  tempo: string;
  weightSuggestion: string;
  /** Old free-text reps that don't fit a number/range (e.g. "AMRAP"), kept as-is. */
  legacyReps: string | null;
  rows: SetRow[];
}

export interface DraftBlock {
  key: string;
  name: string;
  type: SectionType;
  rounds: string;
  rest: string;
  exercises: DraftExercise[];
}

/** The block kinds offered in the editor (others loaded from older data are kept). */
export const BLOCK_KINDS: { type: SectionType; label: string }[] = [
  { type: 'Main', label: 'Single' },
  { type: 'Superset', label: 'Superset' },
  { type: 'Circuit', label: 'Circuit' },
  { type: 'Warmup', label: 'Warm-up' },
  { type: 'Cooldown', label: 'Cool-down' },
];
export const blockLabel = (t: SectionType) => BLOCK_KINDS.find(k => k.type === t)?.label ?? t;
export const isGroupBlock = (t: SectionType) => t === 'Superset' || t === 'Circuit';

let seq = 0;
export const nextKey = () => `k${++seq}`;

const str = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));

export function repsText(min?: number | null, max?: number | null): string {
  if (min == null && max == null) return '';
  if (min != null && max != null && max !== min) return `${min}-${max}`;
  return String(min ?? max);
}

/** "10" → 10/10, "8-12" → 8/12, "" → nulls; anything else → null (invalid). */
export function parseReps(s: string): { min: number | null; max: number | null } | null {
  const t = s.trim();
  if (!t) return { min: null, max: null };
  const m = /^(\d{1,4})(?:\s*[-–]\s*(\d{1,4}))?$/.exec(t);
  if (!m) return null;
  const min = Number(m[1]);
  const max = m[2] !== undefined ? Number(m[2]) : min;
  return { min, max };
}

export const SET_TYPES: SetType[] = ['normal', 'warmup', 'drop', 'failure'];
export const nextSetType = (t: SetType): SetType => SET_TYPES[(SET_TYPES.indexOf(t) + 1) % SET_TYPES.length];
/** Short marker for the set column: number for normal sets, W / D / F otherwise. */
export const setMarker = (t: SetType, n: number) => (t === 'warmup' ? 'W' : t === 'drop' ? 'D' : t === 'failure' ? 'F' : String(n));

export const blankRow = (): SetRow => ({ key: nextKey(), type: 'normal', reps: '10', kg: '', rpe: '', rest: '60', time: '', dist: '' });

/** "+ Set": a copy of the last row (a fresh default when there are none). Max 20 sets. */
export function addSetRow(rows: SetRow[]): SetRow[] {
  if (rows.length >= MAX_SETS) return rows;
  const last = rows[rows.length - 1];
  return [...rows, last ? { ...last, key: nextKey(), type: last.type === 'warmup' ? 'normal' : last.type } : blankRow()];
}

/** Removes a row; an exercise keeps at least one. */
export function removeSetRow(rows: SetRow[], key: string): SetRow[] {
  return rows.length <= 1 ? rows : rows.filter(r => r.key !== key);
}

const targetToRow = (t: SetTarget): SetRow => ({
  key: nextKey(), type: t.type ?? 'normal', reps: repsText(t.repsMin, t.repsMax), kg: str(t.weightKg), rpe: str(t.rpe),
  rest: str(t.restSec), time: str(t.durationSec), dist: str(t.distanceM),
});

export function exerciseToDraft(e: StructureExercise): DraftExercise {
  let rows: SetRow[];
  let legacyReps: string | null = null;
  if (e.setTargets && e.setTargets.length) {
    rows = e.setTargets.map(targetToRow);
  } else {
    const parsed = parseReps(e.reps ?? '');
    if (!parsed) legacyReps = e.reps;
    const n = Math.min(MAX_SETS, Math.max(1, e.sets ?? 1));
    rows = Array.from({ length: n }, () => ({
      key: nextKey(), type: 'normal' as SetType, reps: parsed ? repsText(parsed.min, parsed.max) : '', kg: '', rpe: '',
      rest: str(e.restSeconds), time: str(e.durationSeconds), dist: '',
    }));
  }
  return {
    key: nextKey(), exerciseId: e.exerciseId, name: e.exerciseName ?? `Exercise #${e.exerciseId}`,
    showTime: rows.some(r => r.time !== ''), showDist: rows.some(r => r.dist !== ''),
    notes: e.notes ?? '', tempo: e.tempo ?? '', weightSuggestion: e.weightSuggestion ?? '', legacyReps, rows,
  };
}

export const newExercise = (exerciseId: number, name: string, timed = false): DraftExercise => ({
  key: nextKey(), exerciseId, name, showTime: timed, showDist: false, notes: '', tempo: '', weightSuggestion: '', legacyReps: null,
  rows: [0, 1, 2].map(() => ({ ...blankRow(), reps: timed ? '' : '10', time: timed ? '45' : '' })),
});

export const newBlock = (type: SectionType = 'Main', exercises: DraftExercise[] = []): DraftBlock => ({
  key: nextKey(), name: '', type, rounds: isGroupBlock(type) ? '3' : '1', rest: isGroupBlock(type) ? '90' : '', exercises,
});

export function toDraftBlocks(sections: StructureSection[]): DraftBlock[] {
  return sections.map(s => ({
    key: nextKey(), name: s.name ?? '', type: s.type ?? 'Main', rounds: String(s.rounds || 1), rest: str(s.restSeconds),
    exercises: s.exercises.map(exerciseToDraft),
  }));
}

export const MAX_SETS = 20;
const MAX_BLOCKS = 20;
const MAX_PER_BLOCK = 40;

const numOrNull = (s: string): number | null => (s.trim() === '' ? null : Number(s.trim().replace(',', '.')));
const inRange = (s: string, min: number, max: number, int = false) => {
  if (s.trim() === '') return true;
  const n = Number(s.trim().replace(',', '.'));
  return Number.isFinite(n) && n >= min && n <= max && (!int || Number.isInteger(n));
};

/** Problems that stop a save (empty when the draft is fine). */
export function validateBlocks(blocks: DraftBlock[]): string[] {
  const out: string[] = [];
  if (blocks.length > MAX_BLOCKS) out.push(`At most ${MAX_BLOCKS} blocks.`);
  blocks.forEach((b, bi) => {
    const bName = b.name.trim() || `Block ${bi + 1}`;
    if (!inRange(b.rounds || '1', 1, 255, true)) out.push(`${bName}: rounds must be 1–255.`);
    if (!inRange(b.rest, 0, 3600, true)) out.push(`${bName}: rest must be 0–3600 s.`);
    if (b.exercises.length > MAX_PER_BLOCK) out.push(`${bName}: at most ${MAX_PER_BLOCK} exercises.`);
    b.exercises.forEach(e => {
      const label = `${bName} › ${e.name}`;
      if (e.rows.length > MAX_SETS) out.push(`${label}: at most ${MAX_SETS} sets.`);
      e.rows.forEach((r, i) => {
        const at = `${label}, set ${i + 1}`;
        const reps = parseReps(r.reps);
        if (!reps) out.push(`${at}: reps must be a number or a range like 8-12.`);
        else if ((reps.min ?? 0) > 1000 || (reps.max ?? 0) > 1000) out.push(`${at}: reps must be 0–1000.`);
        else if (reps.min != null && reps.max != null && reps.min > reps.max) out.push(`${at}: the lower reps must come first.`);
        if (!inRange(r.kg, 0, 1000)) out.push(`${at}: kg must be 0–1000.`);
        if (!inRange(r.rpe, 1, 10)) out.push(`${at}: RPE must be 1–10.`);
        if (!inRange(r.rest, 0, 3600, true)) out.push(`${at}: rest must be 0–3600 s.`);
        if (e.showTime && !inRange(r.time, 0, 36000, true)) out.push(`${at}: time must be 0–36000 s.`);
        if (e.showDist && !inRange(r.dist, 0, 100000)) out.push(`${at}: distance must be 0–100000 m.`);
      });
    });
  });
  return out;
}

const rowToTarget = (r: SetRow, i: number, e: DraftExercise): SetTarget => {
  const reps = parseReps(r.reps) ?? { min: null, max: null };
  return {
    setNo: i + 1, type: r.type, repsMin: reps.min, repsMax: reps.max,
    weightKg: numOrNull(r.kg), rpe: numOrNull(r.rpe), restSec: numOrNull(r.rest),
    durationSec: e.showTime ? numOrNull(r.time) : null, distanceM: e.showDist ? numOrNull(r.dist) : null,
  };
};

/** The PUT /workouts/{id}/structure body. Sets/reps/rest summarise the first set for older readers. */
export function toStructure(blocks: DraftBlock[], workoutId: number, workoutName: string | null): WorkoutStructure {
  return {
    workoutId, workoutName,
    sections: blocks.map(b => ({
      name: b.name.trim() || null,
      type: b.type,
      rounds: Number(b.rounds.trim() || '1'),
      restSeconds: numOrNull(b.rest),
      exercises: b.exercises.map(e => {
        const first = e.rows[0];
        const repsStr = first ? repsText(parseReps(first.reps)?.min, parseReps(first.reps)?.max) : '';
        return {
          exerciseId: e.exerciseId,
          sets: e.rows.length,
          reps: repsStr || e.legacyReps || null,
          durationSeconds: e.showTime && first ? numOrNull(first.time) : null,
          restSeconds: first ? numOrNull(first.rest) : null,
          tempo: e.tempo.trim() || null,
          weightSuggestion: e.weightSuggestion.trim() || null,
          notes: e.notes.trim() || null,
          setTargets: e.rows.map((r, i) => rowToTarget(r, i, e)),
        };
      }),
    })),
  };
}

export function moveItem<X>(arr: X[], from: number, to: number): X[] {
  if (from < 0 || from >= arr.length || to < 0 || to >= arr.length || from === to) return arr;
  const copy = arr.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

/**
 * "Group into superset": the selected exercises (in their current order) move into a new Superset
 * block placed where the first of them was. Blocks left empty by the move are dropped.
 */
export function groupIntoSuperset(blocks: DraftBlock[], selected: ReadonlySet<string>): DraftBlock[] {
  const picked: DraftExercise[] = [];
  let at = -1;
  blocks.forEach((b, bi) => b.exercises.forEach(e => {
    if (selected.has(e.key)) { picked.push(e); if (at < 0) at = bi; }
  }));
  if (picked.length < 2) return blocks;
  const out: DraftBlock[] = [];
  blocks.forEach((b, bi) => {
    if (bi === at) out.push(newBlock('Superset', picked));
    const rest = b.exercises.filter(e => !selected.has(e.key));
    if (rest.length || b.exercises.length === 0) out.push(rest.length === b.exercises.length ? b : { ...b, exercises: rest });
  });
  return out;
}

/** Moves one exercise to the end of another block ('new' = a new Single block at the end). */
export function moveExerciseToBlock(blocks: DraftBlock[], exKey: string, targetKey: string | 'new'): DraftBlock[] {
  const ex = blocks.flatMap(b => b.exercises).find(e => e.key === exKey);
  if (!ex) return blocks;
  const source = blocks.find(b => b.exercises.some(e => e.key === exKey));
  if (source && source.key === targetKey) return blocks;
  let out = blocks.map(b => (b.exercises.some(e => e.key === exKey) ? { ...b, exercises: b.exercises.filter(e => e.key !== exKey) } : b));
  if (targetKey === 'new') out = [...out, newBlock('Main', [ex])];
  else out = out.map(b => (b.key === targetKey ? { ...b, exercises: [...b.exercises, ex] } : b));
  // The source block disappears when the move emptied it.
  return out.filter(b => b.exercises.length > 0 || b.key !== source?.key);
}

export const countExercises = (blocks: DraftBlock[]) => blocks.reduce((n, b) => n + b.exercises.length, 0);

// ─── Plan details ─────────────────────────────────────────────────────────────

/** Backend enum order (sent as the index, returned as the name). */
export const GOALS = ['WeightLoss', 'MuscleGain', 'Endurance', 'Flexibility', 'General', 'Rehab', 'Sport'] as const;
export const LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Elite'] as const;
export const goalIndex = (name: string | null | undefined) => Math.max(0, GOALS.indexOf((name ?? 'General') as typeof GOALS[number])) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const levelIndex = (name: string | null | undefined) => Math.max(0, LEVELS.indexOf((name ?? 'Beginner') as typeof LEVELS[number])) as 0 | 1 | 2 | 3;
/** "MuscleGain" → "Muscle gain" */
export const humanizeEnum = (s: string) => s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase()).replace(/ (\w)/g, (_, c: string) => ` ${c.toLowerCase()}`);
