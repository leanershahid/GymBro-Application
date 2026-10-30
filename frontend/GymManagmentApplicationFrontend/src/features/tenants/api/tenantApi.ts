import axiosInstance from '../../../api/axios';
import { ENDPOINTS } from '../../../api/endpoints';
import {
  TenantPayload, TenantCreateResponse, TenantListResponse, TenantUpdatePayload,
} from '../types/tenant.types';

export const fetchTenants = async (): Promise<TenantListResponse> => {
  const { data } = await axiosInstance.get<TenantListResponse>(ENDPOINTS.TENANTS);
  return data;
};

export const createTenant = async (payload: TenantPayload): Promise<TenantCreateResponse> => {
  const { data } = await axiosInstance.post<TenantCreateResponse>(ENDPOINTS.ADD_TENANT, payload);
  return data;
};

export const fetchTenant = async (id: number): Promise<TenantCreateResponse> => {
  const { data } = await axiosInstance.get<TenantCreateResponse>(`${ENDPOINTS.TENANTS}/${id}`);
  return data;
};

/** Throws on non-2xx so callers can use describeApiError / fieldErrorsFrom. */
export const updateTenant = async (id: number, payload: TenantUpdatePayload): Promise<TenantCreateResponse> => {
  const { data } = await axiosInstance.put<TenantCreateResponse>(`${ENDPOINTS.TENANTS}/${id}`, payload);
  return data;
};
