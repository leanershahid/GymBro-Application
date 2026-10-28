import { isAxiosError } from 'axios';
import axiosInstance from '../../../api/axios';
import { ENDPOINTS } from '../../../api/endpoints';
import { LoginPayload, LoginResponse, MeResponse } from '../types/auth.types';

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
