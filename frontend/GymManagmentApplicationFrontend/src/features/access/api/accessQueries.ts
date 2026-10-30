import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addExtraRole, fetchExtraRoles, fetchModuleTree, fetchRoleGrants, fetchUserAccess,
  removeExtraRole, saveRoleGrants, saveUserOverrides,
} from './accessApi';
import { AccessApp, ModuleGrant, UserOverride } from '../types/access.types';

export const accessKeys = {
  all:   ['access'] as const,
  tree:  (app?: AccessApp) => ['access', 'tree', app ?? 'all'] as const,
  role:  (roleId: number) => ['access', 'role', roleId] as const,
  user:  (userId: number) => ['access', 'user', userId] as const,
  extra: (userId: number) => ['access', 'extra', userId] as const,
};

export const useModuleTree = (app?: AccessApp) =>
  useQuery({ queryKey: accessKeys.tree(app), queryFn: () => fetchModuleTree(app), staleTime: 10 * 60 * 1000 });

export const useRoleGrants = (roleId: number) =>
  useQuery({ queryKey: accessKeys.role(roleId), queryFn: () => fetchRoleGrants(roleId), enabled: roleId > 0 });

export const useUserAccess = (userId: number) =>
  useQuery({ queryKey: accessKeys.user(userId), queryFn: () => fetchUserAccess(userId), enabled: userId > 0 });

export const useExtraRoles = (userId: number) =>
  useQuery({ queryKey: accessKeys.extra(userId), queryFn: () => fetchExtraRoles(userId), enabled: userId > 0 });

// Any change can alter what someone sees — including the signed-in admin's own menu — so every
// save refreshes all access data (the 'access' prefix also covers AccessProvider's own list).
const useAccessMutation = <V,>(fn: (v: V) => Promise<unknown>) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: accessKeys.all }) });
};

export const useSaveRoleGrants = (roleId: number) =>
  useAccessMutation((grants: ModuleGrant[]) => saveRoleGrants(roleId, grants));

export const useSaveUserOverrides = (userId: number) =>
  useAccessMutation((overrides: UserOverride[]) => saveUserOverrides(userId, overrides));

export const useAddExtraRole = (userId: number) =>
  useAccessMutation((roleId: number) => addExtraRole(userId, roleId));

export const useRemoveExtraRole = (userId: number) =>
  useAccessMutation((roleId: number) => removeExtraRole(userId, roleId));
