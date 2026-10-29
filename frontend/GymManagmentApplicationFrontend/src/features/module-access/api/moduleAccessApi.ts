import axiosInstance from '../../../api/axios';
import { ENDPOINTS } from '../../../api/endpoints';
import {
  ApiResponse, ModuleAccessEntry, ModuleAccessMatrix,
  ModuleAccessPayload, BulkModuleAccessPayload,
  CheckAccessPayload, CheckAccessResult, Role,
} from '../types/moduleAccess.types';

// ─── 0. List roles ───────────────────────────────────────────────
export const fetchRoles = async (): Promise<ApiResponse<Role[]>> => {
  const { data } = await axiosInstance.get<ApiResponse<Role[]>>(ENDPOINTS.ROLES);
  return data;
};

// ─── 1. List available module keys ───────────────────────────────
export const fetchModuleKeys = async (): Promise<ApiResponse<string[]>> => {
  const { data } = await axiosInstance.get<ApiResponse<string[]>>(ENDPOINTS.MODULE_ACCESS_MODULES);
  return data;
};

// ─── 2. Get access entries for a role in a tenant ────────────────
export const fetchModuleAccess = async (
  tenantId: number, roleId: number,
): Promise<ApiResponse<ModuleAccessEntry[]>> => {
  const { data } = await axiosInstance.get<ApiResponse<ModuleAccessEntry[]>>(
    ENDPOINTS.MODULE_ACCESS,
    { params: { tenantId, roleId } },
  );
  return data;
};

// ─── 3. Get the full matrix for a tenant ─────────────────────────
export const fetchMatrix = async (
  tenantId: number,
): Promise<ApiResponse<ModuleAccessMatrix>> => {
  const { data } = await axiosInstance.get<ApiResponse<ModuleAccessMatrix>>(
    ENDPOINTS.MODULE_ACCESS_MATRIX,
    { params: { tenantId } },
  );
  return data;
};

// ─── 4. Upsert single module access ──────────────────────────────
export const upsertModuleAccess = async (
  payload: ModuleAccessPayload,
): Promise<ApiResponse<ModuleAccessEntry>> => {
  const { data } = await axiosInstance.post<ApiResponse<ModuleAccessEntry>>(
    ENDPOINTS.MODULE_ACCESS,
    payload,
  );
  return data;
};

// ─── 5. Bulk upsert ──────────────────────────────────────────────
export const bulkUpsertModuleAccess = async (
  payload: BulkModuleAccessPayload,
): Promise<ApiResponse<ModuleAccessEntry[]>> => {
  const { data } = await axiosInstance.post<ApiResponse<ModuleAccessEntry[]>>(
    ENDPOINTS.MODULE_ACCESS_BULK,
    payload,
  );
  return data;
};

// ─── 6. Runtime check ────────────────────────────────────────────
export const checkAccess = async (
  tenantId: number, payload: CheckAccessPayload,
): Promise<ApiResponse<CheckAccessResult>> => {
  const { data } = await axiosInstance.post<ApiResponse<CheckAccessResult>>(
    `${ENDPOINTS.MODULE_ACCESS_CHECK}?tenantId=${tenantId}`,
    payload,
  );
  return data;
};

// ─── 7. Delete single module entry ───────────────────────────────
export const deleteModuleAccess = async (
  tenantId: number, roleId: number, module: string,
): Promise<ApiResponse<null>> => {
  const { data } = await axiosInstance.delete<ApiResponse<null>>(
    ENDPOINTS.MODULE_ACCESS,
    { params: { tenantId, roleId, module } },
  );
  return data;
};

// ─── 8. Delete all entries for a role ────────────────────────────
export const deleteRoleAccess = async (
  tenantId: number, roleId: number,
): Promise<ApiResponse<null>> => {
  const { data } = await axiosInstance.delete<ApiResponse<null>>(
    ENDPOINTS.MODULE_ACCESS_ROLE,
    { params: { tenantId, roleId } },
  );
  return data;
};

// ─── Roles CRUD (custom roles only — built-ins are refused server-side) ──
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
