import { useMutation, useQuery } from '@tanstack/react-query';
import { login, getMe } from './authApi';
import { LoginPayload } from '../types/auth.types';
import { setAuthToken } from '../../../api/axios';
import { setSession } from '../../../api/session';
import { queryKeys } from '../../../api/queryKeys';

export const useLogin = () =>
  useMutation({
    mutationFn: (payload: LoginPayload) => login(payload),
    onSuccess: (res) => {
      // Store the JWT so all subsequent requests include it
      if (res.success && res.data?.accessToken) {
        setAuthToken(res.data.accessToken);
        setSession({
          userId:   res.data.userId,
          role:     res.data.role,
          tenantId: res.data.tenantId,
          branchId: res.data.branchId ?? null,
        });
      }
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
