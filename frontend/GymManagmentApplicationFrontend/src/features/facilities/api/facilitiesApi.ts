import { isAxiosError } from 'axios';
import axiosInstance from '../../../api/axios';
import { ApiResponse } from '../../../api/types';
import { unwrap, unwrapRequired } from '../../../api/http';
import { uploadFile } from '../../../api/upload';
import type {
  Asset, AssetDetail, AssetPayload, AssetPick, BranchOption, BulkAssetPayload, CreateReportPayload, CreateReportResult,
  ExistingReport, FacilitiesSettings, IncidentAuditEntry, IncidentDetail, IncidentPage, IncidentPayload, Maintenance,
  MaintenancePayload, MyReport, MyReportDetail, OutOfServiceItem, PersonSearchItem, ReportCounts, ReportOptions,
  SetAssetStatusPayload, SetAssetStatusResult, StaffPick, StaffReportDetail, StaffReportItem, UpdateReportPayload,
} from '../types/facilities.types';

// Raw calls for the equipment register, problem reports and incident log (backend
// Controllers/FacilitiesController.cs + IncidentsController.cs). Each returns the envelope's data.

const EP = {
  branches: '/branches/directory',
  options: '/facilities/report-options',
  byCode: (code: string) => `/facilities/by-code/${encodeURIComponent(code)}`,
  outOfService: '/facilities/out-of-service',
  assets: '/facilities/assets',
  asset: (id: number) => `/facilities/assets/${id}`,
  bulk: '/facilities/assets/bulk',
  status: (id: number) => `/facilities/assets/${id}/status`,
  maintenance: (id: number) => `/facilities/assets/${id}/maintenance`,
  maintenanceOne: (id: number, entryId: number) => `/facilities/assets/${id}/maintenance/${entryId}`,
  zones: '/facilities/zones',
  settings: '/facilities/settings',
  reports: '/facility-reports',
  mine: '/facility-reports/mine',
  mineOne: (id: number) => `/facility-reports/mine/${id}`,
  openFor: (assetId: number) => `/facility-reports/open-for-asset/${assetId}`,
  plusOne: (id: number) => `/facility-reports/${id}/plus-one`,
  comment: (id: number) => `/facility-reports/${id}/comments`,
  admin: '/facility-reports/admin',
  counts: '/facility-reports/admin/counts',
  assignees: '/facility-reports/admin/assignees',
  adminOne: (id: number) => `/facility-reports/admin/${id}`,
  adminComment: (id: number) => `/facility-reports/admin/${id}/comments`,
  adminOos: (id: number) => `/facility-reports/admin/${id}/out-of-service`,
  incidents: '/incidents',
  incident: (id: number) => `/incidents/${id}`,
  incidentAudit: (id: number) => `/incidents/${id}/audit`,
  incidentClose: (id: number) => `/incidents/${id}/close`,
  incidentAddendum: (id: number) => `/incidents/${id}/addenda`,
  people: '/incidents/people',
} as const;

const get = async <T,>(url: string, params?: object) => unwrapRequired((await axiosInstance.get<ApiResponse<T>>(url, { params })).data);
const post = async <T,>(url: string, body?: unknown) => unwrapRequired((await axiosInstance.post<ApiResponse<T>>(url, body ?? {})).data);
const put = async <T,>(url: string, body?: unknown) => unwrapRequired((await axiosInstance.put<ApiResponse<T>>(url, body ?? {})).data);

/** The error envelope can carry a machine code and data (backend RuleException). */
type CodedResponse<T> = ApiResponse<T> & { code?: string | null };

// ── Shared ──────────────────────────────────────────────────────────────
export const fetchBranches = () => get<BranchOption[]>(EP.branches);

/** Uploads one picked photo / document and returns its URL. */
export async function uploadPicked(file: { uri: string; mimeType?: string | null; fileName?: string | null }, kind: 'image' | 'document' = 'image') {
  const res = await uploadFile<{ url: string }>(`/uploads?kind=${kind}&folder=${kind === 'image' ? 'media' : 'documents'}`, 'file', file);
  if (!res.success || !res.data?.url) throw new Error(res.message || "Couldn't upload this file.");
  return res.data.url;
}

/** A short-lived link for a private document (incident attachments). */
export const fetchSignedUrl = async (url: string) => (await get<{ url: string }>('/uploads/signed-url', { url })).url;

// ── Members / trainers ──────────────────────────────────────────────────
export const fetchReportOptions = (branchId: number) => get<ReportOptions>(EP.options, { branchId });
export const fetchAssetByCode = (code: string) => get<AssetPick>(EP.byCode(code));
export const fetchOutOfService = (branchId: number) => get<OutOfServiceItem[]>(EP.outOfService, { branchId });

/** Creates the report, or returns the open one for the asset (409 ALREADY_REPORTED). */
export async function createReport(payload: CreateReportPayload): Promise<CreateReportResult> {
  let body: CodedResponse<unknown>;
  try {
    body = (await axiosInstance.post<CodedResponse<unknown>>(EP.reports, payload)).data;
  } catch (e) {
    if (isAxiosError<CodedResponse<unknown>>(e) && e.response?.status === 409 && e.response.data?.code === 'ALREADY_REPORTED')
      body = e.response.data;
    else throw e;
  }
  if (!body.success && body.code === 'ALREADY_REPORTED' && body.data) return { duplicate: body.data as ExistingReport };
  return { created: unwrapRequired(body as ApiResponse<MyReportDetail>) };
}

export const fetchOpenForAsset = async (assetId: number) =>
  unwrap((await axiosInstance.get<ApiResponse<ExistingReport | null>>(EP.openFor(assetId))).data) ?? null;
export const plusOne = (id: number, comment?: string, unsafe?: boolean) => post<MyReportDetail>(EP.plusOne(id), { comment, unsafe: !!unsafe });
export const commentMine = (id: number, body: string) => post<MyReportDetail>(EP.comment(id), { body });
export const fetchMyReports = () => get<MyReport[]>(EP.mine);
export const fetchMyReport = (id: number) => get<MyReportDetail>(EP.mineOne(id));

// ── Register (staff) ────────────────────────────────────────────────────
export const fetchAssets = (q: { branchId?: number; zone?: string; status?: string; q?: string }) => get<Asset[]>(EP.assets, q);
export const fetchAsset = (id: number) => get<AssetDetail>(EP.asset(id));
export const createAsset = (p: AssetPayload) => post<Asset>(EP.assets, p);
export const bulkCreateAssets = (p: BulkAssetPayload) => post<Asset[]>(EP.bulk, p);
export const updateAsset = (id: number, p: AssetPayload) => put<Asset>(EP.asset(id), p);
export const archiveAsset = async (id: number) => { unwrap((await axiosInstance.delete<ApiResponse<null>>(EP.asset(id))).data); };
export const setAssetStatus = (id: number, p: SetAssetStatusPayload) => put<SetAssetStatusResult>(EP.status(id), p);
export const addMaintenance = (id: number, p: MaintenancePayload) => post<Maintenance>(EP.maintenance(id), p);
export const deleteMaintenance = async (id: number, entryId: number) => {
  unwrap((await axiosInstance.delete<ApiResponse<null>>(EP.maintenanceOne(id, entryId))).data);
};
export const fetchZones = (branchId?: number) => get<string[]>(EP.zones, { branchId });
export const fetchFacilitiesSettings = () => get<FacilitiesSettings>(EP.settings);
export const saveFacilitiesSettings = (s: FacilitiesSettings) => put<FacilitiesSettings>(EP.settings, s);

// ── Triage queue (staff) ────────────────────────────────────────────────
export const fetchStaffReports = (q: { status?: string; branchId?: number; urgent?: boolean; mine?: boolean }) =>
  get<{ items: StaffReportItem[]; total: number }>(EP.admin, { ...q, size: 100 });
export const fetchReportCounts = () => get<ReportCounts>(EP.counts);
export const fetchAssignees = () => get<StaffPick[]>(EP.assignees);
export const fetchStaffReport = (id: number) => get<StaffReportDetail>(EP.adminOne(id));
export const updateReport = (id: number, p: UpdateReportPayload) => put<StaffReportDetail>(EP.adminOne(id), p);
export const staffComment = (id: number, body: string, internal: boolean) => post<StaffReportDetail>(EP.adminComment(id), { body, internal });
export const markReportAssetOutOfService = (id: number, p: { status?: 'OutOfService' | 'Limited'; reason?: string; expectedBackOn?: string | null; postServiceNotice?: boolean }) =>
  post<{ report: StaffReportDetail; asset: SetAssetStatusResult }>(EP.adminOos(id), p);

// ── Incidents (staff, admin.incidents) ──────────────────────────────────
export const fetchIncidents = (q: { status?: string; branchId?: number; type?: string; q?: string }) => get<IncidentPage>(EP.incidents, { ...q, size: 100 });
export const fetchIncident = (id: number) => get<IncidentDetail>(EP.incident(id));
export const fetchIncidentAudit = (id: number) => get<IncidentAuditEntry[]>(EP.incidentAudit(id));
export const createIncident = (p: IncidentPayload) => post<IncidentDetail>(EP.incidents, p);
export const updateIncident = (id: number, p: IncidentPayload) => put<IncidentDetail>(EP.incident(id), p);
export const closeIncident = (id: number, closureNote?: string) => post<IncidentDetail>(EP.incidentClose(id), { closureNote });
export const addAddendum = (id: number, body: string) => post<IncidentDetail>(EP.incidentAddendum(id), { body });
export const searchPeople = (q: string) => get<PersonSearchItem[]>(EP.people, { q });
