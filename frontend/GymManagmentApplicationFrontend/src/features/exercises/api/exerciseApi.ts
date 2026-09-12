import axiosInstance from '../../../api/axios';
import { ENDPOINTS } from '../../../api/endpoints';
import { ExercisePayload, ExerciseCreateResponse, ExerciseListResponse } from '../types/exercise.types';

export const fetchExercises = async (
  pageNumber = 1, pageSize = 20, tag?: string,
): Promise<ExerciseListResponse> => {
  const { data } = await axiosInstance.get<ExerciseListResponse>(ENDPOINTS.EXERCISES, {
    params: { pageNumber, pageSize, tag: tag || undefined },
  });
  return data;
};

export const createExercise = async (payload: ExercisePayload): Promise<ExerciseCreateResponse> => {
  const { data } = await axiosInstance.post<ExerciseCreateResponse>(ENDPOINTS.ADD_EXERCISE, payload);
  return data;
};

export const deleteExercise = async (id: number) => {
  const { data } = await axiosInstance.delete(`${ENDPOINTS.EXERCISES}/${id}`);
  return data;
};
