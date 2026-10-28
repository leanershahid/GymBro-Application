import axiosInstance from '../../../api/axios';
import { ENDPOINTS } from '../../../api/endpoints';
import { ApiResponse, PaginatedData } from '../../../api/types';
import {
  AttendanceRecord, AttendanceSettings, AttendanceSettingsResponse, BranchGeofence,
  CheckInResult, LocationFix, MyAttendanceStatus, SetBranchGeofencePayload,
} from '../types/attendance.types';

// ── Admin ───────────────────────────────────────────────────────────────
export const fetchAttendanceSettings = async () =>
  (await axiosInstance.get<ApiResponse<AttendanceSettingsResponse>>(ENDPOINTS.ATTENDANCE_SETTINGS)).data;

export const updateAttendanceSettings = async (settings: AttendanceSettings) =>
  (await axiosInstance.put<ApiResponse<AttendanceSettingsResponse>>(ENDPOINTS.ATTENDANCE_SETTINGS, settings)).data;

export const setBranchGeofence = async (branchId: number, payload: SetBranchGeofencePayload) =>
  (await axiosInstance.put<ApiResponse<BranchGeofence>>(ENDPOINTS.branchGeofence(branchId), payload)).data;

export const clearBranchGeofence = async (branchId: number) =>
  (await axiosInstance.delete<ApiResponse<null>>(ENDPOINTS.branchGeofence(branchId))).data;

export const fetchAttendanceLog = async (date?: string, branchId?: number, pageNumber = 1, pageSize = 50) =>
  (await axiosInstance.get<ApiResponse<PaginatedData<AttendanceRecord>>>(ENDPOINTS.ATTENDANCE, {
    params: { date, branchId, pageNumber, pageSize },
  })).data;

// ── Member / trainer ────────────────────────────────────────────────────
export const fetchMyAttendanceStatus = async () =>
  (await axiosInstance.get<ApiResponse<MyAttendanceStatus>>(ENDPOINTS.ATTENDANCE_STATUS)).data;

export const fetchMyAttendance = async (days = 30) =>
  (await axiosInstance.get<ApiResponse<AttendanceRecord[]>>(ENDPOINTS.ATTENDANCE_ME, { params: { days } })).data;

/** Out-of-range check-ins come back as success:false with the distance in `data` (not an HTTP error). */
export const checkIn = async (fix: LocationFix) =>
  (await axiosInstance.post<ApiResponse<CheckInResult>>(ENDPOINTS.ATTENDANCE_CHECK_IN, fix)).data;

export const checkOut = async (fix?: LocationFix) =>
  (await axiosInstance.post<ApiResponse<AttendanceRecord>>(ENDPOINTS.ATTENDANCE_CHECK_OUT, fix ?? {})).data;
