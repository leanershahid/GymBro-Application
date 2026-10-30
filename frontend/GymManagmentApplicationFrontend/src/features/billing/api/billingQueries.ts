import { useQuery, useMutation, useQueryClient, keepPreviousData, QueryClient } from '@tanstack/react-query';
import {
  fetchPlans, createPlan, updatePlan, updatePlanFeatures, archivePlan,
  fetchSubscriptions, createSubscription, renewSubscription, freezeSubscription, unfreezeSubscription,
  cancelSubscription, upgradeSubscription, fetchSubscriptionUsage,
  fetchInvoices, fetchInvoice, createInvoice, sendInvoice, markInvoicePaid,
  chargePayment, fetchPaymentHistory, refundPayment, sendPaymentReminder,
  fetchGateway, saveGateway, removeGateway,
} from './billingApi';
import {
  CreatePlanPayload, UpdatePlanPayload, CreateSubscriptionPayload, ChargeOptions,
  CreateInvoicePayload, InvoiceFilter, ChargePayload, RefundPayload, SaveGatewayPayload, PayMethod,
} from '../types/billing.types';

// Feature-local keys. Money moves between invoices, payments and memberships, so mutations
// that touch any of them refresh the whole `money` subtree.
export const billingKeys = {
  all:           ['billing'] as const,
  plans:         ['billing', 'plans'] as const,
  money:         ['billing', 'money'] as const,
  invoices:      (filter: InvoiceFilter, page: number, size: number, memberId?: number) =>
                   ['billing', 'money', 'invoices', filter, page, size, memberId ?? null] as const,
  invoice:       (id: number) => ['billing', 'money', 'invoice', id] as const,
  subscriptions: (memberId: number | undefined, page: number, size: number) =>
                   ['billing', 'money', 'subscriptions', memberId ?? null, page, size] as const,
  usage:         (id: number) => ['billing', 'money', 'usage', id] as const,
  payments:      (memberId: number | undefined, page: number, size: number) =>
                   ['billing', 'money', 'payments', memberId ?? null, page, size] as const,
  gateway:       ['billing', 'gateway'] as const,
};

const refreshMoney = (qc: QueryClient) => {
  qc.invalidateQueries({ queryKey: billingKeys.money });
  // The member detail page caches its own copy of a member's memberships.
  qc.invalidateQueries({ queryKey: ['members', 'subscriptions'] });
};

// ─── Plans ───────────────────────────────────────────────────────

export const usePlans = () => useQuery({ queryKey: billingKeys.plans, queryFn: fetchPlans });

export const useCreatePlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Omit<CreatePlanPayload, 'tenantId'>) => createPlan(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.plans }),
  });
};

/** Updates the plan fields, then its feature list (a separate endpoint). */
export const useUpdatePlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch, features }: { id: number; patch: UpdatePlanPayload; features?: string[] }) => {
      const plan = await updatePlan(id, patch);
      if (features) await updatePlanFeatures(id, features);
      return plan;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.plans }),
  });
};

export const useArchivePlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => archivePlan(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.plans }),
  });
};

// ─── Subscriptions ───────────────────────────────────────────────

export const useSubscriptions = (memberId?: number, page = 1, size = 20) =>
  useQuery({
    queryKey: billingKeys.subscriptions(memberId, page, size),
    queryFn: () => fetchSubscriptions(memberId, page, size),
    placeholderData: keepPreviousData,
  });

export const useSubscriptionUsage = (id: number | null) =>
  useQuery({
    queryKey: billingKeys.usage(id ?? 0),
    queryFn: () => fetchSubscriptionUsage(id as number),
    enabled: !!id,
  });

export const useCreateSubscription = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Omit<CreateSubscriptionPayload, 'tenantId'>) => createSubscription(p),
    onSuccess: () => refreshMoney(qc),
  });
};

export const useRenewSubscription = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, options }: { id: number; options: ChargeOptions }) => renewSubscription(id, options),
    onSuccess: () => refreshMoney(qc),
  });
};

export const useFreezeSubscription = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => freezeSubscription(id, reason),
    onSuccess: () => refreshMoney(qc),
  });
};

export const useUnfreezeSubscription = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => unfreezeSubscription(id),
    onSuccess: () => refreshMoney(qc),
  });
};

export const useCancelSubscription = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => cancelSubscription(id),
    onSuccess: () => refreshMoney(qc),
  });
};

export const useUpgradeSubscription = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, newPlanId }: { id: number; newPlanId: number }) => upgradeSubscription(id, newPlanId),
    onSuccess: () => refreshMoney(qc),
  });
};

// ─── Invoices ────────────────────────────────────────────────────

export const useInvoices = (filter: InvoiceFilter = 'all', page = 1, size = 20, memberId?: number) =>
  useQuery({
    queryKey: billingKeys.invoices(filter, page, size, memberId),
    queryFn: () => fetchInvoices(filter, page, size, memberId),
    placeholderData: keepPreviousData,
  });

export const useInvoice = (id: number | null) =>
  useQuery({
    queryKey: billingKeys.invoice(id ?? 0),
    queryFn: () => fetchInvoice(id as number),
    enabled: !!id,
  });

export const useCreateInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Omit<CreateInvoicePayload, 'tenantId'>) => createInvoice(p),
    onSuccess: () => refreshMoney(qc),
  });
};

export const useSendInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, message }: { id: number; message?: string }) => sendInvoice(id, message),
    // Sending moves a draft to "Sent".
    onSuccess: () => refreshMoney(qc),
  });
};

export const useMarkInvoicePaid = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, method, reference }: { id: number; method: PayMethod; reference?: string }) =>
      markInvoicePaid(id, method, reference),
    onSuccess: () => refreshMoney(qc),
  });
};

// ─── Payments ────────────────────────────────────────────────────

export const usePaymentHistory = (memberId?: number, page = 1, size = 20) =>
  useQuery({
    queryKey: billingKeys.payments(memberId, page, size),
    queryFn: () => fetchPaymentHistory(memberId, page, size),
    placeholderData: keepPreviousData,
  });

export const useChargePayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Omit<ChargePayload, 'tenantId'>) => chargePayment(p),
    onSuccess: () => refreshMoney(qc),
  });
};

export const useRefundPayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: RefundPayload) => refundPayment(p),
    onSuccess: () => refreshMoney(qc),
  });
};

export const useSendPaymentReminder = () =>
  useMutation({
    mutationFn: ({ memberId, message }: { memberId: number; message?: string }) => sendPaymentReminder(memberId, message),
  });

// ─── Online payments ─────────────────────────────────────────────

export const useGateway = () => useQuery({ queryKey: billingKeys.gateway, queryFn: fetchGateway });

export const useSaveGateway = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: SaveGatewayPayload) => saveGateway(p),
    onSuccess: (data) => qc.setQueryData(billingKeys.gateway, data),
  });
};

export const useRemoveGateway = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => removeGateway(),
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.gateway }),
  });
};
