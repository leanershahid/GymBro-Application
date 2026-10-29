import axiosInstance from '../../../api/axios';
import { ApiResponse, PaginatedData } from '../../../api/types';
import { currentTenantId } from '../../../api/session';
import {
  MembershipPlan, CreatePlanPayload, UpdatePlanPayload,
  Subscription, SubscriptionUsage, CreateSubscriptionPayload, ChargeOptions,
  Invoice, CreateInvoicePayload, InvoiceFilter, Payment, ChargePayload, RefundPayload,
  GatewayStatus, SaveGatewayPayload, PayMethod,
} from '../types/billing.types';

// Feature-local paths (kept out of the shared endpoints file).
const EP = {
  plans: '/membership-plans',
  plan: (id: number) => `/membership-plans/${id}`,
  planFeatures: (id: number) => `/membership-plans/${id}/features`,
  subscriptions: '/subscriptions',
  subscription: (id: number) => `/subscriptions/${id}`,
  invoices: '/invoices',
  invoice: (id: number) => `/invoices/${id}`,
  payments: '/payments',
};

/** Unwraps the `{ success, message, data, errors }` envelope. */
const unwrap = <T>(res: { data: ApiResponse<T> }): T => res.data.data as T;
const message = (res: { data: ApiResponse<unknown> }) => res.data.message;

/** Cleans empty strings out of the pay-now block so the server leaves the invoice due. */
const chargeBody = (o: ChargeOptions) => ({
  taxPercent: o.taxPercent || 0,
  discount: o.discount || 0,
  payNowMethod: o.payNowMethod || null,
  paymentReference: o.paymentReference?.trim() || null,
});

// ─── Plans ───────────────────────────────────────────────────────

export const fetchPlans = async (): Promise<MembershipPlan[]> =>
  unwrap(await axiosInstance.get<ApiResponse<MembershipPlan[]>>(EP.plans, { params: { tenantId: currentTenantId() } })) ?? [];

export const createPlan = async (p: Omit<CreatePlanPayload, 'tenantId'>): Promise<MembershipPlan> =>
  unwrap(await axiosInstance.post<ApiResponse<MembershipPlan>>(EP.plans, { ...p, tenantId: currentTenantId() }));

export const updatePlan = async (id: number, p: UpdatePlanPayload): Promise<MembershipPlan> =>
  unwrap(await axiosInstance.put<ApiResponse<MembershipPlan>>(EP.plan(id), p));

export const updatePlanFeatures = async (id: number, features: string[]): Promise<unknown> =>
  unwrap(await axiosInstance.put<ApiResponse<unknown>>(EP.planFeatures(id), { features }));

export const archivePlan = async (id: number): Promise<string> =>
  message(await axiosInstance.delete<ApiResponse<null>>(EP.plan(id)));

// ─── Subscriptions (memberships) ─────────────────────────────────

export const fetchSubscriptions = async (
  memberId?: number, pageNumber = 1, pageSize = 20,
): Promise<PaginatedData<Subscription>> =>
  unwrap(await axiosInstance.get<ApiResponse<PaginatedData<Subscription>>>(EP.subscriptions, {
    params: { tenantId: currentTenantId(), memberId, pageNumber, pageSize },
  }));

export const createSubscription = async (
  p: Omit<CreateSubscriptionPayload, 'tenantId'>,
): Promise<Subscription> =>
  unwrap(await axiosInstance.post<ApiResponse<Subscription>>(EP.subscriptions, {
    tenantId: currentTenantId(), memberId: p.memberId, planId: p.planId, startDate: p.startDate, ...chargeBody(p),
  }));

export const renewSubscription = async (id: number, o: ChargeOptions): Promise<Subscription> =>
  unwrap(await axiosInstance.put<ApiResponse<Subscription>>(`${EP.subscription(id)}/renew`, chargeBody(o)));

export const freezeSubscription = async (id: number, reason?: string): Promise<Subscription> => {
  // FreezeFrom/FreezeUntil are required by the request model but ignored by the service
  // (the pause is open-ended until unfreeze); send today so model binding is happy.
  const today = new Date().toISOString().slice(0, 10);
  return unwrap(await axiosInstance.post<ApiResponse<Subscription>>(`${EP.subscription(id)}/freeze`, {
    freezeFrom: today, freezeUntil: today, reason: reason?.trim() || null,
  }));
};

export const unfreezeSubscription = async (id: number): Promise<Subscription> =>
  unwrap(await axiosInstance.post<ApiResponse<Subscription>>(`${EP.subscription(id)}/unfreeze`));

export const cancelSubscription = async (id: number): Promise<string> =>
  message(await axiosInstance.delete<ApiResponse<null>>(`${EP.subscription(id)}/cancel`));

export const upgradeSubscription = async (id: number, newPlanId: number): Promise<Subscription> =>
  unwrap(await axiosInstance.post<ApiResponse<Subscription>>(`${EP.subscription(id)}/upgrade`, { newPlanId }));

export const fetchSubscriptionUsage = async (id: number): Promise<SubscriptionUsage> =>
  unwrap(await axiosInstance.get<ApiResponse<SubscriptionUsage>>(`${EP.subscription(id)}/usage`));

// ─── Invoices ────────────────────────────────────────────────────

export const fetchInvoices = async (
  filter: InvoiceFilter = 'all', pageNumber = 1, pageSize = 20, memberId?: number,
): Promise<PaginatedData<Invoice>> =>
  unwrap(await axiosInstance.get<ApiResponse<PaginatedData<Invoice>>>(EP.invoices, {
    params: { tenantId: currentTenantId(), memberId, status: filter === 'all' ? undefined : filter, pageNumber, pageSize },
  }));

export const fetchInvoice = async (id: number): Promise<Invoice> =>
  unwrap(await axiosInstance.get<ApiResponse<Invoice>>(EP.invoice(id)));

export const createInvoice = async (p: Omit<CreateInvoicePayload, 'tenantId'>): Promise<Invoice> =>
  unwrap(await axiosInstance.post<ApiResponse<Invoice>>(EP.invoices, {
    ...p, tenantId: currentTenantId(), dueDate: p.dueDate || null, notes: p.notes?.trim() || null,
  }));

/** The invoice PDF as a Blob (web). */
export const fetchInvoicePdf = async (id: number): Promise<Blob> => {
  const res = await axiosInstance.get(`${EP.invoice(id)}/pdf`, { responseType: 'blob' });
  return res.data as Blob;
};

export const sendInvoice = async (id: number, additionalMessage?: string): Promise<string> =>
  message(await axiosInstance.post<ApiResponse<unknown>>(`${EP.invoice(id)}/send`, {
    additionalMessage: additionalMessage?.trim() || null,
  }));

export const markInvoicePaid = async (id: number, method: PayMethod, reference?: string): Promise<Invoice> =>
  unwrap(await axiosInstance.put<ApiResponse<Invoice>>(`${EP.invoice(id)}/mark-paid`, {
    method, reference: reference?.trim() || null,
  }));

// ─── Payments ────────────────────────────────────────────────────

export const chargePayment = async (p: Omit<ChargePayload, 'tenantId'>): Promise<Payment> =>
  unwrap(await axiosInstance.post<ApiResponse<Payment>>(`${EP.payments}/charge`, {
    ...p, tenantId: currentTenantId(), reference: p.reference?.trim() || null, notes: p.notes?.trim() || null,
  }));

export const fetchPaymentHistory = async (
  memberId?: number, pageNumber = 1, pageSize = 20,
): Promise<PaginatedData<Payment>> =>
  unwrap(await axiosInstance.get<ApiResponse<PaginatedData<Payment>>>(`${EP.payments}/history`, {
    params: { tenantId: currentTenantId(), memberId, pageNumber, pageSize },
  }));

export const refundPayment = async (p: RefundPayload): Promise<Payment> =>
  unwrap(await axiosInstance.post<ApiResponse<Payment>>(`${EP.payments}/refund`, {
    paymentId: p.paymentId, amount: p.amount ?? null, reason: p.reason?.trim() || null,
  }));

export const sendPaymentReminder = async (memberId: number, msg?: string): Promise<string> =>
  message(await axiosInstance.post<ApiResponse<unknown>>(`${EP.payments}/reminders`, {
    memberId, message: msg?.trim() || null, channel: 'email',
  }));

// ─── Online payments (Razorpay) ──────────────────────────────────

export const fetchGateway = async (): Promise<GatewayStatus> =>
  unwrap(await axiosInstance.get<ApiResponse<GatewayStatus>>(`${EP.payments}/gateway`));

export const saveGateway = async (p: SaveGatewayPayload): Promise<GatewayStatus> =>
  unwrap(await axiosInstance.put<ApiResponse<GatewayStatus>>(`${EP.payments}/gateway`, {
    keyId: p.keyId.trim(), keySecret: p.keySecret?.trim() || null, isActive: p.isActive,
  }));

export const removeGateway = async (): Promise<string> =>
  message(await axiosInstance.delete<ApiResponse<unknown>>(`${EP.payments}/gateway`));
