import axiosInstance from '../../../api/axios';
import { ENDPOINTS } from '../../../api/endpoints';
import { ApiResponse, Role } from '../types/moduleAccess.types';

// ─── 0. List roles ───────────────────────────────────────────────
export const fetchRoles = async (): Promise<ApiResponse<Role[]>> => {
  const { data } = await axiosInstance.get<ApiResponse<Role[]>>(ENDPOINTS.ROLES);
  return data;
};

// ─── 1. List available module keys ───────────────────────────────
export interface RoleInput { name?: string; description?: string | null }

export const createRole = async (payload: { name: string; description?: string | null }): Promise<ApiResponse<Role>> => {
  const { data } = await axiosInstance.post<ApiResponse<Role>>(ENDPOINTS.ROLES, payload);
  return data;
};

export const updateRole = async (id: string, payload: RoleInput): Promise<ApiResponse<Role>> => {
  const { data } = await axiosInstance.put<ApiResponse<Role>>(`${ENDPOINTS.ROLES}/${id}`, payload);
  return data;
};

export const deleteRole = async (id: string): Promise<ApiResponse<null>> => {
  const { data } = await axiosInstance.delete<ApiResponse<null>>(`${ENDPOINTS.ROLES}/${id}`);
  return data;
};

// ─── User role assignment (the target user's sessions are revoked server-side) ──
export const assignUserRole = async (userId: number, roleId: string): Promise<ApiResponse<null>> => {
  const { data } = await axiosInstance.post<ApiResponse<null>>(`/users/${userId}/roles`, { roleId });
  return data;
};

/** Reverts the user to the gym's client role. `roleId` must be the user's current role. */
export const revokeUserRole = async (userId: number, roleId: string): Promise<ApiResponse<null>> => {
  const { data } = await axiosInstance.delete<ApiResponse<null>>(`/users/${userId}/roles/${roleId}`);
  return data;
};
