import { MySubscription, MyInvoice } from '../types/memberBilling.types';
import { formatMoney as sharedMoney, formatDate as sharedDate, parseDate } from '../../common/utils/format';

/** Money in the record's own currency (INR when missing). */
export function formatMoney(amount: number, currency: string): string {
  return sharedMoney(amount, currency, { defaultCurrency: 'INR' });
}

export { parseDate };

export function formatDate(s: string | null | undefined): string {
  return parseDate(s) ? sharedDate(s) : '—';
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
