import { isAxiosError } from 'axios';
import { formatMoney } from '../../common/utils/format';
import { BookingBlockedInfo, BookingPolicy, LateCancelInfo } from '../types/bookingRules.types';

export const LATE_CANCEL_CONFIRM = 'LATE_CANCEL_CONFIRM';
export const BOOKING_BLOCKED = 'BOOKING_BLOCKED';

/** Parses an API timestamp as UTC (the server may omit the trailing `Z`). */
export function utc(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(/([zZ]|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`);
  return isNaN(d.getTime()) ? null : d;
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "4:30 PM" today, "Tue 4:30 PM" otherwise. */
export function shortWhen(d: Date, now = new Date()): string {
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return sameDay(d, now) ? time : `${d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`;
}

export const longDay = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

const hours = (n: number) => (n === 1 ? '1 hour' : `${n} hours`);

export const money = (amount: number | null | undefined, currency: string | null | undefined) =>
  formatMoney(amount, currency, { defaultCurrency: 'INR', emptyForNull: true });

/**
 * The rule line shown on cards and the booking confirmation:
 * "Free cancellation until 4:30 PM" (or "Late cancellation — ₹100 fee" once past it).
 * Null when there's nothing to say (no consequence and no deadline).
 */
export function cancelRuleText(freeCancelUntil: string | null | undefined, policy: BookingPolicy | undefined, now = new Date()): string | null {
  const until = utc(freeCancelUntil);
  if (!until || !policy) return null;
  const fee = policy.lateCancelConsequence === 'fee' && policy.lateCancelFee ? money(policy.lateCancelFee, policy.currency) : null;
  if (until.getTime() >= now.getTime()) return `Free cancellation until ${shortWhen(until, now)}`;
  return fee ? `Cancelling now costs a ${fee} late fee` : null;
}

/** The late-cancel sheet's sentence: "You're cancelling within 2 hours. A ₹100 late fee applies." */
export function lateCancelText(info: Pick<LateCancelInfo, 'cutoffHours' | 'consequence' | 'fee' | 'currency'>): string {
  const head = `You're cancelling within ${hours(info.cutoffHours)} of the start.`;
  return info.consequence === 'fee' && info.fee
    ? `${head} A ${money(info.fee, info.currency)} late fee applies.`
    : `${head} It will be recorded as a late cancellation.`;
}

/** What the policy says a cancel right now would cost — null when it's free (before the cut-off, or no consequence). */
export function lateCancelFromPolicy(startsAt: string, freeCancelUntil: string | null | undefined, policy: BookingPolicy | undefined, pt: boolean, now = new Date()): LateCancelInfo | null {
  const until = utc(freeCancelUntil);
  if (!policy || !until || until.getTime() >= now.getTime() || policy.lateCancelConsequence === 'none') return null;
  const info = {
    consequence: policy.lateCancelConsequence, fee: policy.lateCancelFee ?? null, currency: policy.currency,
    cutoffHours: pt ? policy.ptCancelCutoffHours : policy.classCancelCutoffHours, freeCancelUntil: until.toISOString(), startsAt,
  };
  return { ...info, message: lateCancelText(info) };
}

type Body = { code?: string; message?: string; data?: Record<string, unknown> };
function coded(e: unknown, status: number, code: string): Body | null {
  if (!isAxiosError(e) || e.response?.status !== status) return null;
  const body = e.response.data as Body | undefined;
  return body?.code === code ? body : null;
}

/** The 409 LATE_CANCEL_CONFIRM answer (cancel again with confirmLate=true), or null. */
export function lateCancelFrom(e: unknown): LateCancelInfo | null {
  const body = coded(e, 409, LATE_CANCEL_CONFIRM);
  if (!body) return null;
  const d = body.data ?? {};
  const info = {
    consequence: (d.consequence === 'fee' ? 'fee' : 'none') as 'fee' | 'none',
    fee: typeof d.fee === 'number' ? d.fee : null,
    currency: typeof d.currency === 'string' ? d.currency : 'INR',
    cutoffHours: typeof d.cutoffHours === 'number' ? d.cutoffHours : 0,
    freeCancelUntil: String(d.freeCancelUntil ?? ''),
    startsAt: String(d.startsAt ?? ''),
  };
  return { ...info, message: lateCancelText(info) };
}

/** The 422 BOOKING_BLOCKED answer (self-booking paused), or null. */
export function bookingBlockedFrom(e: unknown): BookingBlockedInfo | null {
  const body = coded(e, 422, BOOKING_BLOCKED);
  if (!body) return null;
  return {
    until: String(body.data?.until ?? ''),
    reason: String(body.data?.reason ?? ''),
    message: body.message ?? 'Booking is paused on your account.',
  };
}

/** "1 of 3 no-shows in the last 30 days" */
export const strikesText = (strikes: number, of: number, days: number) =>
  `${Math.min(strikes, of)} of ${of} no-show${of === 1 ? '' : 's'} in the last ${days} days`;

export const penaltyTitle = (type: string) => (type === 'late_cancel' ? 'Late cancel' : 'No-show');

/** "Fee ₹100 · INV-2026-00012 (Sent)" / "Strike" */
export function penaltyDetail(p: { feeAmount?: number | null; currency?: string | null; feeInvoiceNo?: string | null; feeInvoiceStatus?: string | null; strike: boolean }): string {
  const parts: string[] = [];
  if (p.feeAmount) parts.push(`Fee ${money(p.feeAmount, p.currency)}${p.feeInvoiceNo ? ` · ${p.feeInvoiceNo}${p.feeInvoiceStatus ? ` (${p.feeInvoiceStatus})` : ''}` : ''}`);
  if (p.strike) parts.push('Strike');
  return parts.join(' · ') || 'Recorded';
}
