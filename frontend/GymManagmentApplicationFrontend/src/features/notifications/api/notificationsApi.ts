import axiosInstance from '../../../api/axios';
import { ApiResponse } from '../../../api/types';
import { unwrapRequired as unwrap } from '../../../api/http';
import type {
  GymNotificationSettings, NotificationPreferences, NotificationsPage, UpdateNotificationPreferences,
} from '../types/notifications.types';

const EP = {
  list: '/notifications',
  read: (id: number) => `/notifications/${id}/read`,
  readAll: '/notifications/read-all',
  devices: '/me/push-devices',
  unregister: '/me/push-devices/unregister',
  preferences: '/me/notification-preferences',
  gymSettings: '/notification-settings',
  claimOffer: (classId: number) => `/classes/${classId}/waitlist-offer/claim`,
  declineOffer: (classId: number) => `/classes/${classId}/waitlist-offer/decline`,
} as const;

// ── In-app list ──────────────────────────────────────────────────────────────

export const fetchNotifications = async (unreadOnly = false): Promise<NotificationsPage> => {
  const { data } = await axiosInstance.get<ApiResponse<NotificationsPage>>(EP.list, { params: { unreadOnly } });
  return unwrap(data, { items: [], unread: 0 });
};

export const markNotificationRead = async (id: number): Promise<void> => {
  const { data } = await axiosInstance.put<ApiResponse<unknown>>(EP.read(id));
  unwrap(data, null);
};

export const markAllNotificationsRead = async (): Promise<void> => {
  const { data } = await axiosInstance.put<ApiResponse<unknown>>(EP.readAll);
  unwrap(data, null);
};

// ── Push devices ─────────────────────────────────────────────────────────────

export const registerPushDevice = async (token: string, platform: 'ios' | 'android' | 'web', deviceName?: string): Promise<void> => {
  const { data } = await axiosInstance.post<ApiResponse<unknown>>(EP.devices, { token, platform, deviceName });
  unwrap(data, null);
};

export const unregisterPushDeviceToken = async (token: string): Promise<void> => {
  const { data } = await axiosInstance.post<ApiResponse<unknown>>(EP.unregister, { token });
  unwrap(data, null);
};

// ── Preferences ──────────────────────────────────────────────────────────────

export const fetchNotificationPreferences = async (): Promise<NotificationPreferences> => {
  const { data } = await axiosInstance.get<ApiResponse<NotificationPreferences>>(EP.preferences);
  return unwrap(data);
};

export const updateNotificationPreferences = async (body: UpdateNotificationPreferences): Promise<NotificationPreferences> => {
  const { data } = await axiosInstance.put<ApiResponse<NotificationPreferences>>(EP.preferences, body);
  return unwrap(data);
};

export const fetchGymNotificationSettings = async (): Promise<GymNotificationSettings> => {
  const { data } = await axiosInstance.get<ApiResponse<GymNotificationSettings>>(EP.gymSettings);
  return unwrap(data);
};

export const updateGymNotificationSettings = async (body: GymNotificationSettings): Promise<GymNotificationSettings> => {
  const { data } = await axiosInstance.put<ApiResponse<GymNotificationSettings>>(EP.gymSettings, body);
  return unwrap(data);
};

// ── Waitlist offers ──────────────────────────────────────────────────────────

/** Claims the spot held for the member. A lapsed offer fails with 409 (it went to the next person). */
export const claimWaitlistOffer = async (classId: number): Promise<string> => {
  const { data } = await axiosInstance.post<ApiResponse<unknown>>(EP.claimOffer(classId), {});
  unwrap(data, null);
  return data.message;
};

export const declineWaitlistOffer = async (classId: number): Promise<string> => {
  const { data } = await axiosInstance.post<ApiResponse<unknown>>(EP.declineOffer(classId), {});
  unwrap(data, null);
  return data.message;
};
