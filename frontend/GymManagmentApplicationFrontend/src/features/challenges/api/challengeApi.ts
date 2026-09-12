import axiosInstance from '../../../api/axios';
import { ENDPOINTS } from '../../../api/endpoints';
import {
  ApiResponse,
  ChallengeAdminResponse,
  CreateChallengePayload,
  UpdateChallengeStatusPayload,
} from '../types/challenge.types';

export const fetchChallenges = async (): Promise<ApiResponse<ChallengeAdminResponse[]>> => {
  const { data } = await axiosInstance.get<ApiResponse<ChallengeAdminResponse[]>>(ENDPOINTS.CHALLENGES);
  return data;
};

export const createChallenge = async (
  payload: CreateChallengePayload,
): Promise<ApiResponse<ChallengeAdminResponse>> => {
  const { data } = await axiosInstance.post<ApiResponse<ChallengeAdminResponse>>(ENDPOINTS.CHALLENGES, payload);
  return data;
};

export const updateChallengeStatus = async (
  id: number,
  payload: UpdateChallengeStatusPayload,
): Promise<ApiResponse<ChallengeAdminResponse>> => {
  const { data } = await axiosInstance.put<ApiResponse<ChallengeAdminResponse>>(
    ENDPOINTS.challengeStatus(id),
    payload,
  );
  return data;
};
