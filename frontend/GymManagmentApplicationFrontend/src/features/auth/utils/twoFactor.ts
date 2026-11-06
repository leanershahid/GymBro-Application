import type { AuthData } from '../types/auth.types';

// Pure helpers for two-step sign-in (unit-tested in __tests__/twoFactor.test.ts).

export const CODE_LENGTH = 6;

/** Digits only, at most 6 — what pasting "123 456" or an SMS-style autofill gives the code boxes. */
export const sanitizeCode = (v: string) => v.replace(/\D/g, '').slice(0, CODE_LENGTH);

/** Recovery codes are 10 letters/digits, shown as "abcde-fghij"; accept any spacing/case. */
export const sanitizeRecoveryCode = (v: string) => v.replace(/[^A-Za-z0-9-]/g, '').slice(0, 11).toLowerCase();
export const isRecoveryCode = (v: string) => v.replace(/[^A-Za-z0-9]/g, '').length === 10;

/** What a login response asks the app to do next. Unknown/older responses fall through to 'done'. */
export type LoginNext = 'challenge' | 'setup-blocking' | 'setup-offer' | 'done';

export function nextStepAfterLogin(data: Partial<AuthData> | null | undefined): LoginNext {
  if (!data) return 'done';
  if (data.requiresTwoFactor && data.challengeToken) return 'challenge';
  if (data.twoFactorSetupBlocking) return 'setup-blocking';
  if (data.twoFactorSetupRequired) return 'setup-offer';
  return 'done';
}

/** Days left in the grace period, rounded up (a few hours left = 1); 0 once it's over. */
export function graceDaysLeft(graceEndsAt: string | null | undefined, now: Date = new Date()): number | null {
  if (!graceEndsAt) return null;
  const ms = new Date(graceEndsAt).getTime() - now.getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/** The text written to the recovery-codes file / share sheet. */
export function recoveryCodesText(codes: string[], account: string, generatedAt: Date = new Date()): string {
  return [
    'GymBro recovery codes',
    `Account: ${account}`,
    `Created: ${generatedAt.toISOString().slice(0, 10)}`,
    '',
    'Each code works once. Keep them somewhere safe and private.',
    '',
    ...codes,
    '',
  ].join('\n');
}
