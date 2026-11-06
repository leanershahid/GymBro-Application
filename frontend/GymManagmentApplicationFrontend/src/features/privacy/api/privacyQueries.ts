import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelDeletion, deleteMemberAccount, fetchExportLink, fetchMyDeletion, fetchPrivacyOverview, fetchPrivacyRequests,
  fetchPrivacySettings, keepMyAccount, processDeletionNow, requestDataExport, requestDeletion, savePrivacySettings,
  sendDeletionCode,
} from './privacyApi';
import { PrivacySettings, RequestDeletionPayload, StaffDeletionPayload } from './privacy.types';

// Feature-local keys under one 'privacy' root.
const ROOT = ['privacy'] as const;
export const privacyKeys = {
  all: ROOT,
  overview: [...ROOT, 'overview'] as const,
  myDeletion: [...ROOT, 'my-deletion'] as const,
  adminRequests: [...ROOT, 'admin-requests'] as const,
  requests: (status?: string) => [...ROOT, 'admin-requests', status ?? 'all'] as const,
  settings: [...ROOT, 'settings'] as const,
};

// ── Member ────────────────────────────────────────────────────────────────
export const usePrivacyOverview = () =>
  useQuery({
    queryKey: privacyKeys.overview,
    queryFn: fetchPrivacyOverview,
    // While an export is being prepared, look again every 15 s.
    refetchInterval: q => (q.state.data?.exports.some(e => e.status === 'preparing' || e.status === 'queued') ? 15_000 : false),
  });

/** The open deletion request, for the app-wide "Keep my account" banner. */
export const useMyDeletion = (enabled = true) =>
  useQuery({ queryKey: privacyKeys.myDeletion, queryFn: fetchMyDeletion, enabled, staleTime: 5 * 60_000 });

export const useSendDeletionCode = () => useMutation({ mutationFn: sendDeletionCode });

/** No cache refresh on success: every session is revoked, so the app signs out next. */
export const useRequestDeletion = () =>
  useMutation({ mutationFn: (p: RequestDeletionPayload) => requestDeletion(p) });

export const useKeepMyAccount = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: keepMyAccount,
    onSuccess: () => {
      qc.setQueryData(privacyKeys.myDeletion, null);
      qc.invalidateQueries({ queryKey: privacyKeys.overview });
    },
  });
};

export const useRequestDataExport = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: requestDataExport, onSettled: () => qc.invalidateQueries({ queryKey: privacyKeys.overview }) });
};

export const useExportLink = () => useMutation({ mutationFn: (id: number) => fetchExportLink(id) });

// ── Admin ─────────────────────────────────────────────────────────────────
export const usePrivacyRequests = (status?: string) =>
  useQuery({ queryKey: privacyKeys.requests(status), queryFn: () => fetchPrivacyRequests(status) });

function useAdminMutation<A>(fn: (a: A) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSettled: () => qc.invalidateQueries({ queryKey: privacyKeys.adminRequests }) });
}

export const useProcessDeletionNow = () => useAdminMutation((id: number) => processDeletionNow(id));
export const useCancelDeletion = () => useAdminMutation((id: number) => cancelDeletion(id));
export const useDeleteMemberAccount = () =>
  useAdminMutation(({ memberId, ...p }: StaffDeletionPayload & { memberId: number }) => deleteMemberAccount(memberId, p));

export const usePrivacySettings = () => useQuery({ queryKey: privacyKeys.settings, queryFn: fetchPrivacySettings });
export const useSavePrivacySettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: PrivacySettings) => savePrivacySettings(s),
    onSuccess: d => qc.setQueryData(privacyKeys.settings, d),
  });
};
