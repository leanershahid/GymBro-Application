import axiosInstance from '../../../api/axios';
import { ENDPOINTS } from '../../../api/endpoints';
import { LeadPayload, LeadCreateResponse, LeadListResponse } from '../types/lead.types';

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
