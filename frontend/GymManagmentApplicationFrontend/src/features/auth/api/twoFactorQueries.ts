import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSession } from '../../../api/session';
import {
  disableTwoFactor, enableTwoFactor, forgetTrustedDevices, getTwoFactorPolicy, getTwoFactorStatus,
  regenerateRecoveryCodes, resetUserTwoFactor, saveTwoFactorPolicy, startTwoFactorSetup,
} from './twoFactorApi';
import { TwoFactorPolicy } from '../types/auth.types';

/** Feature-local query keys (root "two-factor"); per user so a different sign-in never sees stale state. */
export const K = {
  all: ['two-factor'] as const,
  status: () => ['two-factor', 'status', getSession()?.userId ?? 0] as const,
  policy: () => ['two-factor', 'policy', getSession()?.tenantId ?? 0] as const,
};

async function data<T>(p: Promise<{ success: boolean; message: string; data: T | null }>): Promise<T> {
  const res = await p;
  if (!res.success || res.data === null) throw new Error(res.message || 'Request failed.');
  return res.data;
}

export const useTwoFactorStatus = (enabled = true) =>
  useQuery({ queryKey: K.status(), queryFn: () => data(getTwoFactorStatus()), enabled, staleTime: 30_000 });

export const useTwoFactorPolicy = (enabled = true) =>
  useQuery({ queryKey: K.policy(), queryFn: () => data(getTwoFactorPolicy()), enabled });

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: K.all });
}

export const useStartTwoFactorSetup = () => useMutation({ mutationFn: startTwoFactorSetup });

export const useEnableTwoFactor = () => {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: enableTwoFactor, onSuccess: res => { if (res.success) void invalidate(); } });
};

export const useDisableTwoFactor = () => {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: disableTwoFactor, onSuccess: res => { if (res.success) void invalidate(); } });
};

export const useRegenerateRecoveryCodes = () => {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: regenerateRecoveryCodes, onSuccess: res => { if (res.success) void invalidate(); } });
};

export const useForgetTrustedDevices = () => {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: forgetTrustedDevices, onSuccess: () => { void invalidate(); } });
};

export const useSaveTwoFactorPolicy = () => {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (p: TwoFactorPolicy) => saveTwoFactorPolicy(p), onSuccess: () => { void invalidate(); } });
};

/** Admin recovery for another user (staff/member detail screens). */
export const useResetUserTwoFactor = () =>
  useMutation({ mutationFn: ({ userId, reason }: { userId: number; reason?: string }) => resetUserTwoFactor(userId, reason) });
