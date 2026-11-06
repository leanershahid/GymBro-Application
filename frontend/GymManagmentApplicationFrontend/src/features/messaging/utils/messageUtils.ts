import type { DirectMessage, OutgoingMessage } from '../api/messaging.types';

// Pure helpers for the thread screen (unit-tested in __tests__/messaging.test.ts).

export const MAX_MESSAGE_LENGTH = 2000;

/** Unique per sender; the server stores a retried send once (unique (sender, clientMessageId)). */
export function newClientMessageId(now = Date.now(), rand = Math.random): string {
  return `m-${now.toString(36)}-${Math.floor(rand() * 36 ** 8).toString(36).padStart(8, '0')}`;
}

/** Adds or replaces a stored message (by id or clientMessageId), keeping the list oldest first. */
export function mergeMessage(list: DirectMessage[], m: DirectMessage): DirectMessage[] {
  const rest = list.filter(x => x.id !== m.id && !(x.mine && m.mine && x.clientMessageId === m.clientMessageId));
  return [...rest, m].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
}

/** Outgoing messages the server doesn't have yet (a stored one replaces its optimistic copy). */
export function pendingOnly(outbox: OutgoingMessage[], stored: DirectMessage[]): OutgoingMessage[] {
  const ids = new Set(stored.filter(m => m.mine).map(m => m.clientMessageId));
  return outbox.filter(o => !ids.has(o.clientMessageId));
}

export type ThreadItem =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'message'; key: string; message: DirectMessage }
  | { kind: 'outgoing'; key: string; message: OutgoingMessage };

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "Today", "Yesterday", "Mon 3 Nov" (this year) or "3 Nov 2025". */
export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (sameDay(d, now)) return 'Today';
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return 'Yesterday';
  const opts: Intl.DateTimeFormatOptions = d.getFullYear() === now.getFullYear()
    ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' };
  return d.toLocaleDateString('en-GB', opts);
}

/** Messages (then outgoing ones) with a date separator before each new day. */
export function threadItems(stored: DirectMessage[], outgoing: OutgoingMessage[], now = new Date()): ThreadItem[] {
  const items: ThreadItem[] = [];
  let lastDay = '';
  const addDay = (iso: string) => {
    const d = new Date(iso);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (key !== lastDay) { items.push({ kind: 'day', key: `day-${key}`, label: dayLabel(iso, now) }); lastDay = key; }
  };
  for (const m of stored) { addDay(m.createdAt); items.push({ kind: 'message', key: `m-${m.id}`, message: m }); }
  for (const o of outgoing) { addDay(o.createdAt); items.push({ kind: 'outgoing', key: `o-${o.clientMessageId}`, message: o }); }
  return items;
}

/** "14:05" for the bubble; the date lives in the separator. */
export const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** Inbox time: "14:05" today, "Yesterday", "Mon", or "3 Nov". */
export function listTime(iso: string | null, now = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (sameDay(d, now)) return timeOf(iso);
  const label = dayLabel(iso, now);
  if (label === 'Yesterday') return label;
  const days = (now.getTime() - d.getTime()) / 86_400_000;
  return days < 7 ? d.toLocaleDateString('en-GB', { weekday: 'short' }) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** The last of my stored messages the other side has read (read receipt under it), or null. */
export function lastReadMineId(stored: DirectMessage[], otherLastReadAt: string | null): number | null {
  if (!otherLastReadAt) return null;
  const read = [...stored].reverse().find(m => m.mine && m.createdAt <= otherLastReadAt);
  return read?.id ?? null;
}

/** Worth retrying on its own: no response (offline / timeout) or a 5xx. Refusals (4xx) are not. */
export function isRetryableSendError(e: unknown): boolean {
  const status = (e as { response?: { status?: number } } | null)?.response?.status;
  if (status === undefined) return !(e instanceof Error && e.name === 'ApiError');
  return status >= 500;
}
