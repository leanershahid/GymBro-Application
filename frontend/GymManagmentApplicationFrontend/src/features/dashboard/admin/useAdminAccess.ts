import { useApiAccess } from '../../access/context/AccessContext';

/**
 * Every admin module's view/create/edit/delete flags, from the signed-in user's access list
 * (their role grants plus their own overrides), so it works dynamically for every role.
 */
export function useAdminAccess() {
  return {
    members:    useApiAccess('members'),
    trainers:   useApiAccess('trainers'),
    branches:   useApiAccess('branches'),
    tenants:    useApiAccess('tenants'),
    attendance: useApiAccess('attendance'),
    leads:      useApiAccess('leads'),
    exercises:  useApiAccess('exercises'),
    workouts:   useApiAccess('workouts'),
    plans:      useApiAccess('plans'),
    roles:      useApiAccess('roles'),
    billing:    useApiAccess('billing'),
    classes:    useApiAccess('classes'),
    pt:         useApiAccess('pt-sessions'),
  };
}

export type AdminAccess = ReturnType<typeof useAdminAccess>;
