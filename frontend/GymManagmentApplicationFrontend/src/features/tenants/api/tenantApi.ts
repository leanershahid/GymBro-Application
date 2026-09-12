import axiosInstance from '../../../api/axios';
import { ENDPOINTS } from '../../../api/endpoints';
import { TenantPayload, TenantCreateResponse, TenantListResponse } from '../types/tenant.types';

export const fetchTenants = async (): Promise<TenantListResponse> => {
  const { data } = await axiosInstance.get<TenantListResponse>(ENDPOINTS.TENANTS);
  return data;
};

export const createTenant = async (payload: TenantPayload): Promise<TenantCreateResponse> => {
  const { data } = await axiosInstance.post<TenantCreateResponse>(ENDPOINTS.ADD_TENANT, payload);
  return data;
};
