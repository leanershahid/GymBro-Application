import axiosInstance from '../../../api/axios';
import { ApiResponse } from '../../../api/types';
import { unwrap, unwrapRequired } from '../../../api/http';
import {
  AnnouncementAdmin, AnnouncementAudience, AnnouncementFeed, AnnouncementItem, AnnouncementPayload, AudienceOptions,
  BranchDirectoryItem, BranchHours, BranchHoursConfig, BranchInfo, HoursException, OperationsSettings,
  ServiceStatus, ServiceStatusPayload, UpsertExceptionPayload, WeekdayHours,
} from '../types/operations.types';

// Raw calls for opening hours, service status and announcements. Each returns the envelope's
// `data` (or throws ApiError), so React Query surfaces failures as errors.

const EP = {
  hours: (branchId: number) => `/branches/${branchId}/hours`,
  info: (branchId: number) => `/branches/${branchId}/info`,
  myInfo: '/branches/mine/info',
  directory: '/branches/directory',
  config: (branchId: number) => `/branches/${branchId}/hours/config`,
  weekly: (branchId: number) => `/branches/${branchId}/hours/weekly`,
  exceptions: (branchId: number) => `/branches/${branchId}/hours/exceptions`,
  exception: (branchId: number, id: number) => `/branches/${branchId}/hours/exceptions/${id}`,
  profile: (branchId: number) => `/branches/${branchId}/profile`,
  settings: '/operations/settings',
  status: '/service-status',
  statusAdmin: '/service-status/admin',
  statusOne: (id: number) => `/service-status/admin/${id}`,
  statusEnd: (id: number) => `/service-status/admin/${id}/end`,
  feed: '/announcements',
  unread: '/announcements/unread-count',
  latest: '/announcements/latest-unread',
  mine: (id: number) => `/announcements/${id}`,
  read: (id: number) => `/announcements/${id}/read`,
  readAll: '/announcements/read-all',
  admin: '/announcements/admin',
  adminOne: (id: number) => `/announcements/admin/${id}`,
  publish: (id: number) => `/announcements/admin/${id}/publish`,
  unschedule: (id: number) => `/announcements/admin/${id}/unschedule`,
  audienceCount: '/announcements/admin/audience-count',
  audienceOptions: '/announcements/admin/audience-options',
} as const;

const get = async <T,>(url: string, params?: object) => unwrapRequired((await axiosInstance.get<ApiResponse<T>>(url, { params })).data);

// ── Hours & branch info ─────────────────────────────────────────────────
export const fetchBranchHours = (branchId: number) => get<BranchHours>(EP.hours(branchId));
export const fetchBranchInfo = (branchId?: number) => get<BranchInfo>(branchId ? EP.info(branchId) : EP.myInfo);
export const fetchBranchDirectory = () => get<BranchDirectoryItem[]>(EP.directory);

export const fetchHoursConfig = (branchId: number) => get<BranchHoursConfig>(EP.config(branchId));
export const saveWeeklyHours = async (branchId: number, days: WeekdayHours[]) =>
  unwrapRequired((await axiosInstance.put<ApiResponse<BranchHoursConfig>>(EP.weekly(branchId), { days })).data);
export const upsertHoursException = async (branchId: number, payload: UpsertExceptionPayload) =>
  unwrapRequired((await axiosInstance.post<ApiResponse<HoursException>>(EP.exceptions(branchId), payload)).data);
export const deleteHoursException = async (branchId: number, id: number) => {
  unwrap((await axiosInstance.delete<ApiResponse<null>>(EP.exception(branchId, id))).data);
};
export const saveBranchProfile = async (branchId: number, amenities: string, accessibility: string) =>
  unwrapRequired((await axiosInstance.put<ApiResponse<BranchHoursConfig>>(EP.profile(branchId), { amenities, accessibility })).data);
export const fetchOperationsSettings = () => get<OperationsSettings>(EP.settings);
export const saveOperationsSettings = async (s: OperationsSettings) =>
  unwrapRequired((await axiosInstance.put<ApiResponse<OperationsSettings>>(EP.settings, s)).data);

// ── Service status ──────────────────────────────────────────────────────
/** Active notices for a branch (default: the caller's branch) plus gym-wide ones, worst first. */
export const fetchActiveStatuses = (branchId?: number) => get<ServiceStatus[]>(EP.status, branchId ? { branchId } : undefined);
export const fetchStatusesAdmin = (includeEnded: boolean) => get<ServiceStatus[]>(EP.statusAdmin, { includeEnded });
export const createStatus = async (p: ServiceStatusPayload) =>
  unwrapRequired((await axiosInstance.post<ApiResponse<ServiceStatus>>(EP.statusAdmin, p)).data);
export const updateStatus = async (id: number, p: ServiceStatusPayload) =>
  unwrapRequired((await axiosInstance.put<ApiResponse<ServiceStatus>>(EP.statusOne(id), p)).data);
export const endStatus = async (id: number) =>
  unwrapRequired((await axiosInstance.post<ApiResponse<ServiceStatus>>(EP.statusEnd(id))).data);
export const deleteStatus = async (id: number) => {
  unwrap((await axiosInstance.delete<ApiResponse<null>>(EP.statusOne(id))).data);
};

// ── Announcements: me ───────────────────────────────────────────────────
export const fetchAnnouncementFeed = (pageNumber = 1, pageSize = 20) => get<AnnouncementFeed>(EP.feed, { pageNumber, pageSize });
export const fetchUnreadAnnouncements = async () => (await get<{ count: number }>(EP.unread)).count;
export const fetchLatestUnread = async () =>
  unwrap((await axiosInstance.get<ApiResponse<AnnouncementItem | null>>(EP.latest)).data) ?? null;
/** Opening one marks it read. */
export const fetchAnnouncement = (id: number) => get<AnnouncementItem>(EP.mine(id));
export const markAnnouncementRead = async (id: number) => {
  unwrap((await axiosInstance.post<ApiResponse<unknown>>(EP.read(id))).data);
};
export const markAllAnnouncementsRead = async () => {
  unwrap((await axiosInstance.post<ApiResponse<unknown>>(EP.readAll)).data);
};

// ── Announcements: admin ────────────────────────────────────────────────
export const fetchAnnouncementsAdmin = (status?: string) => get<AnnouncementAdmin[]>(EP.admin, status ? { status } : undefined);
export const fetchAnnouncementAdmin = (id: number) => get<AnnouncementAdmin>(EP.adminOne(id));
export const createAnnouncement = async (p: AnnouncementPayload) =>
  unwrapRequired((await axiosInstance.post<ApiResponse<AnnouncementAdmin>>(EP.admin, p)).data);
export const updateAnnouncement = async (id: number, p: AnnouncementPayload) =>
  unwrapRequired((await axiosInstance.put<ApiResponse<AnnouncementAdmin>>(EP.adminOne(id), p)).data);
export const publishAnnouncement = async (id: number) =>
  unwrapRequired((await axiosInstance.post<ApiResponse<AnnouncementAdmin>>(EP.publish(id))).data);
export const unscheduleAnnouncement = async (id: number) =>
  unwrapRequired((await axiosInstance.post<ApiResponse<AnnouncementAdmin>>(EP.unschedule(id))).data);
export const deleteAnnouncement = async (id: number) => {
  unwrap((await axiosInstance.delete<ApiResponse<null>>(EP.adminOne(id))).data);
};
export const fetchAudienceCount = async (audience: AnnouncementAudience, audienceIds: number[]) =>
  (await get<{ count: number }>(EP.audienceCount, { audience, audienceIds })).count;
export const fetchAudienceOptions = () => get<AudienceOptions>(EP.audienceOptions);
