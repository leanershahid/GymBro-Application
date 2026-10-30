import { useApiAccess } from '../../access/context/AccessContext';

/**
 * Per-action flags for an API permission key ("members", "billing", …) from the signed-in user's
 * access list (see AccessProvider) — the same answer the API gives for that key.
 */
export function useRoleModuleAccess(moduleKey: string) {
  return { isLoading: false, ...useApiAccess(moduleKey) };
}
