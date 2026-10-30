import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchMembers, createMember, deleteMember, setMemberStatus,
  fetchMemberById, updateMember, uploadMemberPhoto,
  fetchMemberNotes, addMemberNote, fetchMemberDocuments, uploadMemberDocument,
  fetchMemberSubscriptions, fetchMemberAttendance,
  fetchMemberTrainers, assignTrainer, unassignTrainer,
} from './memberApi';
import { MemberPayload, UpdateMemberPayload } from '../types/member.types';
import { PickedFile } from '../../../api/upload';
import { queryKeys } from '../../../api/queryKeys';

// Every member key lives under queryKeys.members.all, so one invalidation refreshes list + detail.
const mk = {
  detail:        (id: number) => [...queryKeys.members.all, 'detail', id] as const,
  notes:         (id: number) => [...queryKeys.members.all, 'notes', id] as const,
  documents:     (id: number) => [...queryKeys.members.all, 'documents', id] as const,
  subscriptions: (id: number) => [...queryKeys.members.all, 'subscriptions', id] as const,
  attendance:    (id: number) => [...queryKeys.members.all, 'attendance', id] as const,
  trainers:      (id: number) => [...queryKeys.members.all, 'trainers', id] as const,
};

export const useMembers = (query = '', pageNumber = 1, pageSize = 20) =>
  useQuery({
    queryKey: [...queryKeys.members.all, query, pageNumber, pageSize],
    queryFn:  () => fetchMembers(query, pageNumber, pageSize),
    select:   (res) => res.data,
  });

export const useCreateMember = () =>
  useMutation({ mutationFn: (payload: MemberPayload) => createMember(payload) });

export const useDeleteMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteMember(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.members.all }),
  });
};

export const useSetMemberStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => setMemberStatus(id, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.members.all }),
  });
};

// ─── Detail / edit ───────────────────────────────────────────────

export const useMember = (id: number) =>
  useQuery({
    queryKey: mk.detail(id),
    queryFn:  () => fetchMemberById(id),
    select:   (res) => res.data,
    enabled:  id > 0,
  });

export const useUpdateMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateMemberPayload }) => updateMember(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.members.all }),
  });
};

export const useUploadMemberPhoto = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: PickedFile }) => uploadMemberPhoto(id, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.members.all }),
  });
};

// ─── Notes & documents ───────────────────────────────────────────

export const useMemberNotes = (id: number, enabled = true) =>
  useQuery({
    queryKey: mk.notes(id),
    queryFn:  () => fetchMemberNotes(id),
    select:   (res) => res.data ?? [],
    enabled:  enabled && id > 0,
  });

export const useAddMemberNote = (id: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note: string) => addMemberNote(id, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: mk.notes(id) }),
  });
};

export const useMemberDocuments = (id: number, enabled = true) =>
  useQuery({
    queryKey: mk.documents(id),
    queryFn:  () => fetchMemberDocuments(id),
    select:   (res) => res.data ?? [],
    enabled:  enabled && id > 0,
  });

export const useUploadMemberDocument = (id: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, documentType }: { file: PickedFile; documentType?: string }) =>
      uploadMemberDocument(id, file, documentType),
    onSuccess: () => qc.invalidateQueries({ queryKey: mk.documents(id) }),
  });
};

// ─── Memberships / attendance ────────────────────────────────────

export const useMemberSubscriptions = (id: number, enabled = true) =>
  useQuery({
    queryKey: mk.subscriptions(id),
    queryFn:  () => fetchMemberSubscriptions(id),
    enabled:  enabled && id > 0,
  });

export const useMemberAttendance = (id: number, enabled = true) =>
  useQuery({
    queryKey: mk.attendance(id),
    queryFn:  () => fetchMemberAttendance(id),
    enabled:  enabled && id > 0,
  });

// ─── Trainer assignment ──────────────────────────────────────────

export const useMemberTrainers = (id: number, enabled = true) =>
  useQuery({
    queryKey: mk.trainers(id),
    queryFn:  () => fetchMemberTrainers(id),
    enabled:  enabled && id > 0,
  });

/** Assign `trainerId`, then end the `replace` assignments (so "change trainer" never leaves the member without one). */
export const useAssignTrainer = () => {
  const qc = useQueryClient();
  return useMutation({
    // The API keeps one active trainer per member, so assigning replaces the previous one.
    mutationFn: ({ memberId, trainerId }: { memberId: number; trainerId: number; replace?: number[] }) =>
      assignTrainer(trainerId, memberId),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.all });
      qc.invalidateQueries({ queryKey: queryKeys.trainers.all });
    },
  });
};

export const useUnassignTrainer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, trainerId }: { memberId: number; trainerId: number }) => unassignTrainer(trainerId, memberId),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.all });
      qc.invalidateQueries({ queryKey: queryKeys.trainers.all });
    },
  });
};
