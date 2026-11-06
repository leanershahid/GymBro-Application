import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  claimWaitlistOffer, declineWaitlistOffer, fetchGymNotificationSettings, fetchNotificationPreferences,
  fetchNotifications, markAllNotificationsRead, markNotificationRead, updateGymNotificationSettings,
  updateNotificationPreferences,
} from './notificationsApi';
import type { GymNotificationSettings, UpdateNotificationPreferences } from '../types/notifications.types';

/** Feature-local keys, scoped by user so another account never sees the previous one's alerts. */
export const notificationKeys = {
  all: (userId: number) => ['notifications', userId] as const,
  list: (userId: number) => ['notifications', userId, 'list'] as const,
  preferences: (userId: number) => ['notifications', userId, 'preferences'] as const,
  gymSettings: (userId: number) => ['notifications', userId, 'gym-settings'] as const,
};
const K = notificationKeys;

export const useNotifications = (userId: number) =>
  useQuery({ queryKey: K.list(userId), queryFn: () => fetchNotifications(false), enabled: userId > 0, refetchInterval: 60_000 });

export const useMarkNotificationRead = (userId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | null) => (id == null ? markAllNotificationsRead() : markNotificationRead(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.list(userId) }),
  });
};

export const useNotificationPreferences = (userId: number) =>
  useQuery({ queryKey: K.preferences(userId), queryFn: fetchNotificationPreferences, enabled: userId > 0 });

export const useUpdateNotificationPreferences = (userId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateNotificationPreferences) => updateNotificationPreferences(body),
    onSuccess: prefs => qc.setQueryData(K.preferences(userId), prefs),
  });
};

export const useGymNotificationSettings = (userId: number) =>
  useQuery({ queryKey: K.gymSettings(userId), queryFn: fetchGymNotificationSettings, enabled: userId > 0 });

export const useUpdateGymNotificationSettings = (userId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: GymNotificationSettings) => updateGymNotificationSettings(body),
    onSuccess: s => qc.setQueryData(K.gymSettings(userId), s),
  });
};

/**
 * Claim / decline a held waitlist spot. On success the caller should refresh its booking lists
 * (pass `onDone`, e.g. invalidate `memberBookingKeys.all(userId)`), since this feature doesn't
 * import member-booking internals.
 */
export const useWaitlistOfferAction = (userId: number, onDone?: () => void) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, action }: { classId: number; action: 'claim' | 'decline' }) =>
      action === 'claim' ? claimWaitlistOffer(classId) : declineWaitlistOffer(classId),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: K.list(userId) });
      onDone?.();
    },
  });
};
