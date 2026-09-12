import axiosInstance from '../../../api/axios';
import { ENDPOINTS } from '../../../api/endpoints';
import { TrainerPayload, ApiResponse, PaginatedData, TrainerSummary } from '../types/trainer.types';

export const fetchTrainers = async (
  pageNumber = 1,
  pageSize = 20,
): Promise<ApiResponse<PaginatedData<TrainerSummary>>> => {
  const { data } = await axiosInstance.get<ApiResponse<PaginatedData<TrainerSummary>>>(
    ENDPOINTS.TRAINERS,
    { params: { pageNumber, pageSize } },
  );
  return data;
};

export const createTrainer = async (payload: TrainerPayload): Promise<ApiResponse<unknown>> => {
  const { data } = await axiosInstance.post<ApiResponse<unknown>>(ENDPOINTS.TRAINERS, payload);
  return data;
};

export const updateTrainer = async (
  id: number,
  payload: { isAvailable: boolean },
): Promise<ApiResponse<unknown>> => {
  const { data } = await axiosInstance.put<ApiResponse<unknown>>(`${ENDPOINTS.TRAINERS}/${id}`, payload);
  return data;
};
