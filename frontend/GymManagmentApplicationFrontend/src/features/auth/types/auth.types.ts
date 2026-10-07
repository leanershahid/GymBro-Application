import { ApiResponse } from '../../../api/types';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthData {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  role: string;
  userId: number;
  tenantId: number;
  branchId: number | null;
  email: string;
}

export type LoginResponse = ApiResponse<AuthData>;
