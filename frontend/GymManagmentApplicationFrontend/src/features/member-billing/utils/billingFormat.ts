import { MySubscription, MyInvoice } from '../types/memberBilling.types';

const fmtCache = new Map<string, Intl.NumberFormat>();

/** Money in the record's own currency. */
export function formatMoney(amount: number, currency: string): string {
  const cur = (currency || 'INR').toUpperCase();
  let f = fmtCache.get(cur);
  if (!f) {
    try { f = new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }); }
    catch { return `${cur} ${amount.toFixed(2)}`; }
    fmtCache.set(cur, f);
  }
  return f.format(amount);
}

/** "YYYY-MM-DD" (DateOnly) or ISO datetime → local Date. DateOnly is read as a local calendar day. */
export function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(s: string | null | undefined): string {
  const d = parseDate(s);
  return d ? d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

/** Whole days from today until `s` (0 = today, negative = past). */
export function daysUntil(s: string | null | undefined): number | null {
  const d = parseDate(s);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

const LIVE = ['active', 'paused', 'trial', 'pending'];

/** Live memberships first (newest start), then the most recent ended one. */
export function splitMemberships(list: MySubscription[]): { current: MySubscription | null; past: MySubscription[] } {
  const byStart = [...list].sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''));
  const current = byStart.find(s => LIVE.includes(s.status.toLowerCase())) ?? byStart[0] ?? null;
  return { current, past: byStart.filter(s => s !== current) };
}

export function isFrozen(s: MySubscription): boolean {
  return s.status.toLowerCase() === 'paused' || (!!s.frozenFrom && (daysUntil(s.frozenUntil) ?? -1) >= 0);
}

/** Invoices the member still owes on (issued, not void/refunded, balance left). */
export function isDue(inv: MyInvoice): boolean {
  const st = inv.status.toLowerCase();
  return inv.balance > 0 && (st === 'sent' || st === 'overdue');
}

/** Balances grouped by currency, e.g. "₹1,500.00" or "₹1,500.00 + $20.00". */
export function totalDue(invoices: MyInvoice[]): string | null {
  const sums = new Map<string, number>();
  for (const i of invoices.filter(isDue)) sums.set(i.currency, (sums.get(i.currency) ?? 0) + i.balance);
  if (!sums.size) return null;
  return [...sums].map(([c, v]) => formatMoney(v, c)).join(' + ');
}

/** "12 days left", "Ends today", "Ended 3 days ago". */
export function daysLeftLabel(s: MySubscription): string | null {
  const n = daysUntil(s.endDate);
  if (n === null) return s.endDate ? null : 'No end date';
  if (n > 1) return `${n} days left`;
  if (n === 1) return '1 day left';
  if (n === 0) return 'Ends today';
  return `Ended ${-n} day${n === -1 ? '' : 's'} ago`;
}
