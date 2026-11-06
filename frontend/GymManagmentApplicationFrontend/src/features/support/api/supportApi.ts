import axiosInstance from '../../../api/axios';
import { ApiResponse } from '../../../api/types';
import { unwrap } from '../../../api/http';
import {
  CannedReply, FeedbackSummary, HelpCentre, NewRequestPayload, PendingClassFeedback, QueueFilter, QueuePage, ReplyPayload,
  SupportCount, SupportFaq, SupportPriority, SupportRequestDetail, SupportRequestSummary, SupportSettings, SupportStaffOption, SupportStatus,
} from './support.types';

// Raw calls for Help & feedback (member), the staff support queue and the trainer's assigned requests.

/** Staff use /support, trainers /trainer/support (only what is assigned to them). */
export type DeskMode = 'staff' | 'trainer';
const desk = (mode: DeskMode) => (mode === 'trainer' ? '/trainer/support' : '/support');

const EP = {
  help: '/me/help',
  mine: '/me/support-requests',
  mineOne: (id: number) => `/me/support-requests/${id}`,
  mineReply: (id: number) => `/me/support-requests/${id}/messages`,
  rate: (id: number) => `/me/support-requests/${id}/rate`,
  reopen: (id: number) => `/me/support-requests/${id}/reopen`,
  resolve: (id: number) => `/me/support-requests/${id}/resolve`,
  feedbackPending: '/me/class-feedback/pending',
  feedback: '/me/class-feedback',
  queue: (m: DeskMode) => `${desk(m)}/requests`,
  count: (m: DeskMode) => `${desk(m)}/requests/count`,
  request: (m: DeskMode, id: number) => `${desk(m)}/requests/${id}`,
  reply: (m: DeskMode, id: number) => `${desk(m)}/requests/${id}/messages`,
  status: (m: DeskMode, id: number) => `${desk(m)}/requests/${id}/status`,
  assign: (id: number) => `/support/requests/${id}/assign`,
  priority: (id: number) => `/support/requests/${id}/priority`,
  staff: '/support/staff',
  faqs: '/support/faqs',
  faq: (id: number) => `/support/faqs/${id}`,
  canned: (m: DeskMode) => `${desk(m)}/canned-replies`,
  cannedOne: (id: number) => `/support/canned-replies/${id}`,
  settings: '/support/settings',
  summary: '/support/feedback',
};

const get = async <T,>(url: string, params?: Record<string, unknown>): Promise<T> =>
  unwrap((await axiosInstance.get<ApiResponse<T>>(url, { params })).data) as T;
const post = async <T,>(url: string, body?: unknown): Promise<T> => unwrap((await axiosInstance.post<ApiResponse<T>>(url, body ?? {})).data) as T;
const put = async <T,>(url: string, body: unknown): Promise<T> => unwrap((await axiosInstance.put<ApiResponse<T>>(url, body)).data) as T;
const del = async (url: string): Promise<void> => { unwrap((await axiosInstance.delete<ApiResponse<null>>(url)).data); };

// ── Member ────────────────────────────────────────────────────────────────
export const fetchHelpCentre = (search?: string) => get<HelpCentre>(EP.help, search ? { search } : undefined);
export const fetchMyRequests = () => get<SupportRequestSummary[]>(EP.mine);
export const fetchMyRequest = (id: number) => get<SupportRequestDetail>(EP.mineOne(id));
export const createRequest = (p: NewRequestPayload) => post<SupportRequestDetail>(EP.mine, p);
export const replyAsMember = (id: number, p: ReplyPayload) => post<SupportRequestDetail>(EP.mineReply(id), p);
export const rateRequest = (id: number, score: number, comment?: string) => post<SupportRequestDetail>(EP.rate(id), { score, comment });
export const reopenRequest = (id: number, message?: string) => post<SupportRequestDetail>(EP.reopen(id), { message });
export const resolveAsMember = (id: number) => post<SupportRequestDetail>(EP.resolve(id));
export const fetchPendingFeedback = () => get<PendingClassFeedback | null>(EP.feedbackPending);
export const submitClassFeedback = (p: { bookingId: number; score?: number; comment?: string; skip?: boolean }) => post<null>(EP.feedback, p);

// ── Staff / trainer ───────────────────────────────────────────────────────
/** Only the filters that are set (no empty strings / undefined in the query string). */
const params = (f: QueueFilter) =>
  Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== '' && v !== false)) as Record<string, unknown>;
export const fetchQueue = (mode: DeskMode, f: QueueFilter) => get<QueuePage>(EP.queue(mode), params(f));
export const fetchCount = (mode: DeskMode) => get<SupportCount>(EP.count(mode));
export const fetchRequest = (mode: DeskMode, id: number) => get<SupportRequestDetail>(EP.request(mode, id));
export const replyAsStaff = (mode: DeskMode, id: number, p: ReplyPayload) => post<SupportRequestDetail>(EP.reply(mode, id), p);
export const setStatus = (mode: DeskMode, id: number, status: SupportStatus) => put<SupportRequestDetail>(EP.status(mode, id), { status });
export const assignRequest = (id: number, assigneeId: number | null) => put<SupportRequestDetail>(EP.assign(id), { assigneeId });
export const setPriority = (id: number, priority: SupportPriority) => put<SupportRequestDetail>(EP.priority(id), { priority });
export const fetchStaffOptions = () => get<SupportStaffOption[]>(EP.staff);
export const fetchFaqs = () => get<SupportFaq[]>(EP.faqs);
export const saveFaq = (f: Partial<SupportFaq> & { question: string; answer: string }) =>
  f.id ? put<SupportFaq>(EP.faq(f.id), f) : post<SupportFaq>(EP.faqs, f);
export const deleteFaq = (id: number) => del(EP.faq(id));
export const fetchCanned = (mode: DeskMode) => get<CannedReply[]>(EP.canned(mode));
export const saveCanned = (c: { id?: number; title: string; body: string }) =>
  c.id ? put<CannedReply>(EP.cannedOne(c.id), c) : post<CannedReply>(EP.canned('staff'), c);
export const deleteCanned = (id: number) => del(EP.cannedOne(id));
export const fetchSupportSettings = () => get<SupportSettings>(EP.settings);
export const saveSupportSettings = (s: SupportSettings) => put<SupportSettings>(EP.settings, s);
export const fetchFeedbackSummary = (days = 90) => get<FeedbackSummary>(EP.summary, { days });
