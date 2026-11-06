import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from './operationsApi';
import {
  AnnouncementAudience, AnnouncementPayload, OperationsSettings, ServiceStatusPayload, UpsertExceptionPayload, WeekdayHours,
} from '../types/operations.types';

/** Feature-local query keys; every key starts with the 'operations' root. */
export const K = {
  all: ['operations'] as const,
  hours: (branchId: number) => ['operations', 'hours', branchId] as const,
  info: (branchId?: number) => ['operations', 'info', branchId ?? 'mine'] as const,
  infoAll: ['operations', 'info'] as const,
  directory: ['operations', 'directory'] as const,
  config: (branchId: number) => ['operations', 'config', branchId] as const,
  settings: ['operations', 'settings'] as const,
  statusAll: ['operations', 'status'] as const,
  status: (branchId?: number) => ['operations', 'status', 'active', branchId ?? 'mine'] as const,
  statusAdmin: (includeEnded: boolean) => ['operations', 'status', 'admin', includeEnded] as const,
  feedAll: ['operations', 'feed'] as const,
  feed: ['operations', 'feed', 'list'] as const,
  unread: ['operations', 'feed', 'unread'] as const,
  latest: ['operations', 'feed', 'latest'] as const,
  one: (id: number) => ['operations', 'feed', 'one', id] as const,
  adminAll: ['operations', 'admin'] as const,
  adminList: (status?: string) => ['operations', 'admin', 'list', status ?? 'all'] as const,
  adminOne: (id: number) => ['operations', 'admin', 'one', id] as const,
  audienceCount: (a: AnnouncementAudience, ids: number[]) => ['operations', 'admin', 'audience', a, ids.join(',')] as const,
  audienceOptions: ['operations', 'admin', 'audience-options'] as const,
};

const MINUTE = 60_000;

// ── Hours & branch info ─────────────────────────────────────────────────
export const useBranchHours = (branchId: number) =>
  useQuery({ queryKey: K.hours(branchId), queryFn: () => api.fetchBranchHours(branchId), enabled: branchId > 0, refetchInterval: 5 * MINUTE });

/** Branch info (address, hours, statuses). No id = the caller's own branch. */
export const useBranchInfo = (branchId?: number) =>
  useQuery({ queryKey: K.info(branchId), queryFn: () => api.fetchBranchInfo(branchId), refetchInterval: 5 * MINUTE });

export const useBranchDirectory = () => useQuery({ queryKey: K.directory, queryFn: api.fetchBranchDirectory });

export const useHoursConfig = (branchId: number) =>
  useQuery({ queryKey: K.config(branchId), queryFn: () => api.fetchHoursConfig(branchId), enabled: branchId > 0 });

const useInvalidateHours = () => {
  const qc = useQueryClient();
  return (branchId: number) => {
    qc.invalidateQueries({ queryKey: K.config(branchId) });
    qc.invalidateQueries({ queryKey: K.hours(branchId) });
    qc.invalidateQueries({ queryKey: K.infoAll });
    qc.invalidateQueries({ queryKey: K.directory });
  };
};

export const useSaveWeeklyHours = () => {
  const invalidate = useInvalidateHours();
  return useMutation({
    mutationFn: ({ branchId, days }: { branchId: number; days: WeekdayHours[] }) => api.saveWeeklyHours(branchId, days),
    onSuccess: (_d, v) => invalidate(v.branchId),
  });
};

export const useUpsertHoursException = () => {
  const invalidate = useInvalidateHours();
  return useMutation({
    mutationFn: ({ branchId, payload }: { branchId: number; payload: UpsertExceptionPayload }) => api.upsertHoursException(branchId, payload),
    onSuccess: (_d, v) => invalidate(v.branchId),
  });
};

export const useDeleteHoursException = () => {
  const invalidate = useInvalidateHours();
  return useMutation({
    mutationFn: ({ branchId, id }: { branchId: number; id: number }) => api.deleteHoursException(branchId, id),
    onSuccess: (_d, v) => invalidate(v.branchId),
  });
};

export const useSaveBranchProfile = () => {
  const invalidate = useInvalidateHours();
  return useMutation({
    mutationFn: ({ branchId, amenities, accessibility }: { branchId: number; amenities: string; accessibility: string }) =>
      api.saveBranchProfile(branchId, amenities, accessibility),
    onSuccess: (_d, v) => invalidate(v.branchId),
  });
};

export const useOperationsSettings = () => useQuery({ queryKey: K.settings, queryFn: api.fetchOperationsSettings });

export const useSaveOperationsSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: OperationsSettings) => api.saveOperationsSettings(s),
    onSuccess: (data) => qc.setQueryData(K.settings, data),
  });
};

// ── Service status ──────────────────────────────────────────────────────
export const useActiveStatuses = (branchId?: number) =>
  useQuery({ queryKey: K.status(branchId), queryFn: () => api.fetchActiveStatuses(branchId), refetchInterval: 5 * MINUTE });

export const useStatusesAdmin = (includeEnded: boolean) =>
  useQuery({ queryKey: K.statusAdmin(includeEnded), queryFn: () => api.fetchStatusesAdmin(includeEnded) });

const useStatusMutation = <V,>(fn: (v: V) => Promise<unknown>) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: K.statusAll });
      qc.invalidateQueries({ queryKey: K.infoAll });
    },
  });
};

export const useCreateStatus = () => useStatusMutation((p: ServiceStatusPayload) => api.createStatus(p));
export const useUpdateStatus = () => useStatusMutation(({ id, payload }: { id: number; payload: ServiceStatusPayload }) => api.updateStatus(id, payload));
export const useEndStatus = () => useStatusMutation((id: number) => api.endStatus(id));
export const useDeleteStatus = () => useStatusMutation((id: number) => api.deleteStatus(id));

// ── Announcements: me ───────────────────────────────────────────────────
export const useAnnouncementFeed = () =>
  useInfiniteQuery({
    queryKey: K.feed,
    queryFn: ({ pageParam }) => api.fetchAnnouncementFeed(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.pageNumber + 1 : undefined),
  });

/** Unread count for the dot on Home / menu. */
export const useUnreadAnnouncements = () =>
  useQuery({ queryKey: K.unread, queryFn: api.fetchUnreadAnnouncements, refetchInterval: 2 * MINUTE });

export const useLatestUnreadAnnouncement = () =>
  useQuery({ queryKey: K.latest, queryFn: api.fetchLatestUnread, refetchInterval: 2 * MINUTE });

/** Opening an announcement marks it read on the server; refresh the feed counters afterwards. */
export const useAnnouncement = (id: number) => {
  const qc = useQueryClient();
  return useQuery({
    queryKey: K.one(id),
    queryFn: async () => {
      const item = await api.fetchAnnouncement(id);
      qc.invalidateQueries({ queryKey: K.unread });
      qc.invalidateQueries({ queryKey: K.latest });
      qc.invalidateQueries({ queryKey: K.feed });
      return item;
    },
    enabled: id > 0,
  });
};

export const useMarkAnnouncementRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | null) => (id == null ? api.markAllAnnouncementsRead() : api.markAnnouncementRead(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.feedAll }),
  });
};

// ── Announcements: admin ────────────────────────────────────────────────
export const useAnnouncementsAdmin = (status?: string) =>
  useQuery({ queryKey: K.adminList(status), queryFn: () => api.fetchAnnouncementsAdmin(status) });

export const useAnnouncementAdmin = (id: number) =>
  useQuery({ queryKey: K.adminOne(id), queryFn: () => api.fetchAnnouncementAdmin(id), enabled: id > 0 });

export const useAudienceOptions = () => useQuery({ queryKey: K.audienceOptions, queryFn: api.fetchAudienceOptions, staleTime: 5 * MINUTE });

export const useAudienceCount = (audience: AnnouncementAudience, ids: number[]) =>
  useQuery({
    queryKey: K.audienceCount(audience, ids),
    queryFn: () => api.fetchAudienceCount(audience, ids),
    enabled: audience === 'AllMembers' || audience === 'Staff' || ids.length > 0,
  });

const useAdminMutation = <V, R>(fn: (v: V) => Promise<R>) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: K.adminAll });
      qc.invalidateQueries({ queryKey: K.feedAll });
    },
  });
};

export const useSaveAnnouncement = () =>
  useAdminMutation(({ id, payload }: { id?: number; payload: AnnouncementPayload }) =>
    id ? api.updateAnnouncement(id, payload) : api.createAnnouncement(payload));
export const usePublishAnnouncement = () => useAdminMutation((id: number) => api.publishAnnouncement(id));
export const useUnscheduleAnnouncement = () => useAdminMutation((id: number) => api.unscheduleAnnouncement(id));
export const useDeleteAnnouncement = () => useAdminMutation((id: number) => api.deleteAnnouncement(id));
