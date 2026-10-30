import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../api/queryKeys';
import {
  fetchModuleKeys, fetchModuleAccess, fetchMatrix,
  upsertModuleAccess, bulkUpsertModuleAccess,
  checkAccess, deleteModuleAccess, deleteRoleAccess, fetchRoles,
  createRole, updateRole, deleteRole, assignUserRole, revokeUserRole, RoleInput,
} from './moduleAccessApi';
import {
  ModuleAccessPayload, BulkModuleAccessPayload,
  CheckAccessPayload,
} from '../types/moduleAccess.types';

// ── Queries ───────────────────────────────────────────────────────

export const useRoles = () =>
  useQuery({
    queryKey: queryKeys.moduleAccess.roles(),
    queryFn:  fetchRoles,
    select:   r => r.data ?? [],
  });

export const useModuleKeys = () =>
  useQuery({
    queryKey: queryKeys.moduleAccess.modules(),
    queryFn:  fetchModuleKeys,
    select:   r => r.data ?? [],
    staleTime: Infinity, // static list
  });

export const useModuleAccess = (tenantId: number, roleId: number) =>
  useQuery({
    queryKey: queryKeys.moduleAccess.byRole(tenantId, roleId),
    queryFn:  () => fetchModuleAccess(tenantId, roleId),
    select:   r => r.data ?? [],
    enabled:  tenantId > 0 && roleId > 0,
  });

export const useModuleMatrix = (tenantId: number) =>
  useQuery({
    queryKey: queryKeys.moduleAccess.matrix(tenantId),
    queryFn:  () => fetchMatrix(tenantId),
    select:   r => r.data,
    enabled:  tenantId > 0,
  });

// ── Mutations ─────────────────────────────────────────────────────

export const useUpsertModuleAccess = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: ModuleAccessPayload) => upsertModuleAccess(p),
    onSuccess:  (_, v) => {
      qc.invalidateQueries({ queryKey: queryKeys.moduleAccess.byRole(v.tenantId, v.roleId) });
      qc.invalidateQueries({ queryKey: queryKeys.moduleAccess.matrix(v.tenantId) });
    },
  });
};

export const useBulkUpsert = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: BulkModuleAccessPayload) => bulkUpsertModuleAccess(p),
    onSuccess:  (_, v) => {
      qc.invalidateQueries({ queryKey: queryKeys.moduleAccess.byRole(v.tenantId, v.roleId) });
      qc.invalidateQueries({ queryKey: queryKeys.moduleAccess.matrix(v.tenantId) });
    },
  });
};

export const useCheckAccess = () =>
  useMutation({
    mutationFn: ({ tenantId, payload }: { tenantId: number; payload: CheckAccessPayload }) =>
      checkAccess(tenantId, payload),
  });

export const useDeleteModuleAccess = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { tenantId: number; roleId: number; module: string }) =>
      deleteModuleAccess(p.tenantId, p.roleId, p.module),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: queryKeys.moduleAccess.byRole(v.tenantId, v.roleId) });
      qc.invalidateQueries({ queryKey: queryKeys.moduleAccess.matrix(v.tenantId) });
    },
  });
};

export const useDeleteRoleAccess = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { tenantId: number; roleId: number }) =>
      deleteRoleAccess(p.tenantId, p.roleId),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: queryKeys.moduleAccess.byRole(v.tenantId, v.roleId) });
      qc.invalidateQueries({ queryKey: queryKeys.moduleAccess.matrix(v.tenantId) });
    },
  });
};

// ── Roles CRUD & assignment ──────────────────────────────────────

export const useCreateRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { name: string; description?: string | null }) => createRole(p),
    onSuccess:  () => qc.invalidateQueries({ queryKey: queryKeys.moduleAccess.roles() }),
  });
};

export const useUpdateRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { id: string } & RoleInput) => updateRole(p.id, { name: p.name, description: p.description }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: queryKeys.moduleAccess.roles() });
      qc.invalidateQueries({ queryKey: ['module-access-matrix'] });
    },
  });
};

export const useDeleteRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: queryKeys.moduleAccess.roles() });
      qc.invalidateQueries({ queryKey: ['module-access-matrix'] });
      qc.invalidateQueries({ queryKey: ['module-access'] });
    },
  });
};

export const useAssignUserRole = () =>
  useMutation({
    mutationFn: (p: { userId: number; roleId: string }) => assignUserRole(p.userId, p.roleId),
  });

export const useRevokeUserRole = () =>
  useMutation({
    mutationFn: (p: { userId: number; roleId: string }) => revokeUserRole(p.userId, p.roleId),
  });
