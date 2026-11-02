/** "now", "5m", "3h", "2d", "3w", then a short date: the compact style feeds use. */
export function timeAgo(iso: string, now = Date.now()): string {
  const t = Date.parse(iso.endsWith('Z') || /[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.floor((now - t) / 1000));
  if (s < 45) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${Math.max(1, m)}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  if (d < 30) return `${Math.floor(d / 7)}w`;
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d > 330 ? 'numeric' : undefined });
}

/** Full date and time, for accessibility labels and long-press hints. */
export function fullDate(iso: string): string {
  const t = Date.parse(iso.endsWith('Z') || /[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(t) ? '' : new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
