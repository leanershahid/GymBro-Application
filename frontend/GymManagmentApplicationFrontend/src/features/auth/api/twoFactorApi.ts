import { isAxiosError } from 'axios';
import axiosInstance from '../../../api/axios';
import { ApiResponse } from '../../../api/types';
import {
  AuthData, TwoFactorPolicy, TwoFactorRecoveryCodes, TwoFactorSetup, TwoFactorStatus, TwoFactorVerifyPayload,
} from '../types/auth.types';

// Two-step sign-in (roadmap feature 10). Every call returns the envelope, including 4xx bodies,
// so screens can show the server's message ("That code is incorrect…").
const EP = {
  verify: '/auth/2fa/verify',
  emailCode: '/auth/2fa/email-code',
  status: '/auth/2fa/status',
  setup: '/auth/2fa/setup',
  enable: '/auth/2fa/enable',
  disable: '/auth/2fa/disable',
  recoveryCodes: '/auth/2fa/recovery-codes',
  trustedDevices: '/auth/2fa/trusted-devices',
  policy: '/auth/2fa/policy',
  adminReset: (userId: number) => `/auth/2fa/users/${userId}/reset`,
} as const;

async function call<T>(method: 'get' | 'post' | 'put' | 'delete', url: string, body?: unknown): Promise<ApiResponse<T>> {
  try {
    const { data } = method === 'get' || method === 'delete'
      ? await axiosInstance[method]<ApiResponse<T>>(url)
      : await axiosInstance[method]<ApiResponse<T>>(url, body ?? {});
    return data;
  } catch (err) {
    if (isAxiosError<ApiResponse<T>>(err) && err.response?.data?.message) return err.response.data;
    throw err;
  }
}

/** True when a failed verify means "start again from the password" (challenge used, expired or burnt). */
export const challengeEnded = (res: ApiResponse<unknown>) => !!res.errors?.includes('challenge_expired');

/** Remaining tries on the current challenge, from the server's `attempts_remaining:N` error code. */
export function attemptsRemaining(res: ApiResponse<unknown>): number | null {
  const tag = res.errors?.find(e => e.startsWith('attempts_remaining:'));
  return tag ? Number(tag.split(':')[1]) : null;
}

export const verifyTwoFactor = (body: TwoFactorVerifyPayload) => call<AuthData>('post', EP.verify, body);
export const sendTwoFactorEmailCode = (challengeToken: string) => call<null>('post', EP.emailCode, { challengeToken });
export const getTwoFactorStatus = () => call<TwoFactorStatus>('get', EP.status);
export const startTwoFactorSetup = () => call<TwoFactorSetup>('post', EP.setup);
export const enableTwoFactor = (code: string) => call<TwoFactorRecoveryCodes>('post', EP.enable, { code });
export const disableTwoFactor = (body: { password: string; code: string }) => call<null>('post', EP.disable, body);
export const regenerateRecoveryCodes = (code: string) => call<TwoFactorRecoveryCodes>('post', EP.recoveryCodes, { code });
export const forgetTrustedDevices = () => call<{ removed: number }>('delete', EP.trustedDevices);
export const getTwoFactorPolicy = () => call<TwoFactorPolicy>('get', EP.policy);
export const saveTwoFactorPolicy = (body: TwoFactorPolicy) => call<TwoFactorPolicy>('put', EP.policy, body);
export const resetUserTwoFactor = (userId: number, reason?: string) => call<null>('post', EP.adminReset(userId), { reason });
