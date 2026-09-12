import { useMutation } from '@tanstack/react-query';
import { login } from './authApi';
import { LoginPayload } from '../types/auth.types';
import { setAuthToken } from '../../../api/axios';

export const useLogin = () =>
  useMutation({
    mutationFn: (payload: LoginPayload) => login(payload),
    onSuccess: (res) => {
      // Store the JWT so all subsequent requests include it
      if (res.success && res.data?.accessToken) {
        setAuthToken(res.data.accessToken);
      }
    },
  });
