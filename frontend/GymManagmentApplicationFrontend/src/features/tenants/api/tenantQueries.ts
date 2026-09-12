import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchTenants, createTenant } from './tenantApi';
import { TenantPayload } from '../types/tenant.types';
import { queryKeys } from '../../../api/queryKeys';

export const useTenants = () =>
  useQuery({
    queryKey: queryKeys.tenants.all,
    queryFn:  fetchTenants,
    select:   (res) => res.data ?? [],
  });

export const useCreateTenant = () =>
  useMutation({
    mutationFn: (payload: TenantPayload) => createTenant(payload),
  });
