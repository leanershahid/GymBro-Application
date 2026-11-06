import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  clearMemberHealth, createWaiver, fetchAdminWaivers, fetchHealthQuestions, fetchMemberHealth, fetchMemberSafety,
  fetchMyConsents, fetchMyEmergencyContact, fetchMyHealth, fetchMySafety, fetchPendingWaivers, fetchSafetySettings,
  fetchSignedCopy, fetchWaiverTemplate, publishWaiverVersion, recordConsent, saveMyEmergencyContact, saveSafetySettings,
  signWaiver, submitHealth, updateWaiver,
} from './safetyApi';
import { ConsentType, EmergencyContactPayload, SafetySettings, SubmitHealthPayload } from './safety.types';

// Feature-local keys; everything lives under the 'safety' root so one invalidation refreshes it all.
const ROOT = ['safety'] as const;
export const safetyKeys = {
  all: ROOT,
  me: [...ROOT, 'me'] as const,
  pending: [...ROOT, 'pending'] as const,
  questions: [...ROOT, 'questions'] as const,
  myHealth: [...ROOT, 'my-health'] as const,
  emergency: [...ROOT, 'emergency'] as const,
  consents: [...ROOT, 'consents'] as const,
  member: (id: number) => [...ROOT, 'member', id] as const,
  memberHealth: (id: number) => [...ROOT, 'member-health', id] as const,
  signature: (id: number) => [...ROOT, 'signature', id] as const,
  waivers: [...ROOT, 'admin-waivers'] as const,
  template: [...ROOT, 'template'] as const,
  settings: [...ROOT, 'settings'] as const,
};

// ── Member ────────────────────────────────────────────────────────────────
export const useMySafety = (enabled = true) =>
  useQuery({ queryKey: safetyKeys.me, queryFn: fetchMySafety, enabled });

export const usePendingWaivers = (enabled = true) =>
  useQuery({ queryKey: safetyKeys.pending, queryFn: fetchPendingWaivers, enabled });

export const useHealthQuestions = (enabled = true) =>
  useQuery({ queryKey: safetyKeys.questions, queryFn: fetchHealthQuestions, staleTime: 60 * 60_000, enabled });

export const useMyHealth = (enabled = true) =>
  useQuery({ queryKey: safetyKeys.myHealth, queryFn: fetchMyHealth, enabled });

export const useMyEmergencyContact = () =>
  useQuery({ queryKey: safetyKeys.emergency, queryFn: fetchMyEmergencyContact });

export const useMyConsents = () =>
  useQuery({ queryKey: safetyKeys.consents, queryFn: fetchMyConsents });

const useInvalidateSafety = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: safetyKeys.all });
};

export const useSignWaiver = () => {
  const invalidate = useInvalidateSafety();
  return useMutation({
    mutationFn: ({ versionId, signedName }: { versionId: number; signedName: string }) => signWaiver(versionId, signedName),
    onSuccess: invalidate,
  });
};

export const useSubmitHealth = () => {
  const invalidate = useInvalidateSafety();
  return useMutation({ mutationFn: (p: SubmitHealthPayload) => submitHealth(p), onSuccess: invalidate });
};

export const useSaveEmergencyContact = () => {
  const invalidate = useInvalidateSafety();
  return useMutation({ mutationFn: (p: EmergencyContactPayload) => saveMyEmergencyContact(p), onSuccess: invalidate });
};

export const useRecordConsent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ type, granted }: { type: ConsentType; granted: boolean }) => recordConsent(type, granted),
    onSuccess: data => {
      qc.setQueryData(safetyKeys.consents, data);
      qc.invalidateQueries({ queryKey: safetyKeys.me });
    },
  });
};

// ── Staff ─────────────────────────────────────────────────────────────────
export const useMemberSafety = (memberId: number) =>
  useQuery({ queryKey: safetyKeys.member(memberId), queryFn: () => fetchMemberSafety(memberId), enabled: memberId > 0 });

export const useMemberHealth = (memberId: number, enabled: boolean) =>
  useQuery({ queryKey: safetyKeys.memberHealth(memberId), queryFn: () => fetchMemberHealth(memberId), enabled: enabled && memberId > 0 });

export const useSignedCopy = (signatureId: number | null) =>
  useQuery({ queryKey: safetyKeys.signature(signatureId ?? 0), queryFn: () => fetchSignedCopy(signatureId!), enabled: !!signatureId });

export const useClearMemberHealth = (memberId: number) => {
  const invalidate = useInvalidateSafety();
  return useMutation({
    mutationFn: ({ screeningId, note }: { screeningId: number; note?: string }) => clearMemberHealth(memberId, screeningId, note),
    onSuccess: invalidate,
  });
};

// ── Admin ─────────────────────────────────────────────────────────────────
export const useAdminWaivers = () => useQuery({ queryKey: safetyKeys.waivers, queryFn: fetchAdminWaivers });
export const useWaiverTemplate = (enabled: boolean) =>
  useQuery({ queryKey: safetyKeys.template, queryFn: fetchWaiverTemplate, enabled, staleTime: Infinity });
export const useSafetySettings = () => useQuery({ queryKey: safetyKeys.settings, queryFn: fetchSafetySettings });

export const useCreateWaiver = () => {
  const invalidate = useInvalidateSafety();
  return useMutation({ mutationFn: ({ title, body }: { title: string; body: string }) => createWaiver(title, body), onSuccess: invalidate });
};

export const usePublishWaiverVersion = () => {
  const invalidate = useInvalidateSafety();
  return useMutation({
    mutationFn: ({ waiverId, body, requiresResign, title }: { waiverId: number; body: string; requiresResign: boolean; title?: string }) =>
      publishWaiverVersion(waiverId, body, requiresResign, title),
    onSuccess: invalidate,
  });
};

export const useUpdateWaiver = () => {
  const invalidate = useInvalidateSafety();
  return useMutation({
    mutationFn: ({ waiverId, ...patch }: { waiverId: number; title?: string; isActive?: boolean }) => updateWaiver(waiverId, patch),
    onSuccess: invalidate,
  });
};

export const useSaveSafetySettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: SafetySettings) => saveSafetySettings(s),
    onSuccess: data => {
      qc.setQueryData(safetyKeys.settings, data);
      qc.invalidateQueries({ queryKey: safetyKeys.all });
    },
  });
};
