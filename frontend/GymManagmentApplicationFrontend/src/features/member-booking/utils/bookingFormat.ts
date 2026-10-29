import { T } from '../../../theme';
import { GymClass, PtSession, UpcomingItem } from '../types/booking.types';

/** Parses an API timestamp as UTC (the server may omit the trailing `Z`). */
export function parseUtc(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(iso);
  const d = new Date(hasZone ? iso : `${iso}Z`);
  return isNaN(d.getTime()) ? null : d;
}

export const formatTime = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export const formatTimeRange = (a: Date, b: Date) => `${formatTime(a)} – ${formatTime(b)}`;

export function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export const sameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "Today", "Tomorrow", or "Mon, 3 Nov". */
export function dayLabel(d: Date, now = new Date()): string {
  if (sameLocalDay(d, now)) return 'Today';
  if (sameLocalDay(d, addDays(now, 1))) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "Today · 6:30 PM" */
export const whenLabel = (d: Date) => `${dayLabel(d)} · ${formatTime(d)}`;

export function formatMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null) return '';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'INR' }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency ?? ''}`.trim();
  }
}

/** API colours are user data; fall back to the brand token if one isn't a usable hex. */
export function classColor(c: GymClass): string {
  return c.color && /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.color) ? (c.color.startsWith('#') ? c.color : `#${c.color}`) : T.brand;
}

export const isClassCancelled = (c: GymClass) => c.status.toLowerCase() === 'cancelled';

export const spotsLeft = (c: GymClass): number | null =>
  c.capacity == null ? null : Math.max(0, c.capacity - c.booked);

const PT_LIVE = ['booked', 'confirmed'];
export const isPtLive = (s: PtSession) => PT_LIVE.includes(s.status.toLowerCase());

/** Upcoming (not yet ended) classes I hold a place on + live PT sessions, soonest first. */
export function upcomingItems(classes: GymClass[], sessions: PtSession[], now = new Date()): UpcomingItem[] {
  const out: UpcomingItem[] = [];
  for (const c of classes) {
    const s = parseUtc(c.startsAt);
    const e = parseUtc(c.endsAt) ?? s;
    if (!s || !e || e <= now || isClassCancelled(c)) continue;
    if (c.myBooking !== 'Booked' && c.myBooking !== 'Waitlisted') continue;
    out.push({ kind: 'class', key: `c${c.id}`, startsAt: s, endsAt: e, cls: c });
  }
  for (const p of sessions) {
    const s = parseUtc(p.startsAt);
    const e = parseUtc(p.endsAt) ?? s;
    if (!s || !e || e <= now || !isPtLive(p)) continue;
    out.push({ kind: 'pt', key: `p${p.id}`, startsAt: s, endsAt: e, session: p });
  }
  return out.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** Past PT sessions (ended, or completed/cancelled/no-show), newest first. */
export function pastPtSessions(sessions: PtSession[], now = new Date()): PtSession[] {
  return sessions
    .filter(p => {
      const e = parseUtc(p.endsAt);
      return !isPtLive(p) || (e != null && e <= now);
    })
    .sort((a, b) => (parseUtc(b.startsAt)?.getTime() ?? 0) - (parseUtc(a.startsAt)?.getTime() ?? 0));
}

/** 30-minute start slots from 06:00 to 21:00 local on `day`. */
export function timeSlots(day: Date): Date[] {
  const base = startOfLocalDay(day);
  const out: Date[] = [];
  for (let m = 6 * 60; m <= 21 * 60; m += 30) {
    const d = new Date(base);
    d.setHours(Math.floor(m / 60), m % 60, 0, 0);
    out.push(d);
  }
  return out;
}
