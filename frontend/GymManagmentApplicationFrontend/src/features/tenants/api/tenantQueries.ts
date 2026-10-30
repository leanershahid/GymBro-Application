import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTenants, fetchTenant, createTenant, updateTenant } from './tenantApi';
import { TenantPayload, TenantUpdatePayload } from '../types/tenant.types';
import { queryKeys } from '../../../api/queryKeys';

export const useTenants = () =>
  useQuery({
    queryKey: queryKeys.tenants.all,
    queryFn:  fetchTenants,
    select:   (res) => res.data ?? [],
  });

export const useTenant = (id: number) =>
  useQuery({
    queryKey: [...queryKeys.tenants.all, id],
    queryFn:  () => fetchTenant(id),
    select:   (res) => res.data,
    enabled:  id > 0,
  });

export const useCreateTenant = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TenantPayload) => createTenant(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tenants.all }),
  });
};

export const useUpdateTenant = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TenantUpdatePayload }) => updateTenant(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tenants.all }),
  });
};
