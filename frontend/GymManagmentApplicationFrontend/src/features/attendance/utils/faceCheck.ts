import { isAxiosError } from 'axios';
import type { PillTone } from '../../common/components/StatusPill';
import type { AttendanceRecord, FaceAttempt, FaceAttemptOutcome } from '../types/attendance.types';

/**
 * Face check-in (pure helpers, unit-tested in __tests__/faceCheck.test.ts).
 *
 * The API answers the face step with a machine code in the envelope:
 *   422 FACE_ENROLL_REQUIRED → open enrolment (consent + reference selfie)
 *   422 FACE_MISMATCH        → retry (data.attemptsLeft), or the front desk
 *   422 FACE_NOT_CLEAR       → retry with a hint (no face / several faces)
 *   422 FACE_LOCKED          → too many mismatches: front desk
 *   422 FACE_CONSENT_REQUIRED→ consent first
 *   503 FACE_UNAVAILABLE     → service down: front desk (nobody is checked in)
 */
export type FaceErrorCode =
  | 'FACE_ENROLL_REQUIRED' | 'FACE_MISMATCH' | 'FACE_NOT_CLEAR' | 'FACE_LOCKED' | 'FACE_UNAVAILABLE' | 'FACE_CONSENT_REQUIRED';

const CODES: readonly FaceErrorCode[] = [
  'FACE_ENROLL_REQUIRED', 'FACE_MISMATCH', 'FACE_NOT_CLEAR', 'FACE_LOCKED', 'FACE_UNAVAILABLE', 'FACE_CONSENT_REQUIRED',
];

export interface FaceError {
  code: FaceErrorCode;
  message: string;
  /** FACE_MISMATCH: tries left before the front desk. */
  attemptsLeft: number | null;
  /** What the user can do next. */
  next: 'enroll' | 'retry' | 'desk' | 'consent';
}

const DEFAULT_MESSAGE: Record<FaceErrorCode, string> = {
  FACE_ENROLL_REQUIRED: 'Set up face check-in first: take a reference selfie.',
  FACE_MISMATCH: "Your selfie didn't match your face check-in photo. Try again in good light.",
  FACE_NOT_CLEAR: "We couldn't see your face clearly. Face the camera in good light and try again.",
  FACE_LOCKED: 'Too many face check attempts. Please check in at the front desk.',
  FACE_UNAVAILABLE: 'Face check unavailable — check in at the front desk.',
  FACE_CONSENT_REQUIRED: 'Please agree to face check-in first.',
};

/** The face-check error in an axios error, or null for anything else. */
export function faceErrorFrom(e: unknown): FaceError | null {
  if (!isAxiosError(e) || !e.response) return null;
  const body = e.response.data as { code?: string; message?: string; data?: { attemptsLeft?: number } | null } | undefined;
  const code = body?.code as FaceErrorCode | undefined;
  if (!code || !CODES.includes(code)) return null;
  const attemptsLeft = typeof body?.data?.attemptsLeft === 'number' ? body.data.attemptsLeft : null;
  const next: FaceError['next'] =
    code === 'FACE_ENROLL_REQUIRED' ? 'enroll'
      : code === 'FACE_CONSENT_REQUIRED' ? 'consent'
      : code === 'FACE_LOCKED' || code === 'FACE_UNAVAILABLE' || (code === 'FACE_MISMATCH' && attemptsLeft === 0) ? 'desk'
      : 'retry';
  return { code, message: body?.message || DEFAULT_MESSAGE[code], attemptsLeft, next };
}

/** "97%" (whole percent, never rounds a miss up to the threshold). */
export const formatScore = (score: number) => `${Math.floor(score)}%`;

/** Attendance-log badge for a visit: "Face ✓ 97%", or null when the visit had no face check. */
export function faceBadge(r: Pick<AttendanceRecord, 'faceVerified' | 'faceScore'>): { label: string; tone: PillTone } | null {
  if (r.faceVerified == null) return null;
  if (!r.faceVerified) return { label: 'Face failed', tone: 'err' };
  return { label: r.faceScore != null ? `Face ✓ ${formatScore(r.faceScore)}` : 'Face ✓', tone: 'ok' };
}

export const OUTCOME_LABEL: Record<FaceAttemptOutcome, string> = {
  matched: 'Face ✓',
  mismatch: 'Face failed',
  not_clear: 'Face not clear',
  unavailable: 'Service unavailable',
  locked: 'Locked (too many tries)',
};

/** Badge for one face check in the failed-attempts list. */
export function attemptBadge(a: Pick<FaceAttempt, 'outcome' | 'similarity'>): { label: string; tone: PillTone } {
  if (a.outcome === 'matched') return { label: a.similarity != null ? `Face ✓ ${formatScore(a.similarity)}` : 'Face ✓', tone: 'ok' };
  if (a.outcome === 'mismatch') return { label: a.similarity != null ? `Face failed ${formatScore(a.similarity)}` : 'Face failed', tone: 'err' };
  return { label: OUTCOME_LABEL[a.outcome] ?? a.outcome, tone: a.outcome === 'not_clear' ? 'warn' : 'neutral' };
}

export interface FaceSettingsInput { threshold: string; keepDays: string }
export interface FaceSettingsErrors { threshold?: string; keepDays?: string }

/** Client-side check of the face check-in fields (the API enforces the same ranges). */
export function validateFaceSettings({ threshold, keepDays }: FaceSettingsInput): FaceSettingsErrors {
  const t = Number(threshold);
  const k = Number(keepDays);
  const errors: FaceSettingsErrors = {};
  if (threshold.trim() === '' || !Number.isInteger(t) || t < 80 || t > 99) errors.threshold = 'Between 80 and 99';
  if (keepDays.trim() === '' || !Number.isInteger(k) || k < 0 || k > 90) errors.keepDays = 'Between 0 and 90 (0 = don’t keep)';
  return errors;
}

/** "Selfies are kept for 30 days" / "Selfies taken at check-in aren't kept". */
export function retentionText(days: number): string {
  if (days <= 0) return 'Selfies taken at check-in are compared and then deleted; they aren’t kept.';
  return `Selfies taken at check-in are kept for ${days} day${days === 1 ? '' : 's'} so staff can review them, then deleted.`;
}

/** Consent / settings wording for where faces are compared. */
export function providerText(provider: 'local' | 'aws' | 'none' | undefined): string {
  return provider === 'aws'
    ? 'Photos are compared by Amazon Web Services (AWS Rekognition) on the gym’s behalf and are not kept by AWS.'
    : 'Photos are compared on the gym’s own GymBro server; they are not sent to any other company.';
}

/**
 * Whether this browser can open a live camera (getUserMedia over a secure origin). Phones always
 * can (expo-camera); web falls back to "use the app on your phone" when it can't.
 */
export function browserCameraAvailable(nav: { mediaDevices?: { getUserMedia?: unknown } } | undefined, secure: boolean | undefined): boolean {
  return !!secure && typeof nav?.mediaDevices?.getUserMedia === 'function';
}

/** MIME type of a captured photo URI (expo-camera gives JPEG; a web capture is a data: URI). */
export function selfieMimeType(uri: string): string {
  const m = /^data:(image\/(?:jpeg|png));/i.exec(uri);
  if (m) return m[1].toLowerCase();
  return /\.png(\?|$)/i.test(uri) ? 'image/png' : 'image/jpeg';
}
