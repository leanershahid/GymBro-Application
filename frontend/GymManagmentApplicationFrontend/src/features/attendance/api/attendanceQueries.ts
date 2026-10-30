import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../api/queryKeys';
import {
  checkIn, checkInMember, checkOut, checkOutMember, clearBranchGeofence, fetchAttendanceLog, fetchAttendanceSettings,
  fetchMyAttendance, fetchMyAttendanceStatus, setBranchGeofence, updateAttendanceSettings,
} from './attendanceApi';
import { AttendanceSettings, LocationFix, SetBranchGeofencePayload } from '../types/attendance.types';

const K = queryKeys.attendance;

// ── Admin ───────────────────────────────────────────────────────────────
export const useAttendanceSettings = () =>
  useQuery({ queryKey: K.settings, queryFn: fetchAttendanceSettings, select: r => r.data });

export const useUpdateAttendanceSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: AttendanceSettings) => updateAttendanceSettings(s),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.settings }),
  });
};

export const useSetBranchGeofence = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ branchId, payload }: { branchId: number; payload: SetBranchGeofencePayload }) =>
      setBranchGeofence(branchId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.settings }),
  });
};

export const useClearBranchGeofence = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (branchId: number) => clearBranchGeofence(branchId),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.settings }),
  });
};

export const useAttendanceLog = (date?: string, branchId?: number) =>
  useQuery({
    queryKey: K.log(date, branchId),
    queryFn: () => fetchAttendanceLog(date, branchId),
    select: r => r.data,
  });

/** Front desk check-in / check-out of a member; refreshes the attendance log. */
export const useCheckInMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => checkInMember(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance-log'] }),
  });
};

export const useCheckOutMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => checkOutMember(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance-log'] }),
  });
};

// ── Member / trainer ────────────────────────────────────────────────────
export const useMyAttendanceStatus = () =>
  useQuery({ queryKey: K.myStatus, queryFn: fetchMyAttendanceStatus, select: r => r.data });

export const useMyAttendance = (days = 30) =>
  useQuery({ queryKey: K.myHistory(days), queryFn: () => fetchMyAttendance(days), select: r => r.data ?? [] });

export const useCheckIn = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fix: LocationFix) => checkIn(fix),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: K.myStatus });
      qc.invalidateQueries({ queryKey: ['attendance-me'] });
    },
  });
};

export const useCheckOut = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fix?: LocationFix) => checkOut(fix),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: K.myStatus });
      qc.invalidateQueries({ queryKey: ['attendance-me'] });
    },
  });
};
