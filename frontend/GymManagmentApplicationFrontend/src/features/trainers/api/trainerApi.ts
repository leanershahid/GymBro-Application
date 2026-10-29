import axiosInstance from '../../../api/axios';
import { ENDPOINTS } from '../../../api/endpoints';
import { TrainerPayload, ApiResponse, PaginatedData, TrainerSummary, TrainerDetail, UpdateTrainerPayload } from '../types/trainer.types';

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

export const fetchTrainerById = async (id: number): Promise<ApiResponse<TrainerDetail>> => {
  const { data } = await axiosInstance.get<ApiResponse<TrainerDetail>>(`${ENDPOINTS.TRAINERS}/${id}`);
  return data;
};

export const createTrainer = async (payload: TrainerPayload): Promise<ApiResponse<unknown>> => {
  const { data } = await axiosInstance.post<ApiResponse<unknown>>(ENDPOINTS.TRAINERS, payload);
  return data;
};

export const updateTrainer = async (
  id: number,
  payload: UpdateTrainerPayload,
): Promise<ApiResponse<TrainerDetail>> => {
  const { data } = await axiosInstance.put<ApiResponse<TrainerDetail>>(`${ENDPOINTS.TRAINERS}/${id}`, payload);
  return data;
};

export const setTrainerStatus = async (
  id: number, isActive: boolean,
): Promise<ApiResponse<unknown>> => {
  const { data } = await axiosInstance.patch<ApiResponse<unknown>>(`${ENDPOINTS.TRAINERS}/${id}/status`, { isActive });
  return data;
};

export const deleteTrainer = async (id: number): Promise<ApiResponse<unknown>> => {
  const { data } = await axiosInstance.delete<ApiResponse<unknown>>(`${ENDPOINTS.TRAINERS}/${id}`);
  return data;
};
