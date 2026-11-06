import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PenaltyFilter, fetchBookingPolicy, fetchBookingRulesSettings, fetchMemberStanding, fetchMyStanding, fetchPenalties,
  liftBlock, saveBookingRulesSettings, waivePenalty,
} from './bookingRulesApi';
import { BookingRulesSettings } from '../types/bookingRules.types';

// Feature-local keys; everything sits under the 'booking-rules' root so one invalidation refreshes it all.
export const bookingRulesKeys = {
  all: ['booking-rules'] as const,
  policy: ['booking-rules', 'policy'] as const,
  me: (userId: number) => ['booking-rules', 'me', userId] as const,
  settings: ['booking-rules', 'settings'] as const,
  penalties: (f: PenaltyFilter) => ['booking-rules', 'penalties', f.classId ?? null, f.ptSessionId ?? null, f.memberId ?? null] as const,
  member: (id: number) => ['booking-rules', 'member', id] as const,
};
const K = bookingRulesKeys;

export const useBookingPolicy = (enabled = true) =>
  useQuery({ queryKey: K.policy, queryFn: fetchBookingPolicy, enabled, staleTime: 5 * 60_000 });

export const useMyStanding = (userId: number) =>
  useQuery({ queryKey: K.me(userId), queryFn: fetchMyStanding, enabled: userId > 0 });

export const useBookingRulesSettings = () =>
  useQuery({ queryKey: K.settings, queryFn: fetchBookingRulesSettings });

export const usePenalties = (f: PenaltyFilter, enabled = true) =>
  useQuery({ queryKey: K.penalties(f), queryFn: () => fetchPenalties(f), enabled });

export const useMemberStanding = (memberId: number) =>
  useQuery({ queryKey: K.member(memberId), queryFn: () => fetchMemberStanding(memberId), enabled: memberId > 0, retry: false });

function useInvalidate() {
  const qc = useQueryClient();
  // Waivers void invoices: refresh billing lists too (admin billing root + member billing root).
  return () => Promise.all([
    qc.invalidateQueries({ queryKey: K.all }),
    qc.invalidateQueries({ queryKey: ['billing'] }),
  ]);
}

export const useSaveBookingRules = () => {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (s: BookingRulesSettings) => saveBookingRulesSettings(s), onSuccess: invalidate });
};

export const useWaivePenalty = () => {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: ({ id, reason }: { id: number; reason: string }) => waivePenalty(id, reason), onSuccess: invalidate });
};

export const useLiftBlock = () => {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: ({ id, reason }: { id: number; reason?: string }) => liftBlock(id, reason), onSuccess: invalidate });
};
