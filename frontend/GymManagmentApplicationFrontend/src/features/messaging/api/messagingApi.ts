import axiosInstance from '../../../api/axios';
import { ApiResponse } from '../../../api/types';
import { unwrap } from '../../../api/http';
import {
  ConversationDetail, ConversationSummary, DirectMessage, MessageAttachment, MessageContact, MessagingSettings, MyMessagingSettings,
  ReviewConversationDetail, ReviewConversationSummary, SendMessagePayload, UnreadMessages,
} from './messaging.types';

// Raw calls: participants (member or trainer — the server decides from the role) and the admin review.
const EP = {
  list: '/messages/conversations',
  unread: '/messages/unread',
  contacts: '/messages/contacts',
  thread: (id: number) => `/messages/conversations/${id}`,
  send: (id: number) => `/messages/conversations/${id}/messages`,
  read: (id: number) => `/messages/conversations/${id}/read`,
  mute: (id: number) => `/messages/conversations/${id}/mute`,
  attachables: (id: number) => `/messages/conversations/${id}/attachables`,
  report: (messageId: number) => `/messages/${messageId}/report`,
  settings: '/messages/settings',
  reviewList: '/messages-review/conversations',
  reviewThread: (id: number) => `/messages-review/conversations/${id}`,
  reviewSettings: '/messages-review/settings',
};

const get = async <T,>(url: string, params?: Record<string, unknown>): Promise<T> =>
  unwrap((await axiosInstance.get<ApiResponse<T>>(url, { params })).data) as T;
const post = async <T,>(url: string, body?: unknown): Promise<T> => unwrap((await axiosInstance.post<ApiResponse<T>>(url, body ?? {})).data) as T;
const put = async <T,>(url: string, body: unknown): Promise<T> => unwrap((await axiosInstance.put<ApiResponse<T>>(url, body)).data) as T;

export const fetchConversations = () => get<ConversationSummary[]>(EP.list);
export const fetchUnread = () => get<UnreadMessages>(EP.unread);
export const fetchContacts = () => get<MessageContact[]>(EP.contacts);
export const openConversation = (userId: number) => post<ConversationDetail>(EP.list, { userId });
export const fetchThread = (id: number, before?: number) => get<ConversationDetail>(EP.thread(id), before ? { before } : undefined);
export const sendMessage = (id: number, p: SendMessagePayload) => post<DirectMessage>(EP.send(id), p);
export const markRead = (id: number) => post<null>(EP.read(id));
export const muteConversation = (id: number, muted: boolean) => put<{ muted: boolean }>(EP.mute(id), { muted });
export const fetchAttachables = (id: number) => get<MessageAttachment[]>(EP.attachables(id));
export const reportMessage = (messageId: number, reason?: string) => post<{ messageId: number; supportRequestId: number | null }>(EP.report(messageId), { reason });
export const fetchMyMessagingSettings = () => get<MyMessagingSettings>(EP.settings);
export const saveMyMessagingSettings = (s: MyMessagingSettings) => put<MyMessagingSettings>(EP.settings, s);

export const fetchReviewList = (search?: string, reported?: boolean) =>
  get<ReviewConversationSummary[]>(EP.reviewList, { ...(search ? { search } : {}), ...(reported ? { reported: true } : {}) });
export const fetchReviewThread = (id: number) => get<ReviewConversationDetail>(EP.reviewThread(id));
export const fetchMessagingSettings = () => get<MessagingSettings>(EP.reviewSettings);
export const saveMessagingSettings = (s: MessagingSettings) => put<MessagingSettings>(EP.reviewSettings, s);
