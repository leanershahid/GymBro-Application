/**
 * Member training calls (raw): plan calendar + skip/move, previous performance, records, history,
 * a day workout's structure and completing a session. Contract: ./training.types.ts.
 * Staff builder calls live in trainingApi.ts (owned by the builder).
 */
import axiosInstance from '../../../api/axios';
import { unwrap, unwrapRequired } from '../../../api/http';
import type {
  ApiResponse, CompleteWorkoutRequest, CompleteWorkoutResponse, DateString, DayOverrideRequest,
  LastPerformance, PaginatedData, PersonalRecord, PlanCalendar, PlanDayOverride,
  WorkoutHistoryDetail, WorkoutHistoryItem, WorkoutStructure,
} from './training.types';

const EP = {
  calendar: (aid: number) => `/me/plans/${aid}/calendar`,
  skip:     (aid: number) => `/me/plans/${aid}/days/skip`,
  move:     (aid: number) => `/me/plans/${aid}/days/move`,
  undo:     (aid: number, date: DateString) => `/me/plans/${aid}/days/${date}/override`,
  lastBulk: '/me/exercises/last',
  last:     (exerciseId: number) => `/me/exercises/${exerciseId}/last`,
  records:  '/me/records',
  history:  '/me/workout-history',
  historyLog: (logId: number) => `/me/workout-history/${logId}`,
  structure:  (workoutId: number) => `/workouts/${workoutId}/structure`,
  complete:   (workoutId: number) => `/workouts/${workoutId}/complete`,
} as const;

export const fetchPlanCalendar = async (aid: number, from?: DateString, to?: DateString): Promise<PlanCalendar> => {
  const { data } = await axiosInstance.get<ApiResponse<PlanCalendar>>(EP.calendar(aid), { params: { from, to } });
  return unwrapRequired(data);
};

export const skipPlanDay = async (aid: number, date: DateString): Promise<PlanDayOverride> => {
  const body: DayOverrideRequest = { date };
  const { data } = await axiosInstance.post<ApiResponse<PlanDayOverride>>(EP.skip(aid), body);
  return unwrap(data);
};

export const movePlanDay = async (aid: number, date: DateString, toDate: DateString): Promise<PlanDayOverride> => {
  const body: DayOverrideRequest = { date, toDate };
  const { data } = await axiosInstance.post<ApiResponse<PlanDayOverride>>(EP.move(aid), body);
  return unwrap(data);
};

export const undoPlanDayOverride = async (aid: number, date: DateString): Promise<void> => {
  const { data } = await axiosInstance.delete<ApiResponse<null>>(EP.undo(aid, date));
  unwrap(data);
};

/** Previous performance for several exercises (never-done ones are left out; max 50 ids). */
export const fetchLastPerformances = async (exerciseIds: number[]): Promise<LastPerformance[]> => {
  if (exerciseIds.length === 0) return [];
  const { data } = await axiosInstance.get<ApiResponse<LastPerformance[]>>(EP.lastBulk, { params: { ids: exerciseIds.slice(0, 50).join(',') } });
  return unwrap(data, []) ?? [];
};

export const fetchLastPerformance = async (exerciseId: number): Promise<LastPerformance | null> => {
  const { data } = await axiosInstance.get<ApiResponse<LastPerformance | null>>(EP.last(exerciseId));
  return unwrap(data) ?? null;
};

export const fetchMyRecords = async (exerciseId?: number): Promise<PersonalRecord[]> => {
  const { data } = await axiosInstance.get<ApiResponse<PersonalRecord[]>>(EP.records, { params: { exerciseId } });
  return unwrap(data, []) ?? [];
};

export const fetchWorkoutHistory = async (page = 1, pageSize = 20): Promise<PaginatedData<WorkoutHistoryItem>> => {
  const { data } = await axiosInstance.get<ApiResponse<PaginatedData<WorkoutHistoryItem>>>(EP.history, { params: { page, pageSize } });
  return unwrapRequired(data);
};

export const fetchWorkoutHistoryDetail = async (logId: number): Promise<WorkoutHistoryDetail> => {
  const { data } = await axiosInstance.get<ApiResponse<WorkoutHistoryDetail>>(EP.historyLog(logId));
  return unwrapRequired(data);
};

/** The structure with workoutExerciseId and per-set targets (404 for workouts the member can't see). */
export const fetchPlayerStructure = async (workoutId: number): Promise<WorkoutStructure> => {
  const { data } = await axiosInstance.get<ApiResponse<WorkoutStructure>>(EP.structure(workoutId));
  return unwrapRequired(data);
};

export const completeWorkoutSession = async (workoutId: number, body: CompleteWorkoutRequest): Promise<CompleteWorkoutResponse> => {
  const { data } = await axiosInstance.post<ApiResponse<CompleteWorkoutResponse>>(EP.complete(workoutId), body);
  return unwrapRequired(data);
};
