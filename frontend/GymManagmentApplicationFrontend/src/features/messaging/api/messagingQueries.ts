import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAttachables, fetchContacts, fetchConversations, fetchMessagingSettings, fetchMyMessagingSettings, fetchReviewList, fetchReviewThread,
  fetchThread, fetchUnread, muteConversation, openConversation, reportMessage, saveMessagingSettings, saveMyMessagingSettings, sendMessage,
} from './messagingApi';
import { ConversationDetail, MessagingSettings, MyMessagingSettings, SendMessagePayload } from './messaging.types';
import { isRetryableSendError, mergeMessage } from '../utils/messageUtils';

// Feature-local keys under one root.
const ROOT = ['messaging'] as const;
export const messagingKeys = {
  all: ROOT,
  list: [...ROOT, 'list'] as const,
  unread: [...ROOT, 'unread'] as const,
  contacts: [...ROOT, 'contacts'] as const,
  thread: (id: number) => [...ROOT, 'thread', id] as const,
  attachables: (id: number) => [...ROOT, 'attachables', id] as const,
  mySettings: [...ROOT, 'my-settings'] as const,
  reviewRoot: [...ROOT, 'review'] as const,
  reviewList: (search: string, reported: boolean) => [...ROOT, 'review', 'list', search, reported] as const,
  reviewThread: (id: number) => [...ROOT, 'review', 'thread', id] as const,
  settings: [...ROOT, 'settings'] as const,
};
const K = messagingKeys;

/** Polling, no websockets: the open thread every 10 s, the inbox and badge every 60 s. */
export const THREAD_POLL_MS = 10_000;
export const LIST_POLL_MS = 60_000;

export const useConversations = () => useQuery({ queryKey: K.list, queryFn: fetchConversations, refetchInterval: LIST_POLL_MS });
export const useUnreadMessages = (enabled = true) =>
  useQuery({ queryKey: K.unread, queryFn: fetchUnread, enabled, refetchInterval: LIST_POLL_MS, staleTime: 30_000 });
export const useContacts = () => useQuery({ queryKey: K.contacts, queryFn: fetchContacts, staleTime: 5 * 60_000 });

export const useThread = (id: number) => {
  const qc = useQueryClient();
  return useQuery({
    queryKey: K.thread(id),
    queryFn: async () => {
      const d = await fetchThread(id);
      // Opening marks it read on the server; refresh the badge and inbox with it.
      qc.invalidateQueries({ queryKey: K.unread });
      return d;
    },
    enabled: id > 0, refetchInterval: THREAD_POLL_MS,
  });
};

/** Older page above the loaded messages (?before = oldest loaded id), merged into the cached thread. */
export const useLoadOlder = (id: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (before: number) => fetchThread(id, before),
    onSuccess: older => qc.setQueryData<ConversationDetail>(K.thread(id), cur => cur
      ? { ...cur, hasMore: older.hasMore, messages: older.messages.reduce((acc, m) => mergeMessage(acc, m), cur.messages) }
      : cur),
  });
};

export const useOpenConversation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => openConversation(userId),
    onSuccess: d => { qc.setQueryData(K.thread(d.id), d); qc.invalidateQueries({ queryKey: K.contacts }); },
  });
};

/**
 * Sends one message. Network failures retry twice on their own (same clientMessageId, so the server
 * stores it once); a refused send (422 read-only, 429 too fast, 400) does not. The stored message is
 * merged into the cached thread.
 */
export const useSendMessage = (id: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: SendMessagePayload) => sendMessage(id, p),
    retry: (count, e) => count < 2 && isRetryableSendError(e),
    retryDelay: n => 1000 * (n + 1),
    onSuccess: m => {
      qc.setQueryData<ConversationDetail>(K.thread(id), cur => cur ? { ...cur, messages: mergeMessage(cur.messages, m) } : cur);
      qc.invalidateQueries({ queryKey: K.list });
    },
  });
};

export const useMute = (id: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (muted: boolean) => muteConversation(id, muted),
    onSuccess: r => {
      qc.setQueryData<ConversationDetail>(K.thread(id), cur => cur ? { ...cur, muted: r.muted } : cur);
      qc.invalidateQueries({ queryKey: K.list });
    },
  });
};

export const useAttachables = (id: number, enabled: boolean) =>
  useQuery({ queryKey: K.attachables(id), queryFn: () => fetchAttachables(id), enabled: enabled && id > 0, staleTime: 5 * 60_000 });

export const useReportMessage = (conversationId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { messageId: number; reason?: string }) => reportMessage(v.messageId, v.reason),
    onSuccess: r => qc.setQueryData<ConversationDetail>(K.thread(conversationId), cur => cur
      ? { ...cur, messages: cur.messages.map(m => (m.id === r.messageId ? { ...m, reported: true } : m)) } : cur),
  });
};

export const useMyMessagingSettings = (enabled = true) => useQuery({ queryKey: K.mySettings, queryFn: fetchMyMessagingSettings, enabled });
export const useSaveMyMessagingSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: MyMessagingSettings) => saveMyMessagingSettings(s),
    onSuccess: d => { qc.setQueryData(K.mySettings, d); qc.invalidateQueries({ queryKey: [...ROOT, 'thread'] }); },
  });
};

// ── Admin review ──
export const useReviewList = (search: string, reported: boolean) =>
  useQuery({ queryKey: K.reviewList(search, reported), queryFn: () => fetchReviewList(search || undefined, reported), placeholderData: prev => prev });
/** No polling: every fetch is an audited view. */
export const useReviewThread = (id: number) =>
  useQuery({ queryKey: K.reviewThread(id), queryFn: () => fetchReviewThread(id), enabled: id > 0, staleTime: 5 * 60_000, refetchOnWindowFocus: false });
export const useMessagingSettings = () => useQuery({ queryKey: K.settings, queryFn: fetchMessagingSettings });
export const useSaveMessagingSettings = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (s: MessagingSettings) => saveMessagingSettings(s), onSuccess: d => qc.setQueryData(K.settings, d) });
};
