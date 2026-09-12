import axiosInstance from '../../../api/axios';
import { ENDPOINTS } from '../../../api/endpoints';
import { BranchListResponse, BranchPayload, BranchCreateResponse } from '../types/branch.types';

export const fetchBranches = async (): Promise<BranchListResponse> => {
  const { data } = await axiosInstance.get<BranchListResponse>(ENDPOINTS.BRANCHES);
  return data;
};

export const createBranch = async (payload: BranchPayload): Promise<BranchCreateResponse> => {
  const { data } = await axiosInstance.post<BranchCreateResponse>(ENDPOINTS.ADD_BRANCH, payload);
  return data;
};
