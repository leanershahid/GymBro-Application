import { useMutation, useQuery } from '@tanstack/react-query';
import { login, getMe, forgotPassword, resetPassword, changePassword } from './authApi';
import { LoginPayload } from '../types/auth.types';
import { applyAuth } from '../../../api/authStore';
import { queryKeys } from '../../../api/queryKeys';

export const useLogin = () =>
  useMutation({
    mutationFn: (payload: LoginPayload) => login(payload),
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

export const useForgotPassword = () => useMutation({ mutationFn: forgotPassword });
export const useResetPassword = () => useMutation({ mutationFn: resetPassword });
export const useChangePassword = () => useMutation({ mutationFn: changePassword });
