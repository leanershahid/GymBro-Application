import axiosInstance from '../../../api/axios';
import { ENDPOINTS } from '../../../api/endpoints';
import { AiCoachSettings, ApiResponse } from '../types/aiCoach.types';

export const fetchAiCoachSettings = async (): Promise<ApiResponse<AiCoachSettings>> => {
  const { data } = await axiosInstance.get<ApiResponse<AiCoachSettings>>(ENDPOINTS.AI_COACH_SETTINGS);
  return data;
};

export const saveAiCoachSettings = async (
  payload: AiCoachSettings,
): Promise<ApiResponse<AiCoachSettings>> => {
  const { data } = await axiosInstance.put<ApiResponse<AiCoachSettings>>(ENDPOINTS.AI_COACH_SETTINGS, payload);
  return data;
};
