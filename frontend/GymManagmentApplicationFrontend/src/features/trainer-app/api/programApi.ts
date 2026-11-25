import axiosInstance from '../../../api/axios';
import { ENDPOINTS } from '../../../api/endpoints';
import { ApiResponse } from '../../../api/types';
import { Workout, WorkoutPlan } from '../../workouts/types/workout.types';
import { AssignWorkoutPayload, UpdateWorkoutPayload, UpdatePlanPayload } from '../types/program.types';

// Program Builder calls that are not part of the weekly plan builder (features/training/api/trainingApi.ts):
// workout / plan details, cloning and assigning a single workout.

// ─── Workout / plan details ───────────────────────────────────────
export const updateWorkout = async (id: number, payload: UpdateWorkoutPayload): Promise<ApiResponse<Workout>> => {
  const { data } = await axiosInstance.put<ApiResponse<Workout>>(`${ENDPOINTS.WORKOUTS}/${id}`, payload);
  return data;
};

export const updatePlan = async (id: number, payload: UpdatePlanPayload): Promise<ApiResponse<WorkoutPlan>> => {
  const { data } = await axiosInstance.put<ApiResponse<WorkoutPlan>>(`${ENDPOINTS.PLANS}/${id}`, payload);
  return data;
};

/** Clones a workout with its full structure (the API copies sections, exercises and set targets). */
export const cloneWorkout = async (id: number): Promise<ApiResponse<Workout>> => {
  const { data } = await axiosInstance.post<ApiResponse<Workout>>(`${ENDPOINTS.WORKOUTS}/${id}/clone`);
  return data;
};

// ─── Assign ───────────────────────────────────────────────────────
export const assignWorkout = async (payload: AssignWorkoutPayload): Promise<ApiResponse<unknown>> => {
  const { data } = await axiosInstance.post<ApiResponse<unknown>>(ENDPOINTS.ASSIGN_WORKOUT, payload);
  return data;
};
