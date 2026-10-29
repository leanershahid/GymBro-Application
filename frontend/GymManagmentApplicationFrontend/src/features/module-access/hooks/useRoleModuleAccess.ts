import { useQuery } from '@tanstack/react-query';
import axiosInstance from '../../../api/axios';
import { ApiResponse } from '../../../api/types';

export interface ModuleGrant {
  module: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

/**
 * The signed-in user's own grants from the per-role Module Access matrix (the "Role Access"
 * screen) — for Admin/SuperAdmin this reflects their own role's row, defaulting to allowed on
 * any module with no explicit row (see backend IsAllowedForRoleAsync/GetMyAccessAsync). Shared
 * query key with useVisibleAdminActions so both read the same cache entry.
 */
export function useMyModuleGrants() {
  return useQuery({
    queryKey: ['module-access', 'me'],
    queryFn: async () => (await axiosInstance.get<ApiResponse<ModuleGrant[]>>('/module-access/me')).data,
    select: r => r.data ?? [],
  });
}

/** Per-module view/create/edit/delete flags for the signed-in user, from the role matrix. */
export function useRoleModuleAccess(moduleKey: string) {
  const { data: grants = [], isLoading } = useMyModuleGrants();
  const entry = grants.find(g => g.module === moduleKey);
  return {
    isLoading,
    canView:   entry?.canView ?? false,
    canCreate: entry?.canCreate ?? false,
    canEdit:   entry?.canEdit ?? false,
    canDelete: entry?.canDelete ?? false,
  };
}
