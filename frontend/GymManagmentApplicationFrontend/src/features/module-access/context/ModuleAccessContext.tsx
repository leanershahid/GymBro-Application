import { useApiAccess } from '../../access/context/AccessContext';

/** Whether the signed-in user may open screens that use an API permission key ("workouts", "stats", …). */
export function useModuleAccess(moduleKey: string): boolean {
  return useApiAccess(moduleKey).canView;
}

/** Whether the signed-in user may `action` within an API permission key. */
export function useModuleCan(moduleKey: string, action: 'create' | 'edit' | 'delete'): boolean {
  const access = useApiAccess(moduleKey);
  return action === 'create' ? access.canCreate : action === 'edit' ? access.canEdit : access.canDelete;
}
