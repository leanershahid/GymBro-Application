import axiosInstance from '../../../api/axios';
import { ApiResponse } from '../../../api/types';
import {
  AccessApp, AccessList, AccessModule, ExtraRole, ModuleGrant, ModuleTreeRow,
  RoleGrants, RoleSummary, RoleTemplate, StaffMember, UserAccess, UserOverride,
} from '../types/access.types';

const unwrap = <T,>(r: { data: ApiResponse<T> }) => r.data.data as T;

/** The signed-in user's menu modules and page tabs, fetched together. */
export async function fetchMyAccess(lang?: string): Promise<AccessList> {
  const params = lang ? { lang } : undefined;
  const [modules, tabs] = await Promise.all([
    axiosInstance.get<ApiResponse<AccessModule[]>>('/access/me', { params }).then(unwrap),
    axiosInstance.get<ApiResponse<AccessModule[]>>('/access/me/tabs', { params }).then(unwrap),
  ]);
  return { modules: modules ?? [], tabs: tabs ?? [] };
}

// ── Admin management ──────────────────────────────────────────────────────

export const fetchModuleTree = (app?: AccessApp) =>
  axiosInstance.get<ApiResponse<ModuleTreeRow[]>>('/access/modules', { params: app ? { app } : undefined }).then(unwrap);

export const fetchRoleGrants = (roleId: number) =>
  axiosInstance.get<ApiResponse<RoleGrants>>(`/access/roles/${roleId}/grants`).then(unwrap);

export const saveRoleGrants = (roleId: number, grants: ModuleGrant[]) =>
  axiosInstance.put<ApiResponse<RoleGrants>>(`/access/roles/${roleId}/grants`, { grants }).then(unwrap);

export const fetchUserAccess = (userId: number) =>
  axiosInstance.get<ApiResponse<UserAccess>>(`/access/users/${userId}`).then(unwrap);

export const saveUserOverrides = (userId: number, overrides: UserOverride[]) =>
  axiosInstance.put<ApiResponse<UserAccess>>(`/access/users/${userId}/overrides`, { overrides }).then(unwrap);

export const fetchExtraRoles = (userId: number) =>
  axiosInstance.get<ApiResponse<ExtraRole[]>>(`/access/users/${userId}/extra-roles`).then(unwrap);

export const addExtraRole = (userId: number, roleId: number) =>
  axiosInstance.post<ApiResponse<ExtraRole[]>>(`/access/users/${userId}/extra-roles`, { roleId }).then(unwrap);

export const removeExtraRole = (userId: number, roleId: number) =>
  axiosInstance.delete<ApiResponse<ExtraRole[]>>(`/access/users/${userId}/extra-roles/${roleId}`).then(unwrap);
