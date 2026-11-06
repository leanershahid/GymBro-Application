import axiosInstance from '../../../api/axios';
import { ApiResponse } from '../../../api/types';
import { unwrap } from '../../../api/http';
import {
  CheckoutPayload, CheckoutResult, JoinQuote, JoinQuotePayload, MembershipRequest, MembershipRulesSettings, MyMembership,
  PlanCatalog, RequestPayload, RequestPreview, RequestsPage,
} from './selfService.types';

// Raw calls for member self-service and the staff request queue. Each returns `data` or throws ApiError.

const EP = {
  plans:      '/me/plans',
  quote:      '/me/memberships/quote',
  checkout:   '/me/memberships/checkout',
  membership: '/me/membership',
  myRequests: '/me/membership-requests',
  myRequest:  (id: number) => `/me/membership-requests/${id}`,
  preview:    '/me/membership-requests/preview',
  withdraw:   (id: number) => `/me/membership-requests/${id}/withdraw`,
  queue:      '/membership-requests',
  count:      '/membership-requests/count',
  request:    (id: number) => `/membership-requests/${id}`,
  approve:    (id: number) => `/membership-requests/${id}/approve`,
  reject:     (id: number) => `/membership-requests/${id}/reject`,
  settings:   '/membership-requests/settings',
};

const get = async <T,>(url: string, params?: Record<string, unknown>): Promise<T> =>
  unwrap((await axiosInstance.get<ApiResponse<T>>(url, { params })).data) as T;
const post = async <T,>(url: string, body?: unknown): Promise<T> => unwrap((await axiosInstance.post<ApiResponse<T>>(url, body ?? {})).data) as T;
const put = async <T,>(url: string, body: unknown): Promise<T> => unwrap((await axiosInstance.put<ApiResponse<T>>(url, body)).data) as T;

// ── Member ────────────────────────────────────────────────────────────────
export const fetchPlanCatalog = () => get<PlanCatalog>(EP.plans);
export const fetchJoinQuote = (p: JoinQuotePayload) => post<JoinQuote>(EP.quote, p);
export const checkoutMembership = (p: CheckoutPayload) => post<CheckoutResult>(EP.checkout, p);
export const fetchMyMembership = () => get<MyMembership>(EP.membership);
export const fetchMyRequests = () => get<MembershipRequest[]>(EP.myRequests);
export const fetchMyRequest = (id: number) => get<MembershipRequest>(EP.myRequest(id));
export const previewRequest = (p: RequestPayload) => post<RequestPreview>(EP.preview, p);
export const createRequest = (p: RequestPayload) => post<MembershipRequest>(EP.myRequests, p);
export const withdrawRequest = (id: number) => post<MembershipRequest>(EP.withdraw(id));

// ── Staff ─────────────────────────────────────────────────────────────────
export interface QueueFilter {
  status: 'pending' | 'decided' | 'all';
  type?: string;
  memberId?: number;
  page?: number;
}
export const fetchRequestQueue = (f: QueueFilter) =>
  get<RequestsPage>(EP.queue, { status: f.status, type: f.type || undefined, memberId: f.memberId, page: f.page ?? 1, size: 20 });
export const fetchPendingCount = () => get<{ pending: number }>(EP.count);
export const fetchRequest = (id: number) => get<MembershipRequest>(EP.request(id));
export const approveRequest = (id: number, note?: string) => post<MembershipRequest>(EP.approve(id), { note: note || null });
export const rejectRequest = (id: number, note: string) => post<MembershipRequest>(EP.reject(id), { note });
export const fetchMembershipRules = () => get<MembershipRulesSettings>(EP.settings);
export const saveMembershipRules = (s: MembershipRulesSettings) => put<MembershipRulesSettings>(EP.settings, s);
