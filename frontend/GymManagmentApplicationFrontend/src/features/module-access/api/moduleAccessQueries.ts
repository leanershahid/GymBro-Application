import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../api/queryKeys';
import {
  fetchRoles, createRole, updateRole, deleteRole, assignUserRole, revokeUserRole, RoleInput,
} from './moduleAccessApi';

// Module grants themselves live in features/access (role grants, per-user overrides).

export const useRoles = () =>
  useQuery({
    queryKey: queryKeys.moduleAccess.roles(),
    queryFn:  fetchRoles,
    select:   r => r.data ?? [],
  });

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
    },
  });
};

export const useDeleteRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: queryKeys.moduleAccess.roles() });
      qc.invalidateQueries({ queryKey: ['access'] });
    },
  });
};

// A new main role can move the person to another app — refresh every access view.
export const useAssignUserRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { userId: number; roleId: string }) => assignUserRole(p.userId, p.roleId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['access'] }),
  });
};

export const useRevokeUserRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { userId: number; roleId: string }) => revokeUserRole(p.userId, p.roleId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['access'] }),
  });
};
