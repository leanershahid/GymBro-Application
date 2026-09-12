import axiosInstance from '../../../api/axios';
import { ENDPOINTS } from '../../../api/endpoints';
import { LoginPayload, LoginResponse } from '../types/auth.types';

export const login = async (payload: LoginPayload): Promise<LoginResponse> => {
  const { data } = await axiosInstance.post<LoginResponse>(ENDPOINTS.LOGIN, payload);
  return data;
};
