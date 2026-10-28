import { isAxiosError } from 'axios';
import axiosInstance from '../../../api/axios';
import { ENDPOINTS } from '../../../api/endpoints';
import { BranchListResponse, BranchPayload, BranchCreateResponse } from '../types/branch.types';
import { ApiResponse } from '../../../api/types';

export const fetchBranches = async (): Promise<BranchListResponse> => {
  const { data } = await axiosInstance.get<BranchListResponse>(ENDPOINTS.BRANCHES);
  return data;
};

export const createBranch = async (payload: BranchPayload): Promise<BranchCreateResponse> => {
  const { data } = await axiosInstance.post<BranchCreateResponse>(ENDPOINTS.ADD_BRANCH, payload);
  return data;
};

/** Converts a thrown 400 (ArgumentException on the server) into a normal failed ApiResponse. */
async function requestAsResponse<T>(fn: () => Promise<{ data: ApiResponse<T> }>): Promise<ApiResponse<T>> {
  try {
    const { data } = await fn();
    return data;
  } catch (err) {
    if (isAxiosError<ApiResponse<T>>(err) && err.response?.data) return err.response.data;
    throw err;
  }
}

export const setBranchStatus = (id: number, status: 'Active' | 'Inactive') =>
  requestAsResponse(() => axiosInstance.put<ApiResponse<unknown>>(`${ENDPOINTS.BRANCHES}/${id}`, { status }));

export const deleteBranch = (id: number) =>
  requestAsResponse(() => axiosInstance.delete<ApiResponse<unknown>>(`${ENDPOINTS.BRANCHES}/${id}`));

export const transferBranch = (id: number, targetBranchId: number) =>
  requestAsResponse(() => axiosInstance.post<ApiResponse<unknown>>(`${ENDPOINTS.BRANCHES}/${id}/transfer`, { targetBranchId }));
