import React, { useState } from 'react';
import { showAlert } from '../../common/components/dialogs';
import { useToast } from '../../common/components/Toast';
import { apiErrorText } from '../../../api/apiError';
import { useCancelClassBooking, useCancelPtSession } from '../api/bookingQueries';
import {
  LateCancelInfo, LateCancelSheet, lateCancelFrom, lateCancelFromPolicy, useBookingPolicy,
} from '../../booking-rules/routes';

export interface CancelTarget {
  kind: 'class' | 'pt';
  id: number;
  /** "Spin · Today 6:30 PM" */
  title: string;
  startsAt: string;
  freeCancelUntil?: string | null;
  /** Leaving a class waitlist: always free. */
  waitlisted?: boolean;
  /** Extra line for the plain confirm (e.g. "An unpaid invoice … will be voided."). */
  extra?: string;
}

const keyOf = (t: CancelTarget) => `${t.kind === 'class' ? 'c' : 'p'}${t.id}`;

/**
 * Cancelling a class booking / PT session with the gym's cut-off (feature 9): before the
 * free-cancellation time a plain "Cancel this booking?" confirm; after it, when the gym charges
 * for late cancels, the late-cancel sheet ("You're cancelling within 2 hours. A ₹100 late fee
 * applies." — Keep booking / Cancel anyway). A 409 LATE_CANCEL_CONFIRM from the server (stale
 * policy, clock skew) opens the same sheet. Render `sheet` once in the tab.
 */
export function useCancelFlow(userId: number) {
  const toast = useToast();
  const policy = useBookingPolicy(userId > 0).data;
  const cancelClassM = useCancelClassBooking(userId);
  const cancelPtM = useCancelPtSession(userId);
  const [late, setLate] = useState<{ target: CancelTarget; info: LateCancelInfo } | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const run = async (t: CancelTarget, confirmLate: boolean) => {
    setPendingKey(keyOf(t));
    try {
      if (t.kind === 'class') await cancelClassM.mutateAsync({ id: t.id, confirmLate });
      else await cancelPtM.mutateAsync({ id: t.id, confirmLate });
      const fee = confirmLate && late?.info.consequence === 'fee' ? ' The late fee was added to your billing.' : '';
      toast.show({ type: 'success', message: (t.waitlisted ? 'Removed from the waitlist.' : t.kind === 'pt' ? 'Session cancelled.' : 'Booking cancelled.') + fee });
      setLate(null);
    } catch (e) {
      const info = lateCancelFrom(e);
      if (info && !confirmLate) setLate({ target: t, info });
      else { setLate(null); showAlert("Couldn't cancel", apiErrorText(e)); }
    } finally {
      setPendingKey(null);
    }
  };

  const request = (t: CancelTarget) => {
    const info = t.waitlisted ? null : lateCancelFromPolicy(t.startsAt, t.freeCancelUntil, policy, t.kind === 'pt');
    if (info) { setLate({ target: t, info }); return; }
    showAlert(
      t.waitlisted ? 'Leave the waitlist?' : t.kind === 'pt' ? 'Cancel this session?' : 'Cancel this booking?',
      `${t.title}${t.extra ? `\n\n${t.extra}` : ''}`,
      [
        { text: 'Keep', style: 'cancel' },
        { text: t.waitlisted ? 'Leave' : 'Cancel it', style: 'destructive', onPress: () => { void run(t, false); } },
      ],
    );
  };

  const sheet = (
    <LateCancelSheet
      info={late?.info ?? null}
      title={late?.target.title}
      loading={!!late && pendingKey === keyOf(late.target)}
      onConfirm={() => { if (late) void run(late.target, true); }}
      onClose={() => setLate(null)}
    />
  );

  return { request, sheet, pendingKey, policy };
}
