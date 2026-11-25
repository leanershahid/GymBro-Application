/**
 * Workout player model (pure, unit-tested): turns a structure + previous performance into blocks of
 * set rows, checks sets, finds the next set (supersets/circuits go round-robin: A1, A2, A1…), works
 * out the rest after a set, and builds the /complete payload.
 */
import type {
  CompleteSet, LastPerformance, LoggedSet, SectionType, SetTarget, SetType, StructureExercise, StructureSection,
  WorkoutStructure,
} from '../../training/api/training.types';

export interface PlayerSet {
  /** Stable row key */
  id: string;
  setType: SetType;
  /** Reps, or seconds for a timed exercise */
  reps: string;
  /** kg */
  weight: string;
  done: boolean;
  /** Added by the member (not in the plan) */
  extra: boolean;
  target: SetTarget | null;
  /** The same set last time (shown as "previous", copied by a tap or when a set is checked empty) */
  prev: LoggedSet | null;
}

export interface PlayerExercise {
  key: string;
  exerciseId: number;
  workoutExerciseId: number | null;
  name: string;
  /** "A1", "A2"… inside a superset/circuit */
  label: string | null;
  timed: boolean;
  /** Rest after a set (exercise level) */
  restSec: number | null;
  prescription: string;
  notes: string | null;
  tempo: string | null;
  weightSuggestion: string | null;
  last: LastPerformance | null;
  sets: PlayerSet[];
}

export interface PlayerBlock {
  key: string;
  title: string;
  type: SectionType;
  /** Superset / circuit: sets go round-robin and are labelled A1/A2 */
  grouped: boolean;
  rounds: number;
  /** Rest between rounds */
  restSec: number | null;
  letter: string | null;
  exercises: PlayerExercise[];
}

/** A set's place: block, exercise, set index. */
export interface SetPos { b: number; e: number; s: number }

export const DEFAULT_REST_SEC = 90;
const MAX_SETS = 20;

const isGroupedType = (t: string) => t === 'Superset' || t === 'Circuit';

/** First number in a prescription ("8-12" → "8", "40 kg" → "40"); '' when there is none ("AMRAP"). */
export function firstNumber(v: string | null | undefined): string {
  return v?.match(/\d+(\.\d+)?/)?.[0] ?? '';
}

export const isTimedExercise = (ex: StructureExercise): boolean => {
  if (ex.setTargets?.length) {
    const anyReps = ex.setTargets.some(t => t.repsMin != null || t.repsMax != null);
    const anyTime = ex.setTargets.some(t => t.durationSec != null);
    if (anyReps || anyTime) return !anyReps && anyTime;
  }
  return !firstNumber(ex.reps) && ex.durationSeconds != null;
};

/** "62.5", "60" — trims trailing zeros. */
export function fmtNum(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '';
  return String(Math.round(n * 100) / 100);
}

/** "Last: 60 kg × 8" from a previous performance's best set ('' when there is none). */
export function lastHint(last: LastPerformance | null | undefined): string {
  const b = last?.bestSet;
  if (!b) return '';
  return `Last: ${fmtLoggedSet(b)}`;
}

/** "60 kg × 8", "× 12", "45 s", "500 m". */
export function fmtLoggedSet(s: Pick<LoggedSet, 'reps' | 'weightKg' | 'durationSec' | 'distanceM'>): string {
  if (s.weightKg != null && s.weightKg > 0 && s.reps != null) return `${fmtNum(s.weightKg)} kg × ${s.reps}`;
  if (s.reps != null && s.reps > 0) return `${s.reps} reps`;
  if (s.durationSec != null && s.durationSec > 0) return `${s.durationSec} s`;
  if (s.distanceM != null && s.distanceM > 0) return `${fmtNum(s.distanceM)} m`;
  if (s.weightKg != null && s.weightKg > 0) return `${fmtNum(s.weightKg)} kg`;
  return '—';
}

/** "3 × 8–10 · 62.5 kg · 2 min rest" — the exercise's plan line. */
export function prescriptionOf(ex: StructureExercise, setCount: number, timed: boolean): string {
  const t = ex.setTargets?.find(x => x.type !== 'warmup') ?? ex.setTargets?.[0];
  let work: string | null;
  if (timed) {
    const sec = t?.durationSec ?? ex.durationSeconds;
    work = sec != null ? `${sec} s` : null;
  } else if (t && (t.repsMin != null || t.repsMax != null)) {
    work = t.repsMin != null && t.repsMax != null && t.repsMin !== t.repsMax ? `${t.repsMin}–${t.repsMax}` : String(t.repsMin ?? t.repsMax);
  } else work = ex.reps;
  const kg = t?.weightKg != null ? `${fmtNum(t.weightKg)} kg` : null;
  const rest = t?.restSec ?? ex.restSeconds;
  return [
    work ? `${setCount} × ${work}` : `${setCount} set${setCount === 1 ? '' : 's'}`,
    kg,
    rest ? `${rest >= 60 && rest % 60 === 0 ? `${rest / 60} min` : `${rest} s`} rest` : null,
    ex.tempo ? `tempo ${ex.tempo}` : null,
  ].filter(Boolean).join(' · ');
}

/** The values a set row starts with: its target first, then the exercise's sets/reps fields. */
export function prefillFromTarget(ex: StructureExercise, target: SetTarget | null, timed: boolean): { reps: string; weight: string } {
  const reps = timed
    ? fmtNum(target?.durationSec ?? ex.durationSeconds)
    : fmtNum(target?.repsMin ?? target?.repsMax) || firstNumber(ex.reps);
  const weight = target?.weightKg != null
    ? fmtNum(target.weightKg)
    : /kg/i.test(ex.weightSuggestion ?? '') ? firstNumber(ex.weightSuggestion) : '';
  return { reps, weight };
}

/**
 * The previous performance's set that lines up with a row: the index-th warm-up for a warm-up row,
 * the index-th working set otherwise (`index` counts this exercise's rows of the same kind).
 */
function prevFor(last: LastPerformance | null, index: number, type: SetType): LoggedSet | null {
  if (!last) return null;
  const same = last.sets.filter(s => (s.setType === 'warmup') === (type === 'warmup')).sort((a, b) => a.setNo - b.setNo);
  return same[index] ?? null;
}

function setsFor(ex: StructureExercise, section: StructureSection, grouped: boolean, last: LastPerformance | null, keyBase: string): PlayerSet[] {
  const timed = isTimedExercise(ex);
  const targets = ex.setTargets?.length ? ex.setTargets.slice(0, MAX_SETS) : null;
  const count = targets
    ? targets.length
    : Math.min(MAX_SETS, Math.max(1, (grouped ? section.rounds : null) ?? ex.sets ?? section.rounds ?? 1, ex.sets ?? 0));
  const counters = { warmup: 0, work: 0 };
  return Array.from({ length: count }, (_, i) => {
    const target = targets?.[i] ?? null;
    const setType: SetType = target?.type ?? 'normal';
    const kind = setType === 'warmup' ? 'warmup' : 'work';
    const prev = prevFor(last, counters[kind]++, setType);
    return { id: `${keyBase}-${i}`, setType, ...prefillFromTarget(ex, target, timed), done: false, extra: false, target, prev };
  });
}

/** Blocks in order (empty sections dropped); superset/circuit exercises are labelled A1, A2… */
export function buildPlayer(structure: WorkoutStructure, lastByExercise: Record<number, LastPerformance | undefined> = {}): PlayerBlock[] {
  let letterIdx = 0;
  return structure.sections
    .map((section, si): PlayerBlock | null => {
      if (section.exercises.length === 0) return null;
      const grouped = isGroupedType(section.type) && section.exercises.length > 1;
      const letter = grouped ? String.fromCharCode(65 + (letterIdx++ % 26)) : null;
      return {
        key: `b${si}`,
        title: section.name || section.type,
        type: section.type,
        grouped,
        rounds: Math.max(1, section.rounds || 1),
        restSec: section.restSeconds,
        letter,
        exercises: section.exercises.map((ex, ei) => {
          const key = `b${si}e${ei}`;
          const last = lastByExercise[ex.exerciseId] ?? null;
          const sets = setsFor(ex, section, grouped, last, key);
          const timed = isTimedExercise(ex);
          return {
            key,
            exerciseId: ex.exerciseId,
            workoutExerciseId: ex.workoutExerciseId ?? null,
            name: ex.exerciseName || `Exercise #${ex.exerciseId}`,
            label: letter ? `${letter}${ei + 1}` : null,
            timed,
            restSec: ex.restSeconds,
            prescription: prescriptionOf(ex, sets.length, timed),
            notes: ex.notes ?? null,
            tempo: ex.tempo ?? null,
            weightSuggestion: ex.weightSuggestion ?? null,
            last,
            sets,
          };
        }),
      };
    })
    .filter((b): b is PlayerBlock => b !== null);
}

/** Order the sets of a block are done in: round-robin for grouped blocks, exercise by exercise otherwise. */
export function executionOrder(block: PlayerBlock): [number, number][] {
  const out: [number, number][] = [];
  if (block.grouped) {
    const rounds = Math.max(...block.exercises.map(e => e.sets.length));
    for (let r = 0; r < rounds; r++) block.exercises.forEach((ex, e) => { if (r < ex.sets.length) out.push([e, r]); });
  } else block.exercises.forEach((ex, e) => ex.sets.forEach((_, s) => out.push([e, s])));
  return out;
}

/** The next set still to do after `pos` (wrapping to earlier ones), or null when every set is done. */
export function nextOpenSet(blocks: PlayerBlock[], pos: SetPos | null): SetPos | null {
  const flat: SetPos[] = [];
  blocks.forEach((block, b) => executionOrder(block).forEach(([e, s]) => flat.push({ b, e, s })));
  const open = (p: SetPos) => !blocks[p.b].exercises[p.e].sets[p.s].done;
  const at = pos ? flat.findIndex(p => p.b === pos.b && p.e === pos.e && p.s === pos.s) : -1;
  for (let i = 1; i <= flat.length; i++) {
    const p = flat[(at + i + flat.length) % flat.length];
    if (p && open(p)) return p;
  }
  return null;
}

/**
 * Rest after checking a set. In a superset/circuit, moving on to the next exercise of the round
 * uses the exercise's own rest (usually none); the end of a round uses the block's rest.
 */
export function restAfter(block: PlayerBlock, e: number, s: number): number {
  const ex = block.exercises[e];
  const set = ex.sets[s];
  if (block.grouped) {
    const moreInRound = block.exercises.some((other, i) => i > e && s < other.sets.length);
    if (moreInRound) return Math.max(0, set.target?.restSec ?? ex.restSec ?? 0);
    return Math.max(0, block.restSec ?? set.target?.restSec ?? ex.restSec ?? DEFAULT_REST_SEC);
  }
  return Math.max(0, set.target?.restSec ?? ex.restSec ?? block.restSec ?? DEFAULT_REST_SEC);
}

/** A set ready to be checked: empty fields take last time's values. Null when reps are still missing. */
export function checkedSet(set: PlayerSet, timed: boolean): PlayerSet | null {
  const reps = set.reps.trim() || (timed ? fmtNum(set.prev?.durationSec) : fmtNum(set.prev?.reps));
  const weight = set.weight.trim() || (timed ? '' : fmtNum(set.prev?.weightKg));
  if (!reps || !(Number(reps) > 0)) return null;
  return { ...set, reps, weight, done: true };
}

/** Last time's values copied into a row (unchanged when there were none). */
export function copyPrev(set: PlayerSet, timed: boolean): PlayerSet {
  if (!set.prev || set.done) return set;
  return {
    ...set,
    reps: (timed ? fmtNum(set.prev.durationSec) : fmtNum(set.prev.reps)) || set.reps,
    weight: timed ? set.weight : fmtNum(set.prev.weightKg) || set.weight,
  };
}

/** "Complete block": every open set that can be checked is checked with its prefilled values. */
export function completeBlock(block: PlayerBlock): PlayerBlock {
  return {
    ...block,
    exercises: block.exercises.map(ex => ({
      ...ex,
      sets: ex.sets.map(set => (set.done ? set : checkedSet(set, ex.timed) ?? set)),
    })),
  };
}

/** A new extra set copying the exercise's last row (values, not done). */
export function addSet(ex: PlayerExercise): PlayerExercise {
  if (ex.sets.length >= MAX_SETS) return ex;
  const tail = ex.sets[ex.sets.length - 1];
  const n = ex.sets.length;
  const extra: PlayerSet = {
    id: `${ex.key}-x${Date.now().toString(36)}${n}`,
    setType: tail?.setType === 'warmup' ? 'normal' : tail?.setType ?? 'normal',
    reps: tail?.reps ?? '', weight: tail?.weight ?? '', done: false, extra: true,
    target: tail?.target ?? null,
    prev: ex.last?.sets.filter(s => s.setType !== 'warmup')[ex.sets.filter(s => s.setType !== 'warmup').length] ?? null,
  };
  return { ...ex, sets: [...ex.sets, extra] };
}

/** Removes a set that isn't done (keeps at least one row). */
export function removeSet(ex: PlayerExercise, setId: string): PlayerExercise {
  if (ex.sets.length <= 1) return ex;
  const set = ex.sets.find(x => x.id === setId);
  if (!set || set.done) return ex;
  return { ...ex, sets: ex.sets.filter(x => x.id !== setId) };
}

const SET_TYPE_CYCLE: SetType[] = ['normal', 'warmup', 'drop', 'failure'];
export const nextSetType = (t: SetType): SetType => SET_TYPE_CYCLE[(SET_TYPE_CYCLE.indexOf(t) + 1) % SET_TYPE_CYCLE.length];

/** Steps a numeric text value: kg by 2.5, reps by 1; never below 0. */
export function stepValue(v: string, delta: number, max = 1000): string {
  const n = Number(v.replace(',', '.'));
  const next = Math.min(max, Math.max(0, (Number.isFinite(n) ? n : 0) + delta));
  return fmtNum(next);
}

/** Only digits and one decimal point (comma accepted). */
export const cleanNumber = (v: string, decimals: boolean) =>
  decimals ? v.replace(',', '.').replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 7) : v.replace(/\D/g, '').slice(0, 5);

/** Completed sets as the API wants them (setNo counts each exercise row's sets). */
export function buildCompleteSets(blocks: PlayerBlock[]): CompleteSet[] {
  const out: CompleteSet[] = [];
  blocks.forEach(block => block.exercises.forEach(ex => ex.sets.forEach((set, i) => {
    if (!set.done) return;
    const n = Number(set.reps);
    const kg = set.weight ? Number(set.weight) : null;
    out.push({
      exerciseId: ex.exerciseId,
      workoutExerciseId: ex.workoutExerciseId,
      setNo: Math.min(50, i + 1),
      setType: set.setType,
      reps: ex.timed ? null : Math.min(1000, Math.round(n)),
      durationSec: ex.timed ? Math.min(36000, Math.round(n)) : null,
      weightKg: kg != null && Number.isFinite(kg) ? Math.min(1000, kg) : null,
      completed: true,
    });
  })));
  return out.slice(0, 300);
}

export interface LocalSummary { sets: number; exercises: number; volumeKg: number }

/** Sets / exercises / Σ reps × kg of the checked sets (shown before saving). */
export function summarize(blocks: PlayerBlock[]): LocalSummary {
  const sets = buildCompleteSets(blocks);
  return {
    sets: sets.length,
    exercises: new Set(sets.map(s => s.workoutExerciseId ?? `e${s.exerciseId}`)).size,
    volumeKg: Math.round(sets.reduce((v, s) => v + (s.reps ?? 0) * (s.weightKg ?? 0), 0)),
  };
}

export const countSets = (blocks: PlayerBlock[]) => {
  let done = 0, total = 0;
  blocks.forEach(b => b.exercises.forEach(ex => ex.sets.forEach(s => { total++; if (s.done) done++; })));
  return { done, total };
};

/** Rough session length: ~3 s a rep (40 s default), plus each set's rest. */
export function estimateMinutes(structure: WorkoutStructure | null | undefined): number | null {
  if (!structure) return null;
  const blocks = buildPlayer(structure);
  if (blocks.length === 0) return null;
  let sec = 0;
  blocks.forEach(block => block.exercises.forEach((ex, e) => ex.sets.forEach((set, s) => {
    const n = Number(set.reps) || 0;
    sec += ex.timed ? n || 40 : n ? Math.max(20, n * 3) : 40;
    sec += restAfter(block, e, s);
  })));
  return Math.max(5, Math.round(sec / 60 / 5) * 5);
}

/** "12:05" / "1:02:09" */
export function fmtClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(r).padStart(2, '0')}`;
}
