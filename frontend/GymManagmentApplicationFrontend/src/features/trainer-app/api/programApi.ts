import axiosInstance from '../../../api/axios';
import { ENDPOINTS } from '../../../api/endpoints';
import { ApiResponse, PaginatedData } from '../../../api/types';
import { Workout, WorkoutPlan } from '../../workouts/types/workout.types';
import {
  WorkoutStructure, PlanSchedule, AssignWorkoutPayload, AssignPlanPayload,
  UpdateWorkoutPayload, UpdatePlanPayload, LibraryExercise,
} from '../types/program.types';

// ─── Workout structure ────────────────────────────────────────────
export const fetchWorkoutStructure = async (id: number): Promise<ApiResponse<WorkoutStructure>> => {
  const { data } = await axiosInstance.get<ApiResponse<WorkoutStructure>>(`${ENDPOINTS.WORKOUTS}/${id}/structure`);
  return data;
};

/** Replaces every section and exercise of the workout. */
export const saveWorkoutStructure = async (id: number, structure: WorkoutStructure): Promise<ApiResponse<WorkoutStructure>> => {
  const { data } = await axiosInstance.put<ApiResponse<WorkoutStructure>>(`${ENDPOINTS.WORKOUTS}/${id}/structure`, structure);
  return data;
};

// ─── Plan schedule ────────────────────────────────────────────────
export const fetchPlanSchedule = async (id: number): Promise<ApiResponse<PlanSchedule>> => {
  const { data } = await axiosInstance.get<ApiResponse<PlanSchedule>>(`${ENDPOINTS.PLANS}/${id}/schedule`);
  return data;
};

/** Replaces the plan's week/day schedule. */
export const savePlanSchedule = async (id: number, schedule: PlanSchedule): Promise<ApiResponse<PlanSchedule>> => {
  const { data } = await axiosInstance.put<ApiResponse<PlanSchedule>>(`${ENDPOINTS.PLANS}/${id}/schedule`, schedule);
  return data;
};

// ─── Workout / plan details ───────────────────────────────────────
export const updateWorkout = async (id: number, payload: UpdateWorkoutPayload): Promise<ApiResponse<Workout>> => {
  const { data } = await axiosInstance.put<ApiResponse<Workout>>(`${ENDPOINTS.WORKOUTS}/${id}`, payload);
  return data;
};

export const updatePlan = async (id: number, payload: UpdatePlanPayload): Promise<ApiResponse<WorkoutPlan>> => {
  const { data } = await axiosInstance.put<ApiResponse<WorkoutPlan>>(`${ENDPOINTS.PLANS}/${id}`, payload);
  return data;
};

/**
 * Clones a workout. The API copies only the details, so the sections/exercises are
 * copied across afterwards (best effort: the clone still exists if that step fails).
 */
export const cloneWorkout = async (id: number): Promise<ApiResponse<Workout>> => {
  const { data } = await axiosInstance.post<ApiResponse<Workout>>(`${ENDPOINTS.WORKOUTS}/${id}/clone`);
  const cloneId = data.data?.id;
  if (data.success && cloneId) {
    try {
      const src = await fetchWorkoutStructure(id);
      if (src.data?.sections?.length) await saveWorkoutStructure(cloneId, { sections: src.data.sections });
    } catch {
      return { ...data, message: 'Workout cloned, but its exercises could not be copied.' };
    }
  }
  return data;
};

// ─── Assign ───────────────────────────────────────────────────────
export const assignWorkout = async (payload: AssignWorkoutPayload): Promise<ApiResponse<unknown>> => {
  const { data } = await axiosInstance.post<ApiResponse<unknown>>(ENDPOINTS.ASSIGN_WORKOUT, payload);
  return data;
};

export const assignPlan = async (planId: number, payload: AssignPlanPayload): Promise<ApiResponse<unknown>> => {
  const { data } = await axiosInstance.post<ApiResponse<unknown>>(`${ENDPOINTS.PLANS}/${planId}/assign`, payload);
  return data;
};

// ─── Exercise library (one page of 100, searched client-side) ─────
export const fetchExerciseLibrary = async (): Promise<ApiResponse<PaginatedData<LibraryExercise>>> => {
  const { data } = await axiosInstance.get<ApiResponse<PaginatedData<LibraryExercise>>>(ENDPOINTS.EXERCISES, {
    params: { pageNumber: 1, pageSize: 100 },
  });
  return data;
};

/** Workouts for the plan-day picker (largest page the API allows). */
export const fetchWorkoutOptions = async (): Promise<ApiResponse<PaginatedData<Workout>>> => {
  const { data } = await axiosInstance.get<ApiResponse<PaginatedData<Workout>>>(ENDPOINTS.WORKOUTS, {
    params: { pageNumber: 1, pageSize: 100 },
  });
  return data;
};
