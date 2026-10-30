import { AssignedPlan, AssignedWorkout } from '../types/member-app.types';
import { PillTone } from '../../common/components/StatusPill';

const DAY_MS = 86_400_000;

/** Parses an API DateOnly ("yyyy-MM-dd", optionally with time) as a local calendar date. */
export function parseDay(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function startOfToday(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function fmtDay(d: Date | null, withYear = false): string {
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });
}

/** "Sat, 12 Oct" — weekday + date for schedule rows. */
export function fmtWeekday(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "InProgress" → "In progress". */
export function statusLabel(s: string): string {
  const spaced = s.replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

export function assignmentTone(s: string): PillTone {
  switch (s.toLowerCase()) {
    case 'completed':  return 'ok';
    case 'inprogress': return 'brand';
    case 'assigned':   return 'info';
    case 'expired':    return 'err';
    default:           return 'neutral';
  }
}

/** Still something to do (not Completed / Skipped / Expired). */
export function isOpen(s: string): boolean {
  const v = s.toLowerCase();
  return v === 'assigned' || v === 'inprogress';
}

export function isOverdue(w: AssignedWorkout): boolean {
  const due = parseDay(w.dueDate);
  return !!due && isOpen(w.status) && due.getTime() < startOfToday().getTime();
}

/** Elapsed days / total days (0…1). Completed plans count as done. */
export function planProgress(p: AssignedPlan): { elapsed: number; total: number; pct: number } {
  const total = Math.max(1, p.durationWeeks * 7);
  let elapsed: number;
  if (p.status.toLowerCase() === 'completed') elapsed = total;
  else if (p.currentWeek != null && p.currentDay != null) elapsed = (p.currentWeek - 1) * 7 + p.currentDay;
  else {
    const start = parseDay(p.startDate);
    const diff = start ? Math.floor((startOfToday().getTime() - start.getTime()) / DAY_MS) : -1;
    elapsed = diff < 0 ? 0 : Math.min(total, diff + 1);
  }
  elapsed = Math.max(0, Math.min(total, elapsed));
  return { elapsed, total, pct: elapsed / total };
}

/** Plans the member is in the middle of today (the server sets currentWeek/Day). */
export function activeTodayPlans(plans: AssignedPlan[]): AssignedPlan[] {
  return plans.filter(p => p.currentWeek != null && p.currentDay != null && isOpen(p.status));
}

/** Open workouts, soonest due first (undated last), newest assignment breaking ties. */
export function sortOpenWorkouts(ws: AssignedWorkout[]): AssignedWorkout[] {
  const key = (w: AssignedWorkout) => parseDay(w.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return ws
    .filter(w => isOpen(w.status))
    .sort((a, b) => key(a) - key(b) || (b.assignedAt > a.assignedAt ? 1 : b.assignedAt < a.assignedAt ? -1 : 0));
}

export function fmtSeconds(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60), s = sec % 60;
  return s ? `${m}m ${s}s` : `${m} min`;
}
