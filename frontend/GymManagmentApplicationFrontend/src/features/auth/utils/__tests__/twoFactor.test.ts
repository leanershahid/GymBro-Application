import { describe, expect, it } from '@jest/globals';
import {
  graceDaysLeft, isRecoveryCode, nextStepAfterLogin, recoveryCodesText, sanitizeCode, sanitizeRecoveryCode,
} from '../twoFactor';

describe('two-step sign-in helpers', () => {
  it('keeps only six digits from pasted or autofilled codes', () => {
    expect(sanitizeCode('123 456')).toBe('123456');
    expect(sanitizeCode('Your code: 987-654-321')).toBe('987654');
    expect(sanitizeCode('abc')).toBe('');
  });

  it('accepts recovery codes with any case or spacing', () => {
    expect(sanitizeRecoveryCode(' ABCDE-fghij ')).toBe('abcde-fghij');
    expect(isRecoveryCode('abcde-fghij')).toBe(true);
    expect(isRecoveryCode('abcde')).toBe(false);
  });

  it('routes a login response', () => {
    expect(nextStepAfterLogin({ requiresTwoFactor: true, challengeToken: 'c' })).toBe('challenge');
    expect(nextStepAfterLogin({ accessToken: 'a', twoFactorSetupRequired: true, twoFactorSetupBlocking: true })).toBe('setup-blocking');
    expect(nextStepAfterLogin({ accessToken: 'a', twoFactorSetupRequired: true })).toBe('setup-offer');
    // Responses from servers without 2FA (no new fields) carry on as before.
    expect(nextStepAfterLogin({ accessToken: 'a', role: 'admin' })).toBe('done');
    expect(nextStepAfterLogin(null)).toBe('done');
  });

  it('counts grace days, rounding up', () => {
    const now = new Date('2026-11-05T12:00:00Z');
    expect(graceDaysLeft('2026-11-12T12:00:00Z', now)).toBe(7);
    expect(graceDaysLeft('2026-11-05T15:00:00Z', now)).toBe(1);
    expect(graceDaysLeft('2026-11-01T00:00:00Z', now)).toBe(0);
    expect(graceDaysLeft(null, now)).toBeNull();
  });

  it('writes recovery codes as a plain text file', () => {
    const text = recoveryCodesText(['aaaaa-bbbbb', 'ccccc-ddddd'], 'a@b.com', new Date('2026-11-05T00:00:00Z'));
    expect(text).toContain('a@b.com');
    expect(text).toContain('2026-11-05');
    expect(text.split('\n')).toContain('ccccc-ddddd');
  });
});
