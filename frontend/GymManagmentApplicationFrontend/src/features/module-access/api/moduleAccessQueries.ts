import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../api/queryKeys';
import {
  fetchModuleKeys, fetchModuleAccess, fetchMatrix,
  upsertModuleAccess, bulkUpsertModuleAccess,
  checkAccess, deleteModuleAccess, deleteRoleAccess,
} from './moduleAccessApi';
import {
  ModuleAccessPayload, BulkModuleAccessPayload,
  CheckAccessPayload,
} from '../types/moduleAccess.types';

// ── Queries ───────────────────────────────────────────────────────

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
