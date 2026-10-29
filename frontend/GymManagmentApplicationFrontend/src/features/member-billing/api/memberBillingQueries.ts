import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchMyMemberships, fetchMyInvoices, fetchMyPayments, fetchOnlinePayments,
  startInvoicePayment, verifyInvoicePayment,
} from './memberBillingApi';
import { VerifyPaymentPayload } from '../types/memberBilling.types';

// Local keys (scoped by user so a sign-out/sign-in never shows the previous member's bills).
export const memberBillingKeys = {
  all: (userId: number) => ['member-billing', userId] as const,
  memberships: (userId: number) => ['member-billing', userId, 'memberships'] as const,
  invoices: (userId: number) => ['member-billing', userId, 'invoices'] as const,
  payments: (userId: number) => ['member-billing', userId, 'payments'] as const,
  online: (userId: number) => ['member-billing', userId, 'online-payments'] as const,
};

const K = memberBillingKeys;

export const useMyMemberships = (userId: number) =>
  useQuery({ queryKey: K.memberships(userId), queryFn: fetchMyMemberships, enabled: userId > 0 });

export const useMyInvoices = (userId: number) =>
  useQuery({ queryKey: K.invoices(userId), queryFn: fetchMyInvoices, enabled: userId > 0 });

export const useMyPayments = (userId: number) =>
  useQuery({ queryKey: K.payments(userId), queryFn: fetchMyPayments, enabled: userId > 0 });

export const useOnlinePayments = (userId: number) =>
  useQuery({
    queryKey: K.online(userId),
    queryFn: fetchOnlinePayments,
    select: r => r.enabled,
    enabled: userId > 0,
    staleTime: 5 * 60_000,
  });

export const useStartInvoicePayment = () =>
  useMutation({ mutationFn: (invoiceId: number) => startInvoicePayment(invoiceId) });

/** Verifies a Checkout result; on success every billing list refetches. */
export const useVerifyInvoicePayment = (userId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: VerifyPaymentPayload) => verifyInvoicePayment(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.all(userId) }),
  });
};
