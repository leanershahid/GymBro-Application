import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  assignRequest, createRequest, deleteCanned, deleteFaq, DeskMode, fetchCanned, fetchCount, fetchFaqs, fetchFeedbackSummary, fetchHelpCentre,
  fetchMyRequest, fetchMyRequests, fetchPendingFeedback, fetchQueue, fetchRequest, fetchStaffOptions, fetchSupportSettings, rateRequest,
  reopenRequest, replyAsMember, replyAsStaff, resolveAsMember, saveCanned, saveFaq, saveSupportSettings, setPriority, setStatus,
  submitClassFeedback,
} from './supportApi';
import { NewRequestPayload, QueueFilter, ReplyPayload, SupportMessage, SupportPriority, SupportRequestDetail, SupportSettings, SupportStatus } from './support.types';
import { useApiAccess } from '../../access/context/AccessContext';
import { getSession } from '../../../api/session';

// Feature-local keys under one root.
const ROOT = ['support'] as const;
export const supportKeys = {
  all: ROOT,
  help: (search: string) => [...ROOT, 'help', search] as const,
  mine: [...ROOT, 'mine'] as const,
  mineOne: (id: number) => [...ROOT, 'mine', id] as const,
  pendingFeedback: [...ROOT, 'pending-feedback'] as const,
  queueRoot: (mode: DeskMode) => [...ROOT, mode, 'queue'] as const,
  queue: (mode: DeskMode, f: QueueFilter) => [...ROOT, mode, 'queue', JSON.stringify(f)] as const,
  count: (mode: DeskMode) => [...ROOT, mode, 'count'] as const,
  request: (mode: DeskMode, id: number) => [...ROOT, mode, 'request', id] as const,
  staff: [...ROOT, 'staff'] as const,
  faqs: [...ROOT, 'faqs'] as const,
  canned: (mode: DeskMode) => [...ROOT, mode, 'canned'] as const,
  settings: [...ROOT, 'settings'] as const,
  summary: (days: number) => [...ROOT, 'summary', days] as const,
};
const K = supportKeys;

/** A message shown right away while the real one is sent (optimistic reply). */
const optimistic = (p: ReplyPayload, role: 'member' | 'staff'): SupportMessage => ({
  id: -Date.now(), kind: p.internal ? 'note' : 'message', authorRole: role, authorId: getSession()?.userId ?? null,
  authorName: null, isInternal: !!p.internal, mine: true, body: p.body, photos: p.photos ?? [], createdAt: new Date().toISOString(), pending: true,
});

// ── Member ────────────────────────────────────────────────────────────────
export const useHelpCentre = (search = '') =>
  useQuery({ queryKey: K.help(search), queryFn: () => fetchHelpCentre(search || undefined), placeholderData: prev => prev });
export const useMyRequests = () => useQuery({ queryKey: K.mine, queryFn: fetchMyRequests });
export const useMyRequest = (id: number) =>
  useQuery({ queryKey: K.mineOne(id), queryFn: () => fetchMyRequest(id), enabled: id > 0, refetchInterval: 60_000 });

export const useCreateRequest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: NewRequestPayload) => createRequest(p),
    onSuccess: d => { qc.setQueryData(K.mineOne(d.id), d); qc.invalidateQueries({ queryKey: K.mine }); qc.invalidateQueries({ queryKey: [...ROOT, 'help'] }); },
  });
};

/** Shared optimistic-update plumbing for a thread cached under `key`. */
function useThreadMutation<V>(key: readonly unknown[], run: (v: V) => Promise<SupportRequestDetail>, draft?: (v: V) => SupportMessage | null, also?: readonly unknown[][]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: run,
    onMutate: async (v: V) => {
      const msg = draft?.(v);
      if (!msg) return { prev: undefined };
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<SupportRequestDetail>(key);
      if (prev) qc.setQueryData<SupportRequestDetail>(key, { ...prev, messages: [...prev.messages, msg] });
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(key, ctx.prev); },
    onSuccess: d => {
      qc.setQueryData(key, d);
      for (const k of also ?? []) qc.invalidateQueries({ queryKey: k });
    },
  });
}

export const useMemberReply = (id: number) =>
  useThreadMutation(K.mineOne(id), (p: ReplyPayload) => replyAsMember(id, p), p => optimistic(p, 'member'), [[...K.mine]]);
export const useRateRequest = (id: number) =>
  useThreadMutation(K.mineOne(id), (v: { score: number; comment?: string }) => rateRequest(id, v.score, v.comment), undefined, [[...K.mine]]);
export const useReopenRequest = (id: number) =>
  useThreadMutation(K.mineOne(id), (message?: string) => reopenRequest(id, message), undefined, [[...K.mine]]);
export const useMemberResolve = (id: number) =>
  useThreadMutation(K.mineOne(id), () => resolveAsMember(id), undefined, [[...K.mine]]);

export const usePendingClassFeedback = () => useQuery({ queryKey: K.pendingFeedback, queryFn: fetchPendingFeedback, staleTime: 5 * 60_000 });
export const useSubmitClassFeedback = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: submitClassFeedback,
    onSettled: () => qc.invalidateQueries({ queryKey: K.pendingFeedback }),
  });
};

// ── Staff / trainer ───────────────────────────────────────────────────────
export const useQueue = (mode: DeskMode, f: QueueFilter) =>
  useQuery({ queryKey: K.queue(mode, f), queryFn: () => fetchQueue(mode, f), placeholderData: prev => prev, refetchInterval: 120_000 });
export const useSupportCount = (mode: DeskMode, enabled = true) =>
  useQuery({ queryKey: K.count(mode), queryFn: () => fetchCount(mode), enabled, refetchInterval: 120_000 });
export const useDeskRequest = (mode: DeskMode, id: number) =>
  useQuery({ queryKey: K.request(mode, id), queryFn: () => fetchRequest(mode, id), enabled: id > 0, refetchInterval: 60_000 });

const deskRefresh = (mode: DeskMode): readonly unknown[][] => [[...K.queueRoot(mode)], [...K.count(mode)]];

export const useStaffReply = (mode: DeskMode, id: number) =>
  useThreadMutation(K.request(mode, id), (p: ReplyPayload) => replyAsStaff(mode, id, p), p => optimistic(p, 'staff'), deskRefresh(mode));
export const useSetStatus = (mode: DeskMode, id: number) =>
  useThreadMutation(K.request(mode, id), (s: SupportStatus) => setStatus(mode, id, s), undefined, deskRefresh(mode));
export const useAssign = (id: number) =>
  useThreadMutation(K.request('staff', id), (assigneeId: number | null) => assignRequest(id, assigneeId), undefined, deskRefresh('staff'));
export const useSetPriority = (id: number) =>
  useThreadMutation(K.request('staff', id), (p: SupportPriority) => setPriority(id, p), undefined, deskRefresh('staff'));

export const useStaffOptions = (enabled = true) => useQuery({ queryKey: K.staff, queryFn: fetchStaffOptions, enabled, staleTime: 5 * 60_000 });
export const useCanned = (mode: DeskMode) => useQuery({ queryKey: K.canned(mode), queryFn: () => fetchCanned(mode), staleTime: 5 * 60_000 });
export const useFaqs = () => useQuery({ queryKey: K.faqs, queryFn: fetchFaqs });
export const useSupportSettings = () => useQuery({ queryKey: K.settings, queryFn: fetchSupportSettings });
export const useFeedbackSummary = (days = 90) => useQuery({ queryKey: K.summary(days), queryFn: () => fetchFeedbackSummary(days) });

const useInvalidate = (key: readonly unknown[]) => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: key });
};
export const useSaveFaq = () => { const done = useInvalidate(K.faqs); return useMutation({ mutationFn: saveFaq, onSuccess: done }); };
export const useDeleteFaq = () => { const done = useInvalidate(K.faqs); return useMutation({ mutationFn: deleteFaq, onSuccess: done }); };
export const useSaveCanned = () => { const done = useInvalidate([...ROOT]); return useMutation({ mutationFn: saveCanned, onSuccess: done }); };
export const useDeleteCanned = () => { const done = useInvalidate([...ROOT]); return useMutation({ mutationFn: deleteCanned, onSuccess: done }); };
export const useSaveSupportSettings = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (s: SupportSettings) => saveSupportSettings(s), onSuccess: d => { qc.setQueryData(K.settings, d); qc.invalidateQueries({ queryKey: K.all }); } });
};

/** Unassigned + overdue requests for the More / Home badge; 0 (no request) without the support module. */
export function useSupportBadge(): number {
  const access = useApiAccess('support');
  return useSupportCount('staff', access.canView).data?.badge ?? 0;
}
