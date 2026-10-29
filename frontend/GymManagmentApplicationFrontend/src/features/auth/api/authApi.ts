import { isAxiosError } from 'axios';
import axiosInstance from '../../../api/axios';
import { ENDPOINTS } from '../../../api/endpoints';
import { AuthData, LoginPayload, LoginResponse, MeResponse } from '../types/auth.types';
import { ApiResponse } from '../../../api/types';

export const login = async (payload: LoginPayload): Promise<LoginResponse> => {
  try {
    const { data } = await axiosInstance.post<LoginResponse>(ENDPOINTS.LOGIN, payload);
    return data;
  } catch (err) {
    // The API returns a structured { success, message, errors } body even on 4xx
    // (e.g. 401 for bad credentials) — surface it instead of letting axios throw it away.
    if (isAxiosError<LoginResponse>(err) && err.response?.data) {
      return err.response.data;
    }
    throw err;
  }
};

export const getMe = async (): Promise<MeResponse> => {
  const { data } = await axiosInstance.get<MeResponse>(ENDPOINTS.ME);
  return data;
};

// Auth endpoints that answer 4xx with a readable { success:false, message } body — return it.
async function post<T>(url: string, body: unknown, method: 'post' | 'put' = 'post'): Promise<ApiResponse<T>> {
  try {
    const { data } = await axiosInstance[method]<ApiResponse<T>>(url, body);
    return data;
  } catch (err) {
    if (isAxiosError<ApiResponse<T>>(err) && err.response?.data?.message) return err.response.data;
    throw err;
  }
}

export const refreshSession = (refreshToken: string) => post<AuthData>(ENDPOINTS.REFRESH_TOKEN, { refreshToken });

export const logoutSession = (refreshToken: string | null) => post<null>(ENDPOINTS.LOGOUT, { refreshToken });

export const forgotPassword = (email: string) => post<null>(ENDPOINTS.FORGOT_PASSWORD, { email });

export const resetPassword = (body: { email: string; code: string; newPassword: string }) =>
  post<null>(ENDPOINTS.RESET_PASSWORD, body);

export const changePassword = (body: { currentPassword: string; newPassword: string }) =>
  post<null>(ENDPOINTS.CHANGE_PASSWORD, body, 'put');
