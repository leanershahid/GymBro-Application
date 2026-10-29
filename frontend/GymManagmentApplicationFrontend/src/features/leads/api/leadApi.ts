import axiosInstance from '../../../api/axios';
import { ENDPOINTS } from '../../../api/endpoints';
import { ApiResponse } from '../../../api/types';
import { Lead, LeadPayload, LeadCreateResponse, LeadListResponse, LeadSourceBreakdown } from '../types/lead.types';

export const fetchLeads = async (
  pageNumber = 1, pageSize = 20,
): Promise<LeadListResponse> => {
  const { data } = await axiosInstance.get<LeadListResponse>(ENDPOINTS.LEADS, {
    params: { pageNumber, pageSize },
  });
  return data;
};

export const createLead = async (payload: LeadPayload): Promise<LeadCreateResponse> => {
  const { data } = await axiosInstance.post<LeadCreateResponse>(ENDPOINTS.ADD_LEAD, payload);
  return data;
};

export const convertLead = async (id: number) => {
  const { data } = await axiosInstance.post(`${ENDPOINTS.LEADS}/${id}/convert`);
  return data;
};

export const fetchLead = async (id: number): Promise<ApiResponse<Lead>> => {
  const { data } = await axiosInstance.get<ApiResponse<Lead>>(`${ENDPOINTS.LEADS}/${id}`);
  return data;
};

/** Admin only: breakdown of sources already used by this gym's leads. */
export const fetchLeadSources = async (): Promise<ApiResponse<LeadSourceBreakdown[]>> => {
  const { data } = await axiosInstance.get<ApiResponse<LeadSourceBreakdown[]>>(ENDPOINTS.LEAD_SOURCES);
  return data;
};
