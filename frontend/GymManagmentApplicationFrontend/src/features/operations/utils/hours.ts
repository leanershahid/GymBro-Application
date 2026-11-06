import { T } from '../../../theme';
import type { PillTone } from '../../common/components/StatusPill';
import type {
  Interval, OpenState, ServiceStatus, StatusLevel, StatusSeverity, WeekdayHours,
} from '../types/operations.types';

/** Pure helpers for the hours editor and status colours (unit-tested in __tests__/hours.test.ts). */

const TIME = /^([01]?\d|2[0-4]):([0-5]\d)$/;

/** "6:5" / "0600" / "6" → "06:00"-style when possible; null when it can't be a time. */
export function normalizeTime(input: string): string | null {
  const s = input.trim().replace('.', ':');
  let h: number; let m: number;
  if (/^\d{1,2}$/.test(s)) { h = Number(s); m = 0; }
  else if (/^\d{3,4}$/.test(s)) { h = Number(s.slice(0, s.length - 2)); m = Number(s.slice(-2)); }
  else {
    const match = TIME.exec(s);
    if (!match) return null;
    h = Number(match[1]); m = Number(match[2]);
  }
  if (h > 24 || m > 59 || (h === 24 && m > 0)) return null;
  return `${String(h === 24 ? 0 : h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const minutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

/** Closes at or before opens = runs past midnight. */
export const isOvernight = (i: Interval) => minutes(i.closes) <= minutes(i.opens);

/** The first problem with a day's intervals, or null (mirrors the server's checks). */
export function dayError(intervals: Interval[]): string | null {
  const parsed: Interval[] = [];
  for (const i of intervals) {
    const o = normalizeTime(i.opens); const c = normalizeTime(i.closes);
    if (!o || !c) return 'Use times like 06:00 or 22:30.';
    parsed.push({ opens: o, closes: c });
  }
  if (parsed.length > 6) return 'At most 6 intervals a day.';
  const sorted = [...parsed].sort((a, b) => minutes(a.opens) - minutes(b.opens));
  for (let k = 0; k < sorted.length; k++) {
    if (isOvernight(sorted[k]) && k < sorted.length - 1) return 'Only the last interval can run past midnight.';
    if (k > 0 && minutes(sorted[k].opens) < minutes(sorted[k - 1].closes)) return 'Intervals overlap.';
  }
  return null;
}

/** Copies Monday's intervals to Tuesday–Friday (day 1 → 2..5). */
export function copyMondayToWeekdays(week: WeekdayHours[]): WeekdayHours[] {
  const monday = week.find(d => d.day === 1);
  if (!monday) return week;
  return week.map(d => (d.day >= 2 && d.day <= 5 ? { ...d, intervals: monday.intervals.map(i => ({ ...i })) } : d));
}

/** Normalised intervals for saving (sorted, "HH:mm"). Assumes dayError() returned null. */
export function cleanWeek(week: WeekdayHours[]): WeekdayHours[] {
  return week.map(d => ({
    ...d,
    intervals: d.intervals
      .map(i => ({ opens: normalizeTime(i.opens)!, closes: normalizeTime(i.closes)! }))
      .sort((a, b) => minutes(a.opens) - minutes(b.opens)),
  }));
}

/** "06:00" → "6am", "22:30" → "10:30pm". */
export function formatClock(t: string): string {
  const n = normalizeTime(t);
  if (!n) return t;
  const [h, m] = n.split(':').map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const suffix = h < 12 ? 'am' : 'pm';
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

export const formatInterval = (i: Interval) =>
  i.opens === '00:00' && i.closes === '00:00' ? 'Open 24 hours' : `${formatClock(i.opens)} – ${formatClock(i.closes)}${isOvernight(i) ? ' (next day)' : ''}`;

// ── Colours (theme tokens only) ─────────────────────────────────────────
export function openStateColor(state: OpenState): string {
  switch (state) {
    case 'open': return T.ok;
    case 'closing_soon': case 'opening_soon': return T.brandGold;
    case 'closed': return T.err;
    default: return T.textSub;
  }
}

export function openStateTone(state: OpenState): PillTone {
  switch (state) {
    case 'open': return 'ok';
    case 'closing_soon': case 'opening_soon': return 'warn';
    case 'closed': return 'err';
    default: return 'neutral';
  }
}

export function statusColor(s: { status: StatusLevel; severity: StatusSeverity }): string {
  if (s.status === 'Closed' || s.severity === 'Critical') return T.err;
  if (s.status === 'Limited' || s.severity === 'Warning') return T.brandGold;
  return s.status === 'Normal' ? T.ok : T.sky;
}

export const statusIcon = (s: ServiceStatus) =>
  (s.status === 'Closed' ? 'x-octagon' : s.status === 'Limited' ? 'alert-triangle' : s.severity === 'Info' ? 'info' : 'check-circle') as
    'x-octagon' | 'alert-triangle' | 'info' | 'check-circle';

/** "Until Fri 6pm" / "Until 6:30pm" (local), or null when open-ended. */
export function untilLabel(endsAt: string | null, now = new Date()): string | null {
  if (!endsAt) return null;
  const end = new Date(endsAt);
  const sameDay = end.toDateString() === now.toDateString();
  const h = end.getHours(); const m = end.getMinutes();
  const clock = formatClock(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  if (sameDay) return `Until ${clock}`;
  const day = end.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  return `Until ${day}, ${clock}`;
}

/** "Just now", "3h ago", "2 Mar". */
export function relativeTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const diff = (now.getTime() - d.getTime()) / 60_000;
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${Math.floor(diff)}m ago`;
  if (diff < 24 * 60) return `${Math.floor(diff / 60)}h ago`;
  if (diff < 7 * 24 * 60) return `${Math.floor(diff / (24 * 60))}d ago`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** A local date ("2026-03-02") + "HH:mm" → ISO UTC string. */
export function localDateTimeToIso(date: string, time: string): string | null {
  const t = normalizeTime(time);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !t) return null;
  const [y, mo, d] = date.split('-').map(Number);
  const [h, m] = t.split(':').map(Number);
  return new Date(y, mo - 1, d, h, m).toISOString();
}

/** ISO → [local "YYYY-MM-DD", "HH:mm"]. */
export function isoToLocalParts(iso: string | null | undefined): [string, string] {
  if (!iso) return ['', ''];
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return [`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, `${p(d.getHours())}:${p(d.getMinutes())}`];
}
