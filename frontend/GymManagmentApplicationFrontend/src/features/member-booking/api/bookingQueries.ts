import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchClassSchedule, fetchMyClasses, bookClass, cancelClassBooking,
  fetchPtTypes, fetchMyPtSessions, bookPtSession, cancelPtSession, ratePtSession,
} from './bookingApi';
import { BookPtPayload } from '../types/booking.types';

// Local keys, scoped by user so a sign-out/sign-in never shows the previous member's bookings.
export const memberBookingKeys = {
  all: (userId: number) => ['member-booking', userId] as const,
  schedule: (userId: number, fromIso: string, toIso: string) => ['member-booking', userId, 'schedule', fromIso, toIso] as const,
  myClasses: (userId: number) => ['member-booking', userId, 'my-classes'] as const,
  ptTypes: (userId: number) => ['member-booking', userId, 'pt-types'] as const,
  ptSessions: (userId: number) => ['member-booking', userId, 'pt-sessions'] as const,
};

const K = memberBookingKeys;

export const useClassSchedule = (userId: number, fromIso: string, toIso: string) =>
  useQuery({ queryKey: K.schedule(userId, fromIso, toIso), queryFn: () => fetchClassSchedule(fromIso, toIso), enabled: userId > 0 });

export const useMyClasses = (userId: number) =>
  useQuery({ queryKey: K.myClasses(userId), queryFn: fetchMyClasses, enabled: userId > 0 });

export const usePtTypes = (userId: number) =>
  useQuery({ queryKey: K.ptTypes(userId), queryFn: fetchPtTypes, enabled: userId > 0, staleTime: 5 * 60_000 });

export const useMyPtSessions = (userId: number) =>
  useQuery({ queryKey: K.ptSessions(userId), queryFn: fetchMyPtSessions, enabled: userId > 0 });

/** Any booking change refreshes every booking list (and billing, since PT bookings raise/void invoices). */
function useInvalidateAll(userId: number) {
  const qc = useQueryClient();
  return () => Promise.all([
    qc.invalidateQueries({ queryKey: K.all(userId) }),
    qc.invalidateQueries({ queryKey: ['member-billing', userId] }),
  ]);
}

export const useBookClass = (userId: number) => {
  const invalidate = useInvalidateAll(userId);
  return useMutation({ mutationFn: (classId: number) => bookClass(classId), onSuccess: invalidate });
};

export const useCancelClassBooking = (userId: number) => {
  const invalidate = useInvalidateAll(userId);
  return useMutation({ mutationFn: (classId: number) => cancelClassBooking(classId), onSuccess: invalidate });
};

export const useBookPtSession = (userId: number) => {
  const invalidate = useInvalidateAll(userId);
  return useMutation({ mutationFn: (p: BookPtPayload) => bookPtSession(p), onSuccess: invalidate });
};

export const useCancelPtSession = (userId: number) => {
  const invalidate = useInvalidateAll(userId);
  return useMutation({ mutationFn: (sessionId: number) => cancelPtSession(sessionId), onSuccess: invalidate });
};

export const useRatePtSession = (userId: number) => {
  const invalidate = useInvalidateAll(userId);
  return useMutation({
    mutationFn: ({ sessionId, rating }: { sessionId: number; rating: number }) => ratePtSession(sessionId, rating),
    onSuccess: invalidate,
  });
};
