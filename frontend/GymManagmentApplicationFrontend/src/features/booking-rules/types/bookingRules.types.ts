// Cancellation & no-show rules (roadmap feature 9). Timestamps are UTC ISO strings.
// Server: Application/Scheduling/BookingPenaltyEngine.cs, BookingRulesDtos.cs.

export type LateCancelConsequence = 'none' | 'fee' | 'lose_credit';
export type NoShowConsequence = 'none' | 'fee' | 'lose_credit' | 'strike';

/** GET/PUT /booking-rules/settings (admin). */
export interface BookingRulesSettings {
  classCancelCutoffHours: number;
  ptCancelCutoffHours: number;
  lateCancelConsequence: LateCancelConsequence;
  lateCancelFee: number;
  noShowConsequence: NoShowConsequence;
  noShowFee: number;
  strikesBeforeBlock: number;
  strikeWindowDays: number;
  blockDays: number;
  staffCanWaive: boolean;
  autoNoShowEnabled: boolean;
  autoNoShowAfterMinutes: number;
  /** Server-set: when the automatic no-show was switched on. */
  autoNoShowSince?: string | null;
}

export interface BookingRulesSettingsResponse extends BookingRulesSettings {
  /** False while class credits aren't consumed on booking — "lose credit" is hidden. */
  creditsSupported: boolean;
  currency: string;
}

/** GET /booking-rules/policy: what members see (effective consequences only). */
export interface BookingPolicy {
  classCancelCutoffHours: number;
  ptCancelCutoffHours: number;
  lateCancelConsequence: 'none' | 'fee';
  lateCancelFee?: number | null;
  noShowConsequence: 'none' | 'fee' | 'strike';
  noShowFee?: number | null;
  strikesBeforeBlock: number;
  strikeWindowDays: number;
  blockDays: number;
  currency: string;
}

export interface BookingBlock {
  id: number;
  from: string;
  until: string;
  reason: string;
  liftedAt?: string | null;
  liftReason?: string | null;
}

export interface BookingPenalty {
  id: number;
  clientId: number;
  clientName?: string | null;
  type: 'late_cancel' | 'no_show';
  bookingId?: number | null;
  classId?: number | null;
  ptSessionId?: number | null;
  label?: string | null;
  sessionStartsAt: string;
  feeAmount?: number | null;
  currency?: string | null;
  feeInvoiceId?: number | null;
  feeInvoiceNo?: string | null;
  feeInvoiceStatus?: string | null;
  strike: boolean;
  createdAt: string;
  waived: boolean;
  waivedAt?: string | null;
  waivedByName?: string | null;
  waiveReason?: string | null;
}

export interface BookingStanding {
  clientId: number;
  strikes: number;
  strikesBeforeBlock: number;
  strikeWindowDays: number;
  strikesEnabled: boolean;
  activeBlock?: BookingBlock | null;
  penalties: BookingPenalty[];
  canWaive: boolean;
}

export interface WaiveResult {
  penalty: BookingPenalty;
  feeVoided: boolean;
}

/** 409 LATE_CANCEL_CONFIRM payload. */
export interface LateCancelInfo {
  consequence: 'none' | 'fee';
  fee?: number | null;
  currency: string;
  cutoffHours: number;
  freeCancelUntil: string;
  startsAt: string;
  message: string;
}

/** 422 BOOKING_BLOCKED payload. */
export interface BookingBlockedInfo {
  until: string;
  reason: string;
  message: string;
}
