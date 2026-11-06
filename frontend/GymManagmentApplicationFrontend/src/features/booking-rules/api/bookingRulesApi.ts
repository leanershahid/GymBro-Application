import axiosInstance from '../../../api/axios';
import { ApiResponse } from '../../../api/types';
import { unwrapRequired as unwrap } from '../../../api/http';
import {
  BookingBlock, BookingPenalty, BookingPolicy, BookingRulesSettings, BookingRulesSettingsResponse, BookingStanding, WaiveResult,
} from '../types/bookingRules.types';

// Feature-local paths (server: Controllers/BookingRulesController.cs).
const EP = {
  policy: '/booking-rules/policy',
  me: '/booking-rules/me',
  settings: '/booking-rules/settings',
  penalties: '/booking-rules/penalties',
  member: (id: number) => `/booking-rules/members/${id}`,
  waive: (id: number) => `/booking-rules/penalties/${id}/waive`,
  lift: (id: number) => `/booking-rules/blocks/${id}/lift`,
};

export const fetchBookingPolicy = async (): Promise<BookingPolicy> =>
  unwrap((await axiosInstance.get<ApiResponse<BookingPolicy>>(EP.policy)).data);

export const fetchMyStanding = async (): Promise<BookingStanding> =>
  unwrap((await axiosInstance.get<ApiResponse<BookingStanding>>(EP.me)).data);

export const fetchBookingRulesSettings = async (): Promise<BookingRulesSettingsResponse> =>
  unwrap((await axiosInstance.get<ApiResponse<BookingRulesSettingsResponse>>(EP.settings)).data);

export const saveBookingRulesSettings = async (s: BookingRulesSettings): Promise<BookingRulesSettingsResponse> =>
  unwrap((await axiosInstance.put<ApiResponse<BookingRulesSettingsResponse>>(EP.settings, s)).data);

export interface PenaltyFilter { classId?: number; ptSessionId?: number; memberId?: number }

export const fetchPenalties = async (f: PenaltyFilter): Promise<BookingPenalty[]> =>
  unwrap((await axiosInstance.get<ApiResponse<BookingPenalty[]>>(EP.penalties, { params: f })).data, []);

export const fetchMemberStanding = async (memberId: number): Promise<BookingStanding> =>
  unwrap((await axiosInstance.get<ApiResponse<BookingStanding>>(EP.member(memberId))).data);

export const waivePenalty = async (id: number, reason: string): Promise<{ result: WaiveResult; message: string }> => {
  const { data } = await axiosInstance.put<ApiResponse<WaiveResult>>(EP.waive(id), { reason });
  return { result: unwrap(data), message: data.message };
};

export const liftBlock = async (id: number, reason?: string): Promise<BookingBlock> =>
  unwrap((await axiosInstance.put<ApiResponse<BookingBlock>>(EP.lift(id), { reason: reason || null })).data);
