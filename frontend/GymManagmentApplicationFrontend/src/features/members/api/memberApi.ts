import axiosInstance from '../../../api/axios';
import { ENDPOINTS } from '../../../api/endpoints';
import { ApiResponse, PaginatedData } from '../../../api/types';
import { uploadFile, PickedFile } from '../../../api/upload';
import { currentTenantId } from '../../../api/session';
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

// ─── Memberships / attendance (filtered server-side by member) ──

export const fetchMemberSubscriptions = async (memberId: number): Promise<ScannedList<MemberSubscription>> => {
  const { data } = await axiosInstance.get<ApiResponse<PaginatedData<MemberSubscription>>>(MEMBER_EP.subscriptions, {
    params: { tenantId: currentTenantId() || undefined, memberId, pageNumber: 1, pageSize: MAX_PAGE },
  });
  const page = data.data;
  return { items: page?.items ?? [], scanned: page?.totalRecords ?? 0, total: page?.totalRecords ?? 0 };
};

export const fetchMemberAttendance = async (memberId: number): Promise<ScannedList<MemberAttendanceRecord>> => {
  const { data } = await axiosInstance.get<ApiResponse<PaginatedData<MemberAttendanceRecord>>>(MEMBER_EP.attendance, {
    params: { userId: memberId, pageNumber: 1, pageSize: MAX_PAGE },
  });
  const page = data.data;
  // scanned < total only when the member has more visits than one page shows.
  return { items: page?.items ?? [], scanned: page?.items.length ?? 0, total: page?.totalRecords ?? 0 };
};

// ─── Trainer assignment ──────────────────────────────────────────
// GET /members/{id} carries the member's active trainer id; one active trainer per member.

export const fetchMemberTrainers = async (memberId: number): Promise<AssignedTrainer[]> => {
  const { data: member } = await axiosInstance.get<ApiResponse<{ trainerId?: number | null }>>(`${ENDPOINTS.MEMBERS}/${memberId}`);
  const trainerId = member.data?.trainerId;
  if (!trainerId) return [];
  try {
    const { data } = await axiosInstance.get<ApiResponse<{ id: number; displayName: string }>>(`${ENDPOINTS.TRAINERS}/${trainerId}`);
    return [{ trainerId, displayName: data.data?.displayName ?? `Trainer #${trainerId}`, assignedAt: '' }];
  } catch {
    return [{ trainerId, displayName: `Trainer #${trainerId}`, assignedAt: '' }];
  }
};

export const assignTrainer = async (trainerId: number, clientId: number): Promise<ApiResponse<unknown>> => {
  const { data } = await axiosInstance.post<ApiResponse<unknown>>(MEMBER_EP.trainerAssign(trainerId), { clientId });
  return data;
};

export const unassignTrainer = async (trainerId: number, clientId: number): Promise<ApiResponse<unknown>> => {
  const { data } = await axiosInstance.delete<ApiResponse<unknown>>(MEMBER_EP.trainerUnassign(trainerId, clientId));
  return data;
};
