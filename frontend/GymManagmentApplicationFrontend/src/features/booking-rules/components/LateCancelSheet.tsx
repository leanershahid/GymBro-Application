import React from 'react';
import ConfirmSheet from '../../common/components/ConfirmSheet';
import { LateCancelInfo } from '../types/bookingRules.types';

/**
 * "You're cancelling within 2 hours. A ₹100 late fee applies." — Keep booking / Cancel anyway.
 * Shown from the gym's policy when the member taps Cancel after the free-cancellation time, and
 * from a 409 LATE_CANCEL_CONFIRM when the server knew better.
 */
export default function LateCancelSheet({ info, title, loading, onConfirm, onClose }: {
  info: LateCancelInfo | null;
  /** What is being cancelled, e.g. "Spin · Today 6:30 PM". */
  title?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <ConfirmSheet
      visible={!!info}
      title="Late cancellation"
      message={`${title ? `${title}\n\n` : ''}${info?.message ?? ''}`}
      confirmLabel="Cancel anyway"
      cancelLabel="Keep booking"
      onConfirm={onConfirm}
      onClose={onClose}
      loading={loading}
    />
  );
}
