import axiosInstance from '../../../api/axios';
import { ENDPOINTS } from '../../../api/endpoints';
import {
  TrainerProfile, ScheduleSlot, TrainerPerformance,
  TrainerEarnings, ClientAssignment, ClientNote, PlanAnalytics,
  ApiResponse,
} from '../types/trainer-app.types';
import { MemberProfile, TimelineEvent, MemberDocument } from '../../member-app/types/member-app.types';

// ─── Profile ──────────────────────────────────────────────────────
export const fetchTrainerProfile = async (id: number): Promise<ApiResponse<TrainerProfile>> => {
  const { data } = await axiosInstance.get<ApiResponse<TrainerProfile>>(`${ENDPOINTS.TRAINERS}/${id}`);
  return data;
};

export const updateTrainerProfile = async (
  id: number,
  payload: Partial<Pick<TrainerProfile, 'displayName' | 'bio' | 'phone' | 'email' | 'isAvailable'>>,
): Promise<ApiResponse<TrainerProfile>> => {
  const { data } = await axiosInstance.put<ApiResponse<TrainerProfile>>(`${ENDPOINTS.TRAINERS}/${id}`, payload);
  return data;
};

// ─── Schedule ─────────────────────────────────────────────────────
export const fetchSchedule = async (id: number): Promise<ApiResponse<ScheduleSlot[]>> => {
  const { data } = await axiosInstance.get<ApiResponse<ScheduleSlot[]>>(`${ENDPOINTS.TRAINERS}/${id}/schedule`);
  return data;
};

export const updateSchedule = async (
  id: number, slots: ScheduleSlot[],
): Promise<ApiResponse<unknown>> => {
  const { data } = await axiosInstance.put<ApiResponse<unknown>>(`${ENDPOINTS.TRAINERS}/${id}/schedule`, { slots });
  return data;
};

// ─── Performance & Earnings ───────────────────────────────────────
export const fetchPerformance = async (id: number): Promise<ApiResponse<TrainerPerformance>> => {
  const { data } = await axiosInstance.get<ApiResponse<TrainerPerformance>>(`${ENDPOINTS.TRAINERS}/${id}/performance`);
  return data;
};

export const fetchEarnings = async (
  id: number, month?: number, year?: number,
): Promise<ApiResponse<TrainerEarnings>> => {
  const { data } = await axiosInstance.get<ApiResponse<TrainerEarnings>>(`${ENDPOINTS.TRAINERS}/${id}/earnings`, {
    params: { month, year },
  });
  return data;
};

// ─── Clients ──────────────────────────────────────────────────────
export const fetchMyClients = async (trainerId: number): Promise<ApiResponse<ClientAssignment[]>> => {
  const { data } = await axiosInstance.get<ApiResponse<ClientAssignment[]>>(`${ENDPOINTS.TRAINERS}/${trainerId}/clients`);
  return data;
};

export const fetchClientProfile = async (memberId: number): Promise<ApiResponse<MemberProfile>> => {
  const { data } = await axiosInstance.get<ApiResponse<MemberProfile>>(`${ENDPOINTS.MEMBERS}/${memberId}`);
  return data;
};

export const fetchClientTimeline = async (memberId: number): Promise<ApiResponse<TimelineEvent[]>> => {
  const { data } = await axiosInstance.get<ApiResponse<TimelineEvent[]>>(`${ENDPOINTS.MEMBERS}/${memberId}/timeline`);
  return data;
};

export const fetchClientNotes = async (memberId: number): Promise<ApiResponse<ClientNote[]>> => {
  const { data } = await axiosInstance.get<ApiResponse<ClientNote[]>>(`${ENDPOINTS.MEMBERS}/${memberId}/notes`);
  return data;
};

export const addClientNote = async (
  memberId: number, note: string, trainerId: number,
): Promise<ApiResponse<ClientNote>> => {
  const { data } = await axiosInstance.post<ApiResponse<ClientNote>>(`${ENDPOINTS.MEMBERS}/${memberId}/notes`, { note, trainerId });
  return data;
};

export const fetchClientDocuments = async (memberId: number): Promise<ApiResponse<MemberDocument[]>> => {
  const { data } = await axiosInstance.get<ApiResponse<MemberDocument[]>>(`${ENDPOINTS.MEMBERS}/${memberId}/documents`);
  return data;
};

// ─── Plan analytics ───────────────────────────────────────────────
export const fetchPlanAnalytics = async (planId: number): Promise<ApiResponse<PlanAnalytics>> => {
  const { data } = await axiosInstance.get<ApiResponse<PlanAnalytics>>(`${ENDPOINTS.PLANS}/${planId}/analytics`);
  return data;
};
