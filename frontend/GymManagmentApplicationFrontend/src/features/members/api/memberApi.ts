import axiosInstance from '../../../api/axios';
import { ENDPOINTS } from '../../../api/endpoints';
import {
  MemberPayload, MemberCreateResponse, MemberListResponse,
} from '../types/member.types';

export const fetchMembers = async (
  query = '', pageNumber = 1, pageSize = 20,
): Promise<MemberListResponse> => {
  const { data } = await axiosInstance.get<MemberListResponse>(ENDPOINTS.MEMBERS, {
    params: { query: query || undefined, pageNumber, pageSize },
  });
  return data;
};

export const createMember = async (payload: MemberPayload): Promise<MemberCreateResponse> => {
  const { data } = await axiosInstance.post<MemberCreateResponse>(ENDPOINTS.ADD_MEMBER, payload);
  return data;
};

export const deleteMember = async (id: number): Promise<{ success: boolean; message: string }> => {
  const { data } = await axiosInstance.delete(`${ENDPOINTS.MEMBERS}/${id}`);
  return data;
};
