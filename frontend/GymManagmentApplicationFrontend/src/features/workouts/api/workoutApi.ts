import axiosInstance from '../../../api/axios';
import { ENDPOINTS } from '../../../api/endpoints';
import {
  WorkoutPayload, WorkoutCreateResponse, WorkoutListResponse,
  WorkoutPlanPayload, PlanCreateResponse, PlanListResponse,
  AutomationRulePayload, AutomationListResponse,
} from '../types/workout.types';

// ─── Workouts ─────────────────────────────────────────────────────
export const fetchWorkouts = async (pageNumber = 1, pageSize = 20): Promise<WorkoutListResponse> => {
  const { data } = await axiosInstance.get<WorkoutListResponse>(ENDPOINTS.WORKOUTS, {
    params: { pageNumber, pageSize },
  });
  return data;
};

export const createWorkout = async (payload: WorkoutPayload): Promise<WorkoutCreateResponse> => {
  const { data } = await axiosInstance.post<WorkoutCreateResponse>(ENDPOINTS.ADD_WORKOUT, payload);
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
  const { data } = await axiosInstance.post<PlanCreateResponse>(ENDPOINTS.ADD_PLAN, payload);
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
