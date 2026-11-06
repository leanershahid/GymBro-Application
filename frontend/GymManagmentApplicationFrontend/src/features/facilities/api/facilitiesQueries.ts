import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from './facilitiesApi';
import type {
  AssetPayload, BulkAssetPayload, CreateReportPayload, FacilitiesSettings, IncidentPayload, MaintenancePayload,
  SetAssetStatusPayload, UpdateReportPayload,
} from '../types/facilities.types';

/** Feature-local query keys; every key starts with the 'facilities' root. */
export const K = {
  all: ['facilities'] as const,
  branches: ['facilities', 'branches'] as const,
  options: (branchId: number) => ['facilities', 'options', branchId] as const,
  outOfService: (branchId: number) => ['facilities', 'oos', branchId] as const,
  openFor: (assetId: number) => ['facilities', 'open-for', assetId] as const,
  mineAll: ['facilities', 'mine'] as const,
  mine: ['facilities', 'mine', 'list'] as const,
  mineOne: (id: number) => ['facilities', 'mine', 'one', id] as const,
  assetsAll: ['facilities', 'assets'] as const,
  assets: (q: object) => ['facilities', 'assets', 'list', JSON.stringify(q)] as const,
  asset: (id: number) => ['facilities', 'assets', 'one', id] as const,
  zones: (branchId?: number) => ['facilities', 'zones', branchId ?? 'all'] as const,
  settings: ['facilities', 'settings'] as const,
  queueAll: ['facilities', 'queue'] as const,
  queue: (q: object) => ['facilities', 'queue', 'list', JSON.stringify(q)] as const,
  queueOne: (id: number) => ['facilities', 'queue', 'one', id] as const,
  counts: ['facilities', 'queue', 'counts'] as const,
  assignees: ['facilities', 'assignees'] as const,
  incidentsAll: ['facilities', 'incidents'] as const,
  incidents: (q: object) => ['facilities', 'incidents', 'list', JSON.stringify(q)] as const,
  incident: (id: number) => ['facilities', 'incidents', 'one', id] as const,
  incidentAudit: (id: number) => ['facilities', 'incidents', 'audit', id] as const,
  people: (q: string) => ['facilities', 'people', q] as const,
};

const MINUTE = 60_000;

// ── Shared ──────────────────────────────────────────────────────────────
export const useFacilityBranches = () => useQuery({ queryKey: K.branches, queryFn: api.fetchBranches, staleTime: 10 * MINUTE });

// ── Members / trainers ──────────────────────────────────────────────────
export const useReportOptions = (branchId: number) =>
  useQuery({ queryKey: K.options(branchId), queryFn: () => api.fetchReportOptions(branchId), enabled: branchId > 0 });
export const useOutOfService = (branchId: number) =>
  useQuery({ queryKey: K.outOfService(branchId), queryFn: () => api.fetchOutOfService(branchId), enabled: branchId > 0, refetchInterval: 5 * MINUTE });
export const useOpenForAsset = (assetId: number) =>
  useQuery({ queryKey: K.openFor(assetId), queryFn: () => api.fetchOpenForAsset(assetId), enabled: assetId > 0 });
export const useMyReports = () => useQuery({ queryKey: K.mine, queryFn: api.fetchMyReports });
export const useMyReport = (id: number) => useQuery({ queryKey: K.mineOne(id), queryFn: () => api.fetchMyReport(id), enabled: id > 0 });

const useInvalidateAll = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: K.all });
};

export function useCreateReport() {
  const inv = useInvalidateAll();
  return useMutation({ mutationFn: (p: CreateReportPayload) => api.createReport(p), onSuccess: inv });
}
export function usePlusOne() {
  const inv = useInvalidateAll();
  return useMutation({ mutationFn: (v: { id: number; comment?: string; unsafe?: boolean }) => api.plusOne(v.id, v.comment, v.unsafe), onSuccess: inv });
}
export function useCommentMine(id: number) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: string) => api.commentMine(id, body), onSuccess: d => qc.setQueryData(K.mineOne(id), d) });
}

// ── Register ────────────────────────────────────────────────────────────
export const useAssets = (q: { branchId?: number; zone?: string; status?: string; q?: string }) =>
  useQuery({ queryKey: K.assets(q), queryFn: () => api.fetchAssets(q) });
export const useAsset = (id: number) => useQuery({ queryKey: K.asset(id), queryFn: () => api.fetchAsset(id), enabled: id > 0 });
export const useZones = (branchId?: number) => useQuery({ queryKey: K.zones(branchId), queryFn: () => api.fetchZones(branchId) });
export const useFacilitiesSettings = () => useQuery({ queryKey: K.settings, queryFn: api.fetchFacilitiesSettings });

export function useSaveAsset(id?: number) {
  const inv = useInvalidateAll();
  return useMutation({ mutationFn: (p: AssetPayload) => (id ? api.updateAsset(id, p) : api.createAsset(p)), onSuccess: inv });
}
export function useBulkAssets() {
  const inv = useInvalidateAll();
  return useMutation({ mutationFn: (p: BulkAssetPayload) => api.bulkCreateAssets(p), onSuccess: inv });
}
export function useArchiveAsset() {
  const inv = useInvalidateAll();
  return useMutation({ mutationFn: (id: number) => api.archiveAsset(id), onSuccess: inv });
}
export function useSetAssetStatus(id: number) {
  const inv = useInvalidateAll();
  return useMutation({ mutationFn: (p: SetAssetStatusPayload) => api.setAssetStatus(id, p), onSuccess: inv });
}
export function useAddMaintenance(id: number) {
  const inv = useInvalidateAll();
  return useMutation({ mutationFn: (p: MaintenancePayload) => api.addMaintenance(id, p), onSuccess: inv });
}
export function useDeleteMaintenance(id: number) {
  const inv = useInvalidateAll();
  return useMutation({ mutationFn: (entryId: number) => api.deleteMaintenance(id, entryId), onSuccess: inv });
}
export function useSaveFacilitiesSettings() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (s: FacilitiesSettings) => api.saveFacilitiesSettings(s), onSuccess: d => qc.setQueryData(K.settings, d) });
}

// ── Triage queue ────────────────────────────────────────────────────────
export const useStaffReports = (q: { status?: string; branchId?: number; urgent?: boolean; mine?: boolean }) =>
  useQuery({ queryKey: K.queue(q), queryFn: () => api.fetchStaffReports(q), refetchInterval: 2 * MINUTE });
export const useStaffReport = (id: number) => useQuery({ queryKey: K.queueOne(id), queryFn: () => api.fetchStaffReport(id), enabled: id > 0 });
export const useAssignees = () => useQuery({ queryKey: K.assignees, queryFn: api.fetchAssignees, staleTime: 10 * MINUTE });

/** Open / urgent problem reports, for badges (no badge when the module isn't granted: the call fails quietly). */
export function useFacilityReportCounts(enabled = true) {
  return useQuery({ queryKey: K.counts, queryFn: api.fetchReportCounts, enabled, refetchInterval: 2 * MINUTE, retry: false });
}

export function useUpdateReport(id: number) {
  const inv = useInvalidateAll();
  return useMutation({ mutationFn: (p: UpdateReportPayload) => api.updateReport(id, p), onSuccess: inv });
}
export function useStaffComment(id: number) {
  const inv = useInvalidateAll();
  return useMutation({ mutationFn: (v: { body: string; internal: boolean }) => api.staffComment(id, v.body, v.internal), onSuccess: inv });
}
export function useReportOutOfService(id: number) {
  const inv = useInvalidateAll();
  return useMutation({
    mutationFn: (p: { status?: 'OutOfService' | 'Limited'; reason?: string; expectedBackOn?: string | null; postServiceNotice?: boolean }) =>
      api.markReportAssetOutOfService(id, p),
    onSuccess: inv,
  });
}

// ── Incidents ───────────────────────────────────────────────────────────
export const useIncidents = (q: { status?: string; branchId?: number; type?: string; q?: string }) =>
  useQuery({ queryKey: K.incidents(q), queryFn: () => api.fetchIncidents(q) });
export const useIncident = (id: number) => useQuery({ queryKey: K.incident(id), queryFn: () => api.fetchIncident(id), enabled: id > 0 });
export const useIncidentAudit = (id: number, enabled: boolean) =>
  useQuery({ queryKey: K.incidentAudit(id), queryFn: () => api.fetchIncidentAudit(id), enabled: enabled && id > 0 });
export const usePeopleSearch = (q: string) =>
  useQuery({ queryKey: K.people(q), queryFn: () => api.searchPeople(q), enabled: q.trim().length >= 2 });

const useInvalidateIncidents = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: K.incidentsAll });
};
export function useSaveIncident(id?: number) {
  const inv = useInvalidateIncidents();
  return useMutation({ mutationFn: (p: IncidentPayload) => (id ? api.updateIncident(id, p) : api.createIncident(p)), onSuccess: inv });
}
export function useCloseIncident(id: number) {
  const inv = useInvalidateIncidents();
  return useMutation({ mutationFn: (note?: string) => api.closeIncident(id, note), onSuccess: inv });
}
export function useAddAddendum(id: number) {
  const inv = useInvalidateIncidents();
  return useMutation({ mutationFn: (body: string) => api.addAddendum(id, body), onSuccess: inv });
}
