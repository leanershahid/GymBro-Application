import axiosInstance from '../../../api/axios';
import { ENDPOINTS } from '../../../api/endpoints';
import {
  MemberProfile, TimelineEvent, MemberDocument,
  WorkoutDetail, WorkoutCompletePayload,
  HealthToday, ActiveChallenge,
  ApiResponse, PaginatedData,
} from '../types/member-app.types';

// ─── Profile ──────────────────────────────────────────────────────
export const fetchMyProfile = async (id: number): Promise<ApiResponse<MemberProfile>> => {
  const { data } = await axiosInstance.get<ApiResponse<MemberProfile>>(`${ENDPOINTS.MEMBERS}/${id}`);
  return data;
};

export const updateMyProfile = async (
  id: number,
  payload: Partial<Pick<MemberProfile, 'firstName' | 'lastName' | 'phone' | 'gender' | 'dob' | 'avatarUrl'>>,
): Promise<ApiResponse<MemberProfile>> => {
  const { data } = await axiosInstance.put<ApiResponse<MemberProfile>>(`${ENDPOINTS.MEMBERS}/${id}`, payload);
  return data;
};

// ─── Timeline ────────────────────────────────────────────────────
export const fetchMyTimeline = async (id: number): Promise<ApiResponse<TimelineEvent[]>> => {
  const { data } = await axiosInstance.get<ApiResponse<TimelineEvent[]>>(`${ENDPOINTS.MEMBERS}/${id}/timeline`);
  return data;
};

// ─── Documents ───────────────────────────────────────────────────
export const fetchMyDocuments = async (id: number): Promise<ApiResponse<MemberDocument[]>> => {
  const { data } = await axiosInstance.get<ApiResponse<MemberDocument[]>>(`${ENDPOINTS.MEMBERS}/${id}/documents`);
  return data;
};

// ─── Workouts ────────────────────────────────────────────────────
export const fetchMyWorkouts = async (
  memberId: number, pageNumber = 1, pageSize = 20,
): Promise<ApiResponse<PaginatedData<WorkoutDetail>>> => {
  const { data } = await axiosInstance.get<ApiResponse<PaginatedData<WorkoutDetail>>>(ENDPOINTS.WORKOUTS, {
    params: { memberId, pageNumber, pageSize },
  });
  return data;
};

export const fetchWorkoutDetail = async (id: number): Promise<ApiResponse<WorkoutDetail>> => {
  const { data } = await axiosInstance.get<ApiResponse<WorkoutDetail>>(`${ENDPOINTS.WORKOUTS}/${id}`);
  return data;
};

export const completeWorkout = async (
  workoutId: number, payload: WorkoutCompletePayload,
): Promise<ApiResponse<unknown>> => {
  const { data } = await axiosInstance.post<ApiResponse<unknown>>(`${ENDPOINTS.WORKOUTS}/${workoutId}/complete`, payload);
  return data;
};

export const bookmarkWorkout = async (workoutId: number): Promise<ApiResponse<unknown>> => {
  const { data } = await axiosInstance.post<ApiResponse<unknown>>(`${ENDPOINTS.WORKOUTS}/${workoutId}/bookmark`);
  return data;
};

// ─── Exercises ───────────────────────────────────────────────────
export const fetchExercises = async (
  pageNumber = 1, pageSize = 20, tag?: string,
): Promise<ApiResponse<PaginatedData<{
  id: number; name: string; category: string | null;
  difficulty: string | null; tags: string[] | null; videoUrl: string | null;
}>>> => {
  const { data } = await axiosInstance.get(ENDPOINTS.EXERCISES, {
    params: { pageNumber, pageSize, tag: tag || undefined },
  });
  return data;
};

// ─── Plans ────────────────────────────────────────────────────────
export const fetchMyPlans = async (
  pageNumber = 1, pageSize = 20,
): Promise<ApiResponse<PaginatedData<{
  id: number; name: string; durationWeeks: number;
  goal: string | null; difficulty: string | null; isActive: boolean;
}>>> => {
  const { data } = await axiosInstance.get(ENDPOINTS.PLANS, { params: { pageNumber, pageSize } });
  return data;
};

// ─── Health / streak ───────────────────────────────────────────────
export const fetchHealthToday = async (): Promise<ApiResponse<HealthToday>> => {
  const { data } = await axiosInstance.get<ApiResponse<HealthToday>>(ENDPOINTS.HEALTH_TODAY);
  return data;
};

// ─── Active challenges ──────────────────────────────────────────────
export const fetchActiveChallenges = async (): Promise<ApiResponse<ActiveChallenge[]>> => {
  const { data } = await axiosInstance.get<ApiResponse<ActiveChallenge[]>>(ENDPOINTS.CHALLENGES_ACTIVE);
  return data;
};
