/**
 * Plan week / strip / history helpers (pure, unit-tested): week strip chips, plan week ranges,
 * day rows from a calendar, the dates a day can move to, history grouped by week, record labels.
 */
import type {
  CalendarEntry, CalendarStatus, DateString, PersonalRecord, RecordType, WeekStripDay, WorkoutHistoryItem,
} from '../../training/api/training.types';

const DAY_MS = 86_400_000;

/** Local yyyy-MM-dd */
export function toDateString(d: Date): DateString {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** yyyy-MM-dd → local midnight */
export function fromDateString(s: DateString): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export const addDaysTo = (s: DateString, n: number): DateString => {
  const d = fromDateString(s);
  return toDateString(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
};

export const daysBetween = (a: DateString, b: DateString) =>
  Math.round((fromDateString(b).getTime() - fromDateString(a).getTime()) / DAY_MS);

/** Monday of the week a date is in. */
export function mondayOf(s: DateString): DateString {
  const d = fromDateString(s);
  return addDaysTo(s, -((d.getDay() + 6) % 7));
}

// ─── Week strip ─────────────────────────────────────────────────────────────

export type ChipState = 'done' | 'skipped' | 'moved' | 'rest' | 'missed' | 'planned' | 'off';

export interface StripChip {
  date: DateString;
  /** "Mon" */
  weekday: string;
  dayOfMonth: number;
  /** Day title, "Rest", "Moved" or "—" outside the plan */
  title: string;
  state: ChipState;
  isToday: boolean;
  /** Tapping opens the day's workout */
  canOpen: boolean;
  workoutId: number | null;
  week: number | null;
  day: number | null;
  a11y: string;
}

const STATE_WORD: Record<ChipState, string> = {
  done: 'done', skipped: 'skipped', moved: 'moved', rest: 'rest day', missed: 'missed', planned: 'planned', off: 'not in plan',
};

export function stripChip(d: WeekStripDay): StripChip {
  const state: ChipState = !d.inPlan ? 'off'
    : d.done || d.status === 'done' ? 'done'
    : d.skipped || d.status === 'skipped' ? 'skipped'
    : (d.moved || d.status === 'moved') && d.movedToDate ? 'moved'
    : d.isRestDay || d.status === 'rest' ? 'rest'
    : d.status === 'missed' ? 'missed'
    : d.workoutId != null ? 'planned' : 'rest';
  const title = state === 'off' ? '—' : state === 'rest' ? 'Rest' : state === 'moved' ? 'Moved' : d.title || 'Workout';
  const canOpen = state !== 'off' && state !== 'rest' && state !== 'moved' && d.workoutId != null;
  const dom = fromDateString(d.date).getDate();
  return {
    date: d.date, weekday: d.weekday.slice(0, 3), dayOfMonth: dom, title, state, isToday: d.isToday, canOpen,
    workoutId: d.workoutId, week: d.weekNumber, day: d.dayNumber,
    a11y: `${d.weekday} ${dom}${d.isToday ? ', today' : ''}: ${title}, ${STATE_WORD[state]}`,
  };
}

export const stripChips = (days: WeekStripDay[]) => days.map(stripChip);

// ─── Plan weeks ─────────────────────────────────────────────────────────────

/** The dates of plan week `week` (1-based) for a plan starting on `startDate`. */
export function planWeekRange(startDate: DateString, week: number): { from: DateString; to: DateString } {
  const from = addDaysTo(startDate, (Math.max(1, week) - 1) * 7);
  return { from, to: addDaysTo(from, 6) };
}

/** Plan week that contains `date` (clamped to 1…weeks). */
export function planWeekOf(startDate: DateString, date: DateString, weeks: number): number {
  const w = Math.floor(daysBetween(startDate, date) / 7) + 1;
  return Math.max(1, Math.min(Math.max(1, weeks), w));
}

export interface DayRow {
  date: DateString;
  isToday: boolean;
  isPast: boolean;
  /** The plan day on that date first, then days moved onto it */
  entries: CalendarEntry[];
}

/** One row per date from..to, entries in order (the date's own day first). */
export function dayRows(entries: CalendarEntry[], from: DateString, to: DateString, today: DateString): DayRow[] {
  const n = Math.max(0, daysBetween(from, to)) + 1;
  return Array.from({ length: n }, (_, i) => {
    const date = addDaysTo(from, i);
    const own = entries.filter(e => e.date === date).sort((a, b) => Number(!!a.movedFromDate) - Number(!!b.movedFromDate));
    return { date, isToday: date === today, isPast: date < today, entries: own };
  });
}

export type DayAction = 'open' | 'skip' | 'move' | 'undo';

/**
 * What a member may do with a calendar entry: change only today or later, never rest days or
 * done days; a skipped / moved day can be undone (undo of a moved-in day targets its original date).
 */
export function dayActions(e: CalendarEntry, today: DateString): DayAction[] {
  const out: DayAction[] = [];
  const s: CalendarStatus = e.status;
  if (e.workoutId != null && !e.isRestDay && s !== 'moved') out.push('open');
  if (e.date >= today && !e.isRestDay && e.workoutId != null && (s === 'scheduled' || s === 'missed')) {
    out.push('skip', 'move');
  }
  if ((s === 'skipped' || s === 'moved') && e.date >= today) out.push('undo');
  if (e.movedFromDate && s !== 'done' && !out.includes('undo')) out.push('undo');
  return out;
}

/** The date an undo is sent for: a moved-in entry is undone on its original date. */
export const undoDateOf = (e: CalendarEntry): DateString => e.movedFromDate ?? e.date;

/** Dates a day can move to: today or later, inside start…end + 7 days, not the day itself (max `limit`). */
export function moveTargets(today: DateString, startDate: DateString, endDate: DateString, from: DateString, limit = 28): DateString[] {
  const first = today > startDate ? today : startDate;
  const last = addDaysTo(endDate, 7);
  const out: DateString[] = [];
  for (let d = first; d <= last && out.length < limit; d = addDaysTo(d, 1)) if (d !== from) out.push(d);
  return out;
}

export const STATUS_LABEL: Record<CalendarStatus, string> = {
  rest: 'Rest', scheduled: 'Planned', done: 'Done', missed: 'Missed', skipped: 'Skipped', moved: 'Moved',
};

// ─── History ────────────────────────────────────────────────────────────────

export interface HistoryWeek {
  key: DateString;
  label: string;
  items: WorkoutHistoryItem[];
  volumeKg: number;
  minutes: number;
}

const shortDate = (s: DateString) => fromDateString(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** History grouped by calendar week (Mon–Sun), newest first, with each week's totals. */
export function groupHistoryByWeek(items: WorkoutHistoryItem[], today: DateString): HistoryWeek[] {
  const thisWeek = mondayOf(today);
  const lastWeek = addDaysTo(thisWeek, -7);
  const map = new Map<DateString, HistoryWeek>();
  [...items].sort((a, b) => (b.startedAt > a.startedAt ? 1 : b.startedAt < a.startedAt ? -1 : 0)).forEach(it => {
    const key = mondayOf(toDateString(new Date(it.startedAt)));
    let w = map.get(key);
    if (!w) {
      const label = key === thisWeek ? 'This week' : key === lastWeek ? 'Last week' : `${shortDate(key)} – ${shortDate(addDaysTo(key, 6))}`;
      w = { key, label, items: [], volumeKg: 0, minutes: 0 };
      map.set(key, w);
    }
    w.items.push(it);
    w.volumeKg += it.volumeKg || 0;
    w.minutes += it.durationMin || 0;
  });
  return [...map.values()];
}

/** "12 450 kg" style volume; "—" for none. */
export function fmtVolume(kg: number | null | undefined): string {
  if (!kg) return '—';
  return `${Math.round(kg).toLocaleString('en-IN')} kg`;
}

export function fmtMinutes(min: number | null | undefined): string {
  if (min == null) return '—';
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60 ? `${min % 60} min` : ''}`.trim();
}

// ─── Records ────────────────────────────────────────────────────────────────

export const RECORD_LABEL: Record<RecordType, string> = {
  heaviestWeight: 'Heaviest weight', estimatedOneRepMax: 'Est. 1-rep max', mostReps: 'Most reps', bestSetVolume: 'Best set volume',
};

export function fmtRecordValue(r: Pick<PersonalRecord, 'type' | 'value' | 'reps' | 'weightKg'>): string {
  const v = Math.round(r.value * 10) / 10;
  switch (r.type) {
    case 'mostReps': return r.weightKg ? `${v} reps @ ${r.weightKg} kg` : `${v} reps`;
    case 'bestSetVolume': return r.weightKg && r.reps ? `${v} kg (${r.weightKg} × ${r.reps})` : `${v} kg`;
    case 'heaviestWeight': return r.reps ? `${v} kg × ${r.reps}` : `${v} kg`;
    default: return `${v} kg`;
  }
}

export interface ExerciseRecords { exerciseId: number; name: string; records: PersonalRecord[]; latest: string }

const TYPE_ORDER: RecordType[] = ['heaviestWeight', 'estimatedOneRepMax', 'mostReps', 'bestSetVolume'];

/** Records per exercise (A–Z), types in a fixed order. */
export function groupRecords(records: PersonalRecord[]): ExerciseRecords[] {
  const map = new Map<number, ExerciseRecords>();
  records.forEach(r => {
    let g = map.get(r.exerciseId);
    if (!g) { g = { exerciseId: r.exerciseId, name: r.exerciseName || `Exercise #${r.exerciseId}`, records: [], latest: r.achievedAt }; map.set(r.exerciseId, g); }
    g.records.push(r);
    if (r.achievedAt > g.latest) g.latest = r.achievedAt;
  });
  return [...map.values()]
    .map(g => ({ ...g, records: g.records.sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type)) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
