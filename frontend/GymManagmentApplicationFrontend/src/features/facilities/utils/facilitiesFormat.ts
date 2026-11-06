import type { AssetStatus, IncidentSeverity, ReportStatus } from '../types/facilities.types';
import type { PillTone } from '../../common/components/StatusPill';

// Pure helpers (unit-tested): labels and tones for the facilities chips.

export const ASSET_STATUS_LABEL: Record<AssetStatus, string> = { InService: 'In service', Limited: 'Limited', OutOfService: 'Out of service' };
export const ASSET_STATUS_TONE: Record<AssetStatus, PillTone> = { InService: 'ok', Limited: 'warn', OutOfService: 'err' };

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = { Received: 'Received', InProgress: 'In progress', Fixed: 'Fixed', CantReproduce: "Can't reproduce" };
export const REPORT_STATUS_TONE: Record<ReportStatus, PillTone> = { Received: 'info', InProgress: 'warn', Fixed: 'ok', CantReproduce: 'neutral' };

export const SEVERITY_TONE: Record<IncidentSeverity, PillTone> = { Low: 'neutral', Medium: 'info', High: 'warn', Critical: 'err' };

export const isOpenReport = (s: ReportStatus) => s === 'Received' || s === 'InProgress';

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "yyyy-MM-dd" → local Date at midnight (no time-zone shift). */
export function parseDay(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/**
 * "back ~Fri" within the coming week, "back ~14 Nov" further out, "back soon" when overdue/unknown.
 * `today` is injectable for tests.
 */
export function backLabel(expected: string | null | undefined, today: Date = new Date()): string {
  const d = expected ? parseDay(expected) : null;
  if (!d) return 'back soon';
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((d.getTime() - start.getTime()) / 86_400_000);
  if (days < 0) return 'back soon';
  if (days === 0) return 'back ~today';
  if (days === 1) return 'back ~tomorrow';
  if (days < 7) return `back ~${WEEKDAY[d.getDay()]}`;
  return `back ~${d.getDate()} ${MONTH[d.getMonth()]}`;
}

/** "12 Nov 2026" from an ISO date or date-time. */
export function dayLabel(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = iso.length <= 10 ? parseDay(iso) : new Date(iso);
  return d && !isNaN(d.getTime()) ? `${d.getDate()} ${MONTH[d.getMonth()]} ${d.getFullYear()}` : '—';
}

/** "12 Nov, 14:05" (local time). */
export function dateTimeLabel(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getDate()} ${MONTH[d.getMonth()]}, ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** "3h ago", "2d ago". */
export function ago(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** Today as yyyy-MM-dd (local). */
export function todayIso(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Case-insensitive filter of a zone-grouped asset list; empty groups drop out. */
export function filterZones<A extends { name: string; assetType: string | null }>(zones: { zone: string; assets: A[] }[], term: string) {
  const t = term.trim().toLowerCase();
  if (!t) return zones;
  return zones
    .map(z => ({ zone: z.zone, assets: z.assets.filter(a => a.name.toLowerCase().includes(t) || (a.assetType ?? '').toLowerCase().includes(t) || z.zone.toLowerCase().includes(t)) }))
    .filter(z => z.assets.length > 0);
}
