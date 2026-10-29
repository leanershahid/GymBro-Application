import axiosInstance from '../../../api/axios';
import { ENDPOINTS } from '../../../api/endpoints';
import { ApiResponse, PaginatedData } from '../../../api/types';
import { uploadFile, PickedFile } from '../../../api/upload';
import { currentTenantId } from '../../../api/session';
import { fetchTrainers } from '../../trainers/api/trainerApi';
import {
  MemberPayload, MemberCreateResponse, MemberListResponse, MemberDetail, UpdateMemberPayload,
  MemberNote, MemberDocument, MemberSubscription, MemberAttendanceRecord, AssignedTrainer, ScannedList,
} from '../types/member.types';

// Feature-local paths (kept out of the shared endpoints file).
const MEMBER_EP = {
  detail:    (id: number) => `${ENDPOINTS.MEMBERS}/${id}`,
  notes:     (id: number) => `${ENDPOINTS.MEMBERS}/${id}/notes`,
  documents: (id: number) => `${ENDPOINTS.MEMBERS}/${id}/documents`,
  photo:     (id: number) => `${ENDPOINTS.MEMBERS}/${id}/photo`,
  subscriptions: '/subscriptions',
  attendance:    '/attendance',
  trainerClients: (trainerId: number) => `${ENDPOINTS.TRAINERS}/${trainerId}/clients`,
  trainerAssign:  (trainerId: number) => `${ENDPOINTS.TRAINERS}/${trainerId}/assign`,
  trainerUnassign: (trainerId: number, clientId: number) => `${ENDPOINTS.TRAINERS}/${trainerId}/clients/${clientId}`,
};

/** Largest page the API serves (Paging.MaxSize). */
const MAX_PAGE = 100;

export const fetchMembers = async (
  query = '', pageNumber = 1, pageSize = 20,
): Promise<MemberListResponse> => {
  const { data } = await axiosInstance.get<MemberListResponse>(ENDPOINTS.MEMBERS, {
    params: { query: query || undefined, pageNumber, pageSize },
  });
  return data;
};

export const createMember = async (payload: MemberPayload): Promise<MemberCreateResponse> => {
  const { data } = await axiosInstance.post<MemberCreateResponse>(ENDPOINTS.ADD_MEMBER, payload);
  return data;
};

export const deleteMember = async (id: number): Promise<{ success: boolean; message: string }> => {
  const { data } = await axiosInstance.delete(`${ENDPOINTS.MEMBERS}/${id}`);
  return data;
};

export const setMemberStatus = async (
  id: number, isActive: boolean,
): Promise<{ success: boolean; message: string }> => {
  const { data } = await axiosInstance.patch(`${ENDPOINTS.MEMBERS}/${id}/status`, { isActive });
  return data;
};

// ─── Detail / edit ───────────────────────────────────────────────

export const fetchMemberById = async (id: number): Promise<ApiResponse<MemberDetail>> => {
  const { data } = await axiosInstance.get<ApiResponse<MemberDetail>>(MEMBER_EP.detail(id));
  return data;
};

export const updateMember = async (id: number, payload: UpdateMemberPayload): Promise<ApiResponse<MemberDetail>> => {
  const { data } = await axiosInstance.put<ApiResponse<MemberDetail>>(MEMBER_EP.detail(id), payload);
  return data;
};

export const uploadMemberPhoto = (id: number, file: PickedFile) =>
  uploadFile<{ url: string }>(MEMBER_EP.photo(id), 'photo', file);

// ─── Notes & documents ───────────────────────────────────────────

export const fetchMemberNotes = async (id: number): Promise<ApiResponse<MemberNote[]>> => {
  const { data } = await axiosInstance.get<ApiResponse<MemberNote[]>>(MEMBER_EP.notes(id));
  return data;
};

export const addMemberNote = async (id: number, note: string): Promise<ApiResponse<MemberNote>> => {
  const { data } = await axiosInstance.post<ApiResponse<MemberNote>>(MEMBER_EP.notes(id), { note });
  return data;
};

export const fetchMemberDocuments = async (id: number): Promise<ApiResponse<MemberDocument[]>> => {
  const { data } = await axiosInstance.get<ApiResponse<MemberDocument[]>>(MEMBER_EP.documents(id));
  return data;
};

export const uploadMemberDocument = (id: number, file: PickedFile, documentType?: string) =>
  uploadFile<MemberDocument>(
    documentType ? `${MEMBER_EP.documents(id)}?documentType=${encodeURIComponent(documentType)}` : MEMBER_EP.documents(id),
    'file',
    file,
  );

// ─── Memberships / attendance (no per-member filter on the API) ──
// GET /subscriptions and GET /attendance only filter by tenant (and date/branch), so we read
// the newest page (100 records) and keep this member's rows. Older history may be missing.

export const fetchMemberSubscriptions = async (memberId: number): Promise<ScannedList<MemberSubscription>> => {
  const { data } = await axiosInstance.get<ApiResponse<PaginatedData<MemberSubscription>>>(MEMBER_EP.subscriptions, {
    params: { tenantId: currentTenantId() || undefined, pageNumber: 1, pageSize: MAX_PAGE },
  });
  const page = data.data;
  return {
    items:   (page?.items ?? []).filter(s => s.memberId === memberId),
    scanned: page?.items.length ?? 0,
    total:   page?.totalRecords ?? 0,
  };
};

export const fetchMemberAttendance = async (memberId: number): Promise<ScannedList<MemberAttendanceRecord>> => {
  const { data } = await axiosInstance.get<ApiResponse<PaginatedData<MemberAttendanceRecord>>>(MEMBER_EP.attendance, {
    params: { pageNumber: 1, pageSize: MAX_PAGE },
  });
  const page = data.data;
  return {
    items:   (page?.items ?? []).filter(a => a.userId === memberId),
    scanned: page?.items.length ?? 0,
    total:   page?.totalRecords ?? 0,
  };
};

// ─── Trainer assignment ──────────────────────────────────────────
// The member payload doesn't say who their trainer is, so check each trainer's active clients.
// Trainers the caller may not inspect (403) are skipped.

export const fetchMemberTrainers = async (memberId: number): Promise<AssignedTrainer[]> => {
  const trainers = (await fetchTrainers(1, MAX_PAGE)).data?.items ?? [];
  const results = await Promise.allSettled(trainers.map(async t => {
    const { data } = await axiosInstance.get<ApiResponse<{ clientId: number; assignedAt: string }[]>>(
      MEMBER_EP.trainerClients(t.id),
    );
    const hit = (data.data ?? []).find(c => c.clientId === memberId);
    return hit ? { trainerId: t.id, displayName: t.displayName, assignedAt: hit.assignedAt } : null;
  }));
  return results
    .flatMap(r => (r.status === 'fulfilled' && r.value ? [r.value] : []))
    .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));
};

export const assignTrainer = async (trainerId: number, clientId: number): Promise<ApiResponse<unknown>> => {
  const { data } = await axiosInstance.post<ApiResponse<unknown>>(MEMBER_EP.trainerAssign(trainerId), { clientId });
  return data;
};

export const unassignTrainer = async (trainerId: number, clientId: number): Promise<ApiResponse<unknown>> => {
  const { data } = await axiosInstance.delete<ApiResponse<unknown>>(MEMBER_EP.trainerUnassign(trainerId, clientId));
  return data;
};
