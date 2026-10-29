import axiosInstance from '../../../api/axios';
import { ENDPOINTS } from '../../../api/endpoints';
import { ApiResponse } from '../../../api/types';
import {
  Workout, WorkoutPlan,
  WorkoutPayload, WorkoutCreateResponse, WorkoutListResponse,
  WorkoutPlanPayload, PlanCreateResponse, PlanListResponse,
  AutomationRulePayload, AutomationListResponse,
  WORKOUT_GOALS, WORKOUT_DIFFICULTIES, toEnumIndex,
} from '../types/workout.types';

const normalizeEnums = <P extends { goal?: unknown; difficulty?: unknown }>(p: P) => ({
  ...p,
  goal:       toEnumIndex(WORKOUT_GOALS, p.goal as never),
  difficulty: toEnumIndex(WORKOUT_DIFFICULTIES, p.difficulty as never),
});

// ─── Workouts ─────────────────────────────────────────────────────
export const fetchWorkouts = async (pageNumber = 1, pageSize = 20): Promise<WorkoutListResponse> => {
  const { data } = await axiosInstance.get<WorkoutListResponse>(ENDPOINTS.WORKOUTS, {
    params: { pageNumber, pageSize },
  });
  return data;
};

export const createWorkout = async (payload: WorkoutPayload): Promise<WorkoutCreateResponse> => {
  const { data } = await axiosInstance.post<WorkoutCreateResponse>(ENDPOINTS.ADD_WORKOUT, normalizeEnums(payload));
  return data;
};

export const fetchWorkout = async (id: number): Promise<ApiResponse<Workout>> => {
  const { data } = await axiosInstance.get<ApiResponse<Workout>>(`${ENDPOINTS.WORKOUTS}/${id}`);
  return data;
};

/** Admins any workout in the gym; trainers only ones they created. */
export const deleteWorkout = async (id: number) => {
  const { data } = await axiosInstance.delete(`${ENDPOINTS.WORKOUTS}/${id}`);
  return data;
};

// ─── Plans ────────────────────────────────────────────────────────
export const fetchPlans = async (pageNumber = 1, pageSize = 20): Promise<PlanListResponse> => {
  const { data } = await axiosInstance.get<PlanListResponse>(ENDPOINTS.PLANS, {
    params: { pageNumber, pageSize },
  });
  return data;
};

export const createPlan = async (payload: WorkoutPlanPayload): Promise<PlanCreateResponse> => {
  const { data } = await axiosInstance.post<PlanCreateResponse>(ENDPOINTS.ADD_PLAN, normalizeEnums(payload));
  return data;
};

export const fetchPlan = async (id: number): Promise<ApiResponse<WorkoutPlan>> => {
  const { data } = await axiosInstance.get<ApiResponse<WorkoutPlan>>(`${ENDPOINTS.PLANS}/${id}`);
  return data;
};

/** Admin only on the API. */
export const deletePlan = async (id: number) => {
  const { data } = await axiosInstance.delete(`${ENDPOINTS.PLANS}/${id}`);
  return data;
};

// ─── Automation ───────────────────────────────────────────────────
export const fetchAutomationRules = async (tenantId: number): Promise<AutomationListResponse> => {
  const { data } = await axiosInstance.get<AutomationListResponse>(ENDPOINTS.AUTOMATION_RULES, {
    params: { tenantId },
  });
  return data;
};

export const createAutomationRule = async (payload: AutomationRulePayload) => {
  const { data } = await axiosInstance.post(ENDPOINTS.AUTOMATION_RULES, payload);
  return data;
};
