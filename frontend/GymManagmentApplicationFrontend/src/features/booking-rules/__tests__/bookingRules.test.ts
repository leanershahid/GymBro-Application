import { describe, expect, it } from '@jest/globals';
import { AxiosError, AxiosHeaders } from 'axios';
import { adminFromPath, ownerOf } from '../../dashboard/admin/adminRoutes';
import { parseNotificationRoute } from '../../notifications/utils/notificationRoutes';
import {
  bookingBlockedFrom, cancelRuleText, lateCancelFrom, lateCancelFromPolicy, lateCancelText, strikesText,
} from '../utils/bookingRulesFormat';
import { BookingPolicy } from '../types/bookingRules.types';

const policy: BookingPolicy = {
  classCancelCutoffHours: 2, ptCancelCutoffHours: 24, lateCancelConsequence: 'fee', lateCancelFee: 100,
  noShowConsequence: 'strike', strikesBeforeBlock: 3, strikeWindowDays: 30, blockDays: 7, currency: 'INR',
};

function axiosError(status: number, data: unknown): AxiosError {
  const e = new AxiosError('x', String(status));
  e.response = { status, data, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } };
  return e;
}

describe('booking rules', () => {
  it('wires the admin route under the classes module and the push route to My bookings', () => {
    expect(adminFromPath(['booking-rules'])).toEqual({ screen: 'booking-rules', id: 0, sub: [] });
    expect(ownerOf('booking-rules')).toBe('classes');
    expect(parseNotificationRoute({ route: 'my-bookings' } as never)).toEqual({ screen: 'my-bookings' });
  });

  it('shows the free-cancellation time, then the late fee', () => {
    const now = new Date('2026-11-10T10:00:00Z');
    expect(cancelRuleText('2026-11-10T12:00:00Z', policy, now)).toMatch(/^Free cancellation until /);
    expect(cancelRuleText('2026-11-10T09:00:00Z', policy, now)).toMatch(/late fee/);
    expect(cancelRuleText('2026-11-10T09:00:00Z', { ...policy, lateCancelConsequence: 'none' }, now)).toBeNull();
  });

  it('asks for confirmation only after the cut-off and only with a consequence', () => {
    const now = new Date('2026-11-10T10:00:00Z');
    expect(lateCancelFromPolicy('2026-11-10T11:00:00Z', '2026-11-10T10:00:00Z', policy, false, now)).toBeNull(); // exactly at the cut-off
    const info = lateCancelFromPolicy('2026-11-10T11:00:00Z', '2026-11-10T09:00:00Z', policy, false, now);
    expect(info?.message).toMatch(/^You're cancelling within 2 hours of the start\. A .*100.* late fee applies\.$/);
    expect(lateCancelFromPolicy('2026-11-10T11:00:00Z', '2026-11-10T09:00:00Z', { ...policy, lateCancelConsequence: 'none' }, false, now)).toBeNull();
    expect(lateCancelText({ cutoffHours: 1, consequence: 'none', fee: null, currency: 'INR' })).toMatch(/within 1 hour/);
  });

  it('reads the 409 / 422 codes', () => {
    const late = lateCancelFrom(axiosError(409, { code: 'LATE_CANCEL_CONFIRM', data: { consequence: 'fee', fee: 100, currency: 'INR', cutoffHours: 2 } }));
    expect(late?.consequence).toBe('fee');
    expect(lateCancelFrom(axiosError(409, { code: 'OTHER' }))).toBeNull();
    const blocked = bookingBlockedFrom(axiosError(422, { code: 'BOOKING_BLOCKED', message: 'Paused', data: { until: '2026-11-17T10:00:00Z', reason: '3 no-shows' } }));
    expect(blocked?.until).toBe('2026-11-17T10:00:00Z');
    expect(bookingBlockedFrom(axiosError(422, { code: 'SAFETY_REQUIRED' }))).toBeNull();
    expect(strikesText(1, 3, 30)).toBe('1 of 3 no-shows in the last 30 days');
  });
});
