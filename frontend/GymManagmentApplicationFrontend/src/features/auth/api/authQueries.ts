import { useMutation, useQuery } from '@tanstack/react-query';
import { login, getMe, forgotPassword, resetPassword, changePassword } from './authApi';
import { LoginPayload, TwoFactorVerifyPayload } from '../types/auth.types';
import { verifyTwoFactor, sendTwoFactorEmailCode } from './twoFactorApi';
import { loadDeviceToken, saveDeviceToken } from './trustedDeviceStore';
import { applyAuth } from '../../../api/authStore';
import { queryKeys } from '../../../api/queryKeys';

export const useLogin = () =>
  useMutation({
    // A remembered device (2FA "remember this device") skips the second step while the server still trusts it.
    mutationFn: async (payload: LoginPayload) =>
      login({ ...payload, deviceToken: payload.deviceToken ?? await loadDeviceToken(payload.email) ?? undefined }),
    onSuccess: async (res) => {
      // Activate + persist the session so the user stays signed in across restarts
      if (res.success && res.data?.accessToken) await applyAuth(res.data);
    },
  });

export const useMe = () =>
  useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: async () => {
      const res = await getMe();
      if (!res.success || !res.data) throw new Error(res.message || 'Failed to load profile.');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

/** Second step of a 2FA sign-in: activates the session and keeps the "remember this device" token. */
export const useVerifyTwoFactor = (email: string) =>
  useMutation({
    mutationFn: (payload: TwoFactorVerifyPayload) => verifyTwoFactor(payload),
    onSuccess: async (res) => {
      if (!res.success || !res.data?.accessToken) return;
      if (res.data.deviceToken) await saveDeviceToken(email, res.data.deviceToken);
      await applyAuth(res.data);
    },
  });

export const useSendTwoFactorEmailCode = () => useMutation({ mutationFn: sendTwoFactorEmailCode });

export const useForgotPassword =() => useMutation({ mutationFn: forgotPassword });
export const useResetPassword = () => useMutation({ mutationFn: resetPassword });
export const useChangePassword = () => useMutation({ mutationFn: changePassword });
