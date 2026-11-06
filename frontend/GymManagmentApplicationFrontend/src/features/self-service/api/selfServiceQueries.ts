import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveRequest, checkoutMembership, createRequest, fetchJoinQuote, fetchMembershipRules, fetchMyMembership, fetchMyRequest, fetchMyRequests,
  fetchPendingCount, fetchPlanCatalog, fetchRequest, fetchRequestQueue, previewRequest, QueueFilter, rejectRequest,
  saveMembershipRules, withdrawRequest,
} from './selfServiceApi';
import { CheckoutPayload, JoinQuotePayload, MembershipRulesSettings, RequestPayload } from './selfService.types';
import { memberBillingKeys } from '../../member-billing/api/memberBillingQueries';
import { useApiAccess } from '../../access/context/AccessContext';

// Feature-local keys under one root, so one invalidation refreshes everything self-service.
const ROOT = ['self-service'] as const;
export const selfServiceKeys = {
  all: ROOT,
  catalog: [...ROOT, 'catalog'] as const,
  quote: (p: JoinQuotePayload) => [...ROOT, 'quote', p.planId, p.startDate ?? '', p.couponCode ?? ''] as const,
  membership: [...ROOT, 'membership'] as const,
  myRequests: [...ROOT, 'my-requests'] as const,
  myRequest: (id: number) => [...ROOT, 'my-request', id] as const,
  preview: (p: RequestPayload) => [...ROOT, 'preview', p.type, p.from ?? '', p.to ?? '', p.newPlanId ?? 0] as const,
  queue: (f: QueueFilter) => [...ROOT, 'queue', f.status, f.type ?? '', f.memberId ?? 0, f.page ?? 1] as const,
  queueRoot: [...ROOT, 'queue'] as const,
  count: [...ROOT, 'pending-count'] as const,
  request: (id: number) => [...ROOT, 'request', id] as const,
  rules: [...ROOT, 'rules'] as const,
};
const K = selfServiceKeys;

// ── Member ────────────────────────────────────────────────────────────────
export const usePlanCatalog = () => useQuery({ queryKey: K.catalog, queryFn: fetchPlanCatalog });

/** Server quote; refetches whenever plan / start date / coupon change. */
export const useJoinQuote = (p: JoinQuotePayload | null) =>
  useQuery({
    queryKey: p ? K.quote(p) : [...ROOT, 'quote', 'none'],
    queryFn: () => fetchJoinQuote(p!),
    enabled: !!p && p.planId > 0,
    staleTime: 30_000,
  });

export const useMyMembership = (enabled = true) => useQuery({ queryKey: K.membership, queryFn: fetchMyMembership, enabled });
export const useMyRequests = () => useQuery({ queryKey: K.myRequests, queryFn: fetchMyRequests });
export const useMyRequest = (id: number) => useQuery({ queryKey: K.myRequest(id), queryFn: () => fetchMyRequest(id), enabled: id > 0 });

/** What a request would do (debounce-free: callers pass a complete payload or null). */
export const useRequestPreview = (p: RequestPayload | null) =>
  useQuery({ queryKey: p ? K.preview(p) : [...ROOT, 'preview', 'none'], queryFn: () => previewRequest(p!), enabled: !!p, staleTime: 15_000 });

/** Refreshes self-service and the member's billing lists (memberships / invoices) together. */
const useRefreshAll = (userId?: number) => {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: K.all });
    if (userId) qc.invalidateQueries({ queryKey: memberBillingKeys.all(userId) });
  };
};

export const useCheckout = (userId: number) => {
  const refresh = useRefreshAll(userId);
  return useMutation({ mutationFn: (p: CheckoutPayload) => checkoutMembership(p), onSettled: refresh });
};

export const useCreateRequest = (userId: number) => {
  const refresh = useRefreshAll(userId);
  return useMutation({ mutationFn: (p: RequestPayload) => createRequest(p), onSuccess: refresh });
};

export const useWithdrawRequest = (userId: number) => {
  const refresh = useRefreshAll(userId);
  return useMutation({ mutationFn: (id: number) => withdrawRequest(id), onSuccess: refresh });
};

// ── Staff ─────────────────────────────────────────────────────────────────
export const useRequestQueue = (f: QueueFilter) => useQuery({ queryKey: K.queue(f), queryFn: () => fetchRequestQueue(f) });

/** Badge count for "Membership requests" (refreshes every 2 minutes while mounted). */
export const usePendingRequestCount = (enabled = true) =>
  useQuery({ queryKey: K.count, queryFn: fetchPendingCount, select: r => r.pending, enabled, refetchInterval: 120_000 });

export const useRequestDetail = (id: number) => useQuery({ queryKey: K.request(id), queryFn: () => fetchRequest(id), enabled: id > 0 });

export const useDecideRequest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approve, note }: { id: number; approve: boolean; note?: string }) =>
      approve ? approveRequest(id, note) : rejectRequest(id, note ?? ''),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.all }),
  });
};

export const useMembershipRules = () => useQuery({ queryKey: K.rules, queryFn: fetchMembershipRules });
export const useSaveMembershipRules = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: MembershipRulesSettings) => saveMembershipRules(s),
    onSuccess: data => { qc.setQueryData(K.rules, data); qc.invalidateQueries({ queryKey: K.catalog }); },
  });
};

/** Pending-request count for badges, 0 when the user isn't granted the queue (no request is made then). */
export function useMembershipRequestBadge(): number {
  const access = useApiAccess('membership-requests');
  return usePendingRequestCount(access.canView).data ?? 0;
}
