import axiosInstance from '../../../api/axios';
import { ApiResponse } from '../../../api/types';
import { unwrap } from '../../../api/http';
import {
  AdminPrivacyRequests, DataExport, DeletionRequest, ExportLink, PrivacyOverview, PrivacySettings,
  RequestDeletionPayload, StaffDeletionPayload,
} from './privacy.types';

// Raw calls for the privacy centre (member) and privacy requests (admin). Each returns `data` or throws.

const EP = {
  overview:      '/me/privacy',
  deletion:      '/me/deletion-request',
  deletionCode:  '/me/deletion-request/code',
  keep:          '/me/deletion-request/cancel',
  exportNew:     '/me/data-export',
  exports:       '/me/data-exports',
  exportLink:    (id: number) => `/me/data-exports/${id}/link`,
  adminRequests: '/privacy/admin/requests',
  process:       (id: number) => `/privacy/admin/deletions/${id}/process`,
  cancel:        (id: number) => `/privacy/admin/deletions/${id}/cancel`,
  memberDelete:  (memberId: number) => `/privacy/admin/members/${memberId}/deletion`,
  settings:      '/privacy/admin/settings',
};

const get = async <T,>(url: string, params?: Record<string, unknown>): Promise<T> =>
  unwrap((await axiosInstance.get<ApiResponse<T>>(url, { params })).data) as T;
const post = async <T,>(url: string, body?: unknown): Promise<T> =>
  unwrap((await axiosInstance.post<ApiResponse<T>>(url, body ?? {})).data) as T;
const put = async <T,>(url: string, body: unknown): Promise<T> =>
  unwrap((await axiosInstance.put<ApiResponse<T>>(url, body)).data) as T;

// ── Member ────────────────────────────────────────────────────────────────
export const fetchPrivacyOverview = () => get<PrivacyOverview>(EP.overview);
export const fetchMyDeletion = () => get<DeletionRequest | null>(EP.deletion);
export const sendDeletionCode = () => post<null>(EP.deletionCode);
export const requestDeletion = (payload: RequestDeletionPayload) => post<DeletionRequest>(EP.deletion, payload);
export const keepMyAccount = () => post<DeletionRequest | null>(EP.keep);
export const requestDataExport = () => post<DataExport>(EP.exportNew);
export const fetchMyExports = () => get<DataExport[]>(EP.exports);
export const fetchExportLink = (id: number) => get<ExportLink>(EP.exportLink(id));

// ── Admin ─────────────────────────────────────────────────────────────────
export const fetchPrivacyRequests = (status?: string) =>
  get<AdminPrivacyRequests>(EP.adminRequests, status ? { status } : undefined);
export const processDeletionNow = (id: number) => post<unknown>(EP.process(id));
export const cancelDeletion = (id: number) => post<null>(EP.cancel(id));
export const deleteMemberAccount = (memberId: number, payload: StaffDeletionPayload) =>
  post<DeletionRequest>(EP.memberDelete(memberId), payload);
export const fetchPrivacySettings = () => get<PrivacySettings>(EP.settings);
export const savePrivacySettings = (s: PrivacySettings) => put<PrivacySettings>(EP.settings, s);
