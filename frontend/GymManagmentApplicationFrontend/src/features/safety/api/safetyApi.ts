import axiosInstance from '../../../api/axios';
import { ApiResponse } from '../../../api/types';
import { unwrap } from '../../../api/http';
import {
  AdminWaiver, Consents, ConsentType, EmergencyContact, EmergencyContactPayload, HealthQuestionnaire,
  HealthScreening, MemberSafety, SafetyCompliance, SafetySettings, SubmitHealthPayload, WaiverSignature,
  WaiverTemplate, WaiverToSign,
} from './safety.types';

// Raw calls for /api/safety and /api/consents. Each returns the envelope's `data` or throws ApiError.

const BASE = '/safety';
const EP = {
  me:            `${BASE}/me`,
  pending:       `${BASE}/me/waivers/pending`,
  sign:          (versionId: number) => `${BASE}/me/waivers/${versionId}/sign`,
  mySignatures:  `${BASE}/me/signatures`,
  questions:     `${BASE}/me/health/questions`,
  myHealth:      `${BASE}/me/health`,
  emergency:     `${BASE}/me/emergency-contact`,
  member:        (id: number) => `${BASE}/members/${id}`,
  memberHealth:  (id: number) => `${BASE}/members/${id}/health`,
  clear:         (id: number, screeningId: number) => `${BASE}/members/${id}/health/${screeningId}/clear`,
  signature:     (id: number) => `${BASE}/signatures/${id}`,
  waivers:       `${BASE}/admin/waivers`,
  template:      `${BASE}/admin/waivers/template`,
  versions:      (waiverId: number) => `${BASE}/admin/waivers/${waiverId}/versions`,
  waiver:        (waiverId: number) => `${BASE}/admin/waivers/${waiverId}`,
  settings:      `${BASE}/admin/settings`,
  consents:      '/consents/me',
};

const get = async <T,>(url: string): Promise<T> => unwrap((await axiosInstance.get<ApiResponse<T>>(url)).data) as T;
const post = async <T,>(url: string, body?: unknown): Promise<T> => unwrap((await axiosInstance.post<ApiResponse<T>>(url, body ?? {})).data) as T;
const put = async <T,>(url: string, body: unknown): Promise<T> => unwrap((await axiosInstance.put<ApiResponse<T>>(url, body)).data) as T;

// ── Member ────────────────────────────────────────────────────────────────
export const fetchMySafety = () => get<SafetyCompliance>(EP.me);
export const fetchPendingWaivers = () => get<WaiverToSign[]>(EP.pending);
export const signWaiver = (versionId: number, signedName: string) =>
  post<WaiverSignature>(EP.sign(versionId), { signedName, agreed: true });
export const fetchMySignatures = () => get<WaiverSignature[]>(EP.mySignatures);
export const fetchHealthQuestions = () => get<HealthQuestionnaire>(EP.questions);
export const fetchMyHealth = () => get<HealthScreening | null>(EP.myHealth);
export const submitHealth = (payload: SubmitHealthPayload) => post<HealthScreening>(EP.myHealth, payload);
export const fetchMyEmergencyContact = () => get<EmergencyContact | null>(EP.emergency);
export const saveMyEmergencyContact = (payload: EmergencyContactPayload) => put<EmergencyContact>(EP.emergency, payload);
export const fetchMyConsents = () => get<Consents>(EP.consents);
export const recordConsent = (type: ConsentType, granted: boolean, version?: string) =>
  post<Consents>(EP.consents, { type, granted, version, source: 'app' });

// ── Staff ─────────────────────────────────────────────────────────────────
export const fetchMemberSafety = (memberId: number) => get<MemberSafety>(EP.member(memberId));
export const fetchMemberHealth = (memberId: number) => get<HealthScreening[]>(EP.memberHealth(memberId));
export const clearMemberHealth = (memberId: number, screeningId: number, note?: string) =>
  post<HealthScreening>(EP.clear(memberId, screeningId), { note });
export const fetchSignedCopy = (signatureId: number) => get<WaiverSignature>(EP.signature(signatureId));

// ── Admin: waivers & settings ─────────────────────────────────────────────
export const fetchAdminWaivers = () => get<AdminWaiver[]>(EP.waivers);
export const fetchWaiverTemplate = () => get<WaiverTemplate>(EP.template);
export const createWaiver = (title: string, body: string) => post<AdminWaiver>(EP.waivers, { title, body });
export const publishWaiverVersion = (waiverId: number, body: string, requiresResign: boolean, title?: string) =>
  post<AdminWaiver>(EP.versions(waiverId), { title, body, requiresResign });
export const updateWaiver = (waiverId: number, patch: { title?: string; isActive?: boolean }) => put<AdminWaiver>(EP.waiver(waiverId), patch);
export const fetchSafetySettings = () => get<SafetySettings>(EP.settings);
export const saveSafetySettings = (s: SafetySettings) => put<SafetySettings>(EP.settings, s);
