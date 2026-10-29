import axiosInstance from '../../../api/axios';
import { ApiResponse } from '../../../api/types';
import { GymClass, PtType, PtSession, BookPtPayload, ClassBookResult } from '../types/booking.types';

/** Returns `data`, or throws the envelope's message so React Query surfaces it as an error. */
function unwrap<T>(res: ApiResponse<T>, fallback: T | null = null): T {
  if (!res.success) throw new Error(res.message || 'Request failed.');
  if (res.data == null) {
    if (fallback !== null) return fallback;
    throw new Error(res.message || 'Empty response.');
  }
  return res.data;
}

// ── Classes ──────────────────────────────────────────────────────────────────

/** Class schedule between two UTC instants (server max: 62 days). */
export const fetchClassSchedule = async (fromIso: string, toIso: string): Promise<GymClass[]> => {
  const { data } = await axiosInstance.get<ApiResponse<GymClass[]>>('/classes', { params: { from: fromIso, to: toIso } });
  return unwrap(data, []);
};

/** The member's booked classes (last 30 days + upcoming). */
export const fetchMyClasses = async (): Promise<GymClass[]> => {
  const { data } = await axiosInstance.get<ApiResponse<GymClass[]>>('/classes/me');
  return unwrap(data, []);
};

export const bookClass = async (classId: number): Promise<ClassBookResult> => {
  const { data } = await axiosInstance.post<ApiResponse<GymClass>>(`/classes/${classId}/book`, {});
  return { cls: unwrap(data), message: data.message };
};

export const cancelClassBooking = async (classId: number): Promise<GymClass> => {
  const { data } = await axiosInstance.delete<ApiResponse<GymClass>>(`/classes/${classId}/book`);
  return unwrap(data);
};

// ── Personal training ────────────────────────────────────────────────────────

export const fetchPtTypes = async (): Promise<PtType[]> => {
  const { data } = await axiosInstance.get<ApiResponse<PtType[]>>('/pt/types');
  return unwrap(data, []);
};

export const fetchMyPtSessions = async (): Promise<PtSession[]> => {
  const { data } = await axiosInstance.get<ApiResponse<PtSession[]>>('/pt/sessions');
  return unwrap(data, []);
};

export const bookPtSession = async (payload: BookPtPayload): Promise<PtSession> => {
  const { data } = await axiosInstance.post<ApiResponse<PtSession>>('/pt/sessions', payload);
  return unwrap(data);
};

export const cancelPtSession = async (sessionId: number): Promise<PtSession> => {
  const { data } = await axiosInstance.put<ApiResponse<PtSession>>(`/pt/sessions/${sessionId}/status`, { status: 'cancelled' });
  return unwrap(data);
};

export const ratePtSession = async (sessionId: number, rating: number): Promise<PtSession> => {
  const { data } = await axiosInstance.post<ApiResponse<PtSession>>(`/pt/sessions/${sessionId}/rate`, { rating });
  return unwrap(data);
};
