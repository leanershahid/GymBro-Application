import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../api/queryKeys';
import { unwrap } from '../../../api/http';
import {
  checkInWithFace, deleteMemberFace, enrollMemberFace, enrollMyFace, fetchFaceAttemptPhotos, fetchFaceAttempts,
  fetchMemberFace, fetchMyFace, removeMyFace, resetMemberFace,
} from './faceApi';
import { CapturedSelfie, LocationFix } from '../types/attendance.types';

const K = queryKeys.attendance;

/** Location + selfie check-in; refreshes the member's status and history. */
export const useCheckInWithFace = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fix, selfie }: { fix: LocationFix; selfie: CapturedSelfie }) => checkInWithFace(fix, selfie),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: K.myStatus });
      qc.invalidateQueries({ queryKey: K.myHistoryAll });
    },
  });
};

// ── Member ──────────────────────────────────────────────────────────────
export const useMyFace = (enabled = true) =>
  useQuery({ queryKey: K.faceMine, queryFn: async () => unwrap(await fetchMyFace()), enabled });

export const useEnrollMyFace = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ selfie, consent }: { selfie: CapturedSelfie; consent: boolean }) => unwrap(await enrollMyFace(selfie, consent)),
    onSuccess: data => {
      qc.setQueryData(K.faceMine, data);
      qc.invalidateQueries({ queryKey: K.myStatus });
    },
  });
};

export const useRemoveMyFace = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await removeMyFace()),
    onSuccess: data => {
      qc.setQueryData(K.faceMine, data);
      qc.invalidateQueries({ queryKey: K.myStatus });
    },
  });
};

// ── Staff ───────────────────────────────────────────────────────────────
export const useMemberFace = (memberId: number) =>
  useQuery({ queryKey: K.faceMember(memberId), queryFn: async () => unwrap(await fetchMemberFace(memberId)) });

export const useEnrollMemberFace = (memberId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ selfie, consentConfirmed }: { selfie: CapturedSelfie; consentConfirmed: boolean }) =>
      unwrap(await enrollMemberFace(memberId, selfie, consentConfirmed)),
    onSuccess: data => qc.setQueryData(K.faceMember(memberId), data),
  });
};

export const useResetMemberFace = (memberId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await resetMemberFace(memberId)),
    onSuccess: data => qc.setQueryData(K.faceMember(memberId), data),
  });
};

export const useDeleteMemberFace = (memberId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => { unwrap(await deleteMemberFace(memberId)); },
    onSuccess: () => qc.invalidateQueries({ queryKey: K.faceMember(memberId) }),
  });
};

/** Failed face checks of a day (attendance log). */
export const useFaceAttempts = (date?: string, enabled = true) =>
  useQuery({ queryKey: K.faceAttempts(date), queryFn: async () => unwrap(await fetchFaceAttempts(date)), enabled });

/** Kept selfie + reference photo (signed links expire, so always fetched fresh). */
export const useFaceAttemptPhotos = (attemptId: number | null) =>
  useQuery({
    queryKey: K.facePhotos(attemptId ?? 0),
    queryFn: async () => unwrap(await fetchFaceAttemptPhotos(attemptId!)),
    enabled: attemptId != null,
    staleTime: 0,
    gcTime: 0,
  });
