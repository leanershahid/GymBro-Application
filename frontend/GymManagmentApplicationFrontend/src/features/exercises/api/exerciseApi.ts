import axiosInstance from '../../../api/axios';
import { ENDPOINTS } from '../../../api/endpoints';
import { ApiResponse } from '../../../api/types';
import { uploadFile, PickedFile } from '../../../api/upload';
import {
  Exercise, ExercisePayload, ExerciseCreateResponse, ExerciseListResponse, MuscleGroup,
} from '../types/exercise.types';

// The list endpoint only filters by muscleId / equipmentId (its `tag` param is ignored and
// there is no name search), so category and text filtering happen client-side.
export const fetchExercises = async (pageNumber = 1, pageSize = 20): Promise<ExerciseListResponse> => {
  const { data } = await axiosInstance.get<ExerciseListResponse>(ENDPOINTS.EXERCISES, {
    params: { pageNumber, pageSize },
  });
  return data;
};

export const fetchExercise = async (id: number): Promise<ApiResponse<Exercise>> => {
  const { data } = await axiosInstance.get<ApiResponse<Exercise>>(`${ENDPOINTS.EXERCISES}/${id}`);
  return data;
};

export const fetchMuscles = async (): Promise<ApiResponse<MuscleGroup[]>> => {
  const { data } = await axiosInstance.get<ApiResponse<MuscleGroup[]>>(ENDPOINTS.EXERCISE_MUSCLES);
  return data;
};

export const createExercise = async (payload: ExercisePayload): Promise<ExerciseCreateResponse> => {
  const { data } = await axiosInstance.post<ExerciseCreateResponse>(ENDPOINTS.ADD_EXERCISE, payload);
  return data;
};

/** POST /exercises/{id}/video — multipart field `video` (≤110 MB). */
export const uploadExerciseVideo = (id: number, file: PickedFile) =>
  uploadFile<{ url: string }>(`${ENDPOINTS.EXERCISES}/${id}/video`, 'video', file);

export const deleteExercise = async (id: number) => {
  const { data } = await axiosInstance.delete(`${ENDPOINTS.EXERCISES}/${id}`);
  return data;
};
