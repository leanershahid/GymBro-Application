import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, ListRenderItemInfo, NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, SP, R } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import { apiErrorText, describeApiError } from '../../../api/apiError';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../common/components/EmptyState';
import BottomSheet from '../../common/components/BottomSheet';
import PrimaryButton from '../../common/components/PrimaryButton';
import { useToast } from '../../common/components/Toast';
import { useAttachables, useLoadOlder, useMute, useReportMessage, useSendMessage, useThread } from '../api/messagingQueries';
import type { DirectMessage, MessageAttachment, OutgoingMessage } from '../api/messaging.types';
import { ThreadItem, lastReadMineId, newClientMessageId, pendingOnly, threadItems } from '../utils/messageUtils';
import { Banner, Bubble, DaySeparator, ImageViewer, outgoingBubble, storedBubble } from '../components/MessagingUi';
import MessageComposer from '../components/MessageComposer';

interface Props {
  conversationId: number;
  onBack: () => void;
  /** Member app: open a shared workout (template id) / plan (plan id). */
  onOpenWorkout?: (workoutId: number) => void;
  onOpenPlan?: (planId: number) => void;
}

const keyOf = (i: ThreadItem) => i.key;

/**
 * One trainer ↔ member thread (both apps). Polls every 10 s while open; sends are optimistic
 * (Sending… → Sent → Read, or Not sent with Retry using the same clientMessageId, so a retry is
 * never stored twice). Long-press a received message to report it.
 */
export default function MessageThreadScreen({ conversationId, onBack, onOpenWorkout, onOpenPlan }: Props) {
  const { hPad } = useLayout();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const q = useThread(conversationId);
  const send = useSendMessage(conversationId);
  const older = useLoadOlder(conversationId);
  const mute = useMute(conversationId);
  const report = useReportMessage(conversationId);
  const [attachOpen, setAttachOpen] = useState(false);
  const attachables = useAttachables(conversationId, attachOpen && !!q.data?.canAttach);
  const [outbox, setOutbox] = useState<OutgoingMessage[]>([]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [reporting, setReporting] = useState<DirectMessage | null>(null);
  const [reason, setReason] = useState('');
  const list = useRef<FlatList<ThreadItem>>(null);
  const atBottom = useRef(true);

  const t = q.data;
  const stored = useMemo(() => t?.messages ?? [], [t?.messages]);
  const outgoing = useMemo(() => pendingOnly(outbox, stored), [outbox, stored]);
  const items = useMemo(() => threadItems(stored, outgoing), [stored, outgoing]);
  const readId = lastReadMineId(stored, t?.otherLastReadAt ?? null);
  const lastMineId = [...stored].reverse().find(m => m.mine)?.id ?? null;

  const deliver = useCallback((o: OutgoingMessage) => {
    setOutbox(prev => [...prev.filter(x => x.clientMessageId !== o.clientMessageId), { ...o, status: 'sending', error: undefined }]);
    send.mutate(
      { clientMessageId: o.clientMessageId, body: o.body, photoUrl: o.photoUrl, attachmentType: o.attachment?.type, attachmentId: o.attachment?.id },
      {
        onSuccess: () => setOutbox(prev => prev.filter(x => x.clientMessageId !== o.clientMessageId)),
        onError: e => setOutbox(prev => prev.map(x => (x.clientMessageId === o.clientMessageId ? { ...x, status: 'failed', error: describeApiError(e).message } : x))),
      },
    );
  }, [send]);

  const onSend = (m: { body: string; photoUrl: string | null; attachment: MessageAttachment | null }) => {
    atBottom.current = true;
    deliver({ clientMessageId: newClientMessageId(), body: m.body, photoUrl: m.photoUrl, attachment: m.attachment, createdAt: new Date().toISOString(), status: 'sending' });
  };

  const openAttachment = useMemo(() => {
    if (!onOpenWorkout && !onOpenPlan) return undefined;
    return (a: MessageAttachment) => {
      if (a.type === 'workout' && onOpenWorkout) onOpenWorkout(a.targetId);
      else if (a.type === 'plan' && onOpenPlan) onOpenPlan(a.targetId);
    };
  }, [onOpenWorkout, onOpenPlan]);

  const renderItem = useCallback(({ item }: ListRenderItemInfo<ThreadItem>) => {
    if (item.kind === 'day') return <DaySeparator label={item.label} />;
    if (item.kind === 'outgoing') {
      const o = item.message;
      return <Bubble {...outgoingBubble(o)} onRetry={() => deliver(o)} onOpenPhoto={setPhoto} />;
    }
    const m = item.message;
    const state = m.mine && m.id === lastMineId ? (m.id === readId ? 'read' : 'sent') : m.mine && m.id === readId ? 'read' : null;
    return (
      <Bubble {...storedBubble(m, state)} onOpenPhoto={setPhoto} onOpenAttachment={openAttachment}
        onLongPress={!m.mine && !m.reported && !m.redacted ? () => { setReason(''); setReporting(m); } : undefined} />
    );
  }, [deliver, lastMineId, readId, openAttachment]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    atBottom.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 80;
  };

  const doReport = () => {
    if (!reporting) return;
    report.mutate({ messageId: reporting.id, reason: reason.trim() || undefined }, {
      onSuccess: () => { setReporting(null); toast.show({ message: 'Thanks — the gym will look into it.' }); },
      onError: e => toast.show({ type: 'error', message: apiErrorText(e) }),
    });
  };

  const title = t?.other.name ?? 'Messages';
  return (
    <Screen>
      <ScreenHeader eyebrow={t ? (t.mySide === 'member' ? 'Your coach' : 'Client') : 'Messages'} title={title} onBack={onBack}
        right={t ? (
          <Pressable onPress={() => mute.mutate(!t.muted, { onError: e => toast.show({ type: 'error', message: apiErrorText(e) }) })} hitSlop={8}
            accessibilityRole="switch" accessibilityState={{ checked: !t.muted }}
            accessibilityLabel={t.muted ? 'Notifications muted for this conversation. Turn on' : 'Mute notifications for this conversation'}
            style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bgInputActive, borderWidth: 1, borderColor: T.line }}>
            <Feather name={t.muted ? 'bell-off' : 'bell'} size={18} color={t.muted ? T.textFaint : T.text} />
          </Pressable>
        ) : undefined} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}>
        {q.isLoading && <LoadingState label="Loading conversation" />}
        {q.isError && (
          <EmptyState icon="alert-triangle" tone="error" title="Couldn't load this conversation" subtitle={describeApiError(q.error).message}
            action={{ label: 'Try again', onPress: () => q.refetch() }} />
        )}
        {t && (
          <>
            {t.hoursNotice && <View style={{ paddingHorizontal: hPad, paddingBottom: SP.sm }}><Banner icon="clock" tone={T.sky}>{t.hoursNotice}</Banner></View>}
            <FlatList
              ref={list}
              data={items}
              keyExtractor={keyOf}
              renderItem={renderItem}
              onScroll={onScroll}
              scrollEventThrottle={100}
              keyboardShouldPersistTaps="handled"
              accessibilityRole="list"
              accessibilityLabel={`Conversation with ${title}`}
              onContentSizeChange={() => { if (atBottom.current) list.current?.scrollToEnd({ animated: false }); }}
              contentContainerStyle={{ paddingHorizontal: hPad, paddingVertical: SP.md, flexGrow: 1, width: '100%', maxWidth: 680, alignSelf: 'center' }}
              ListHeaderComponent={t.hasMore ? (
                <Pressable onPress={() => { atBottom.current = false; older.mutate(stored[0]?.id ?? 0); }} disabled={older.isPending}
                  accessibilityRole="button" accessibilityLabel="Load earlier messages" style={{ alignSelf: 'center', padding: SP.sm, minHeight: 44, justifyContent: 'center' }}>
                  <Text style={{ color: T.brand, fontSize: 13, fontWeight: '700' }}>{older.isPending ? 'Loading…' : 'Load earlier messages'}</Text>
                </Pressable>
              ) : null}
              ListEmptyComponent={
                <EmptyState icon="message-circle" title={`Say hi to ${t.other.name}`}
                  subtitle={t.mySide === 'member' ? 'Ask about your training, your plan or your next session.' : 'Check in, share a workout, or answer a question.'} />
              }
            />
            <View style={{ paddingHorizontal: hPad, paddingBottom: Math.max(insets.bottom, SP.md), borderTopWidth: 1, borderTopColor: T.line, backgroundColor: T.bg, width: '100%', maxWidth: 680, alignSelf: 'center', gap: SP.sm }}>
              {t.canSend ? (
                <MessageComposer onSend={onSend}
                  attachables={t.canAttach ? { items: attachables.data ?? [], loading: attachables.isLoading, onOpen: () => setAttachOpen(true) } : null} />
              ) : (
                <View style={{ paddingTop: SP.sm }}><Banner icon="lock" tone={T.brandGold}>{t.blockedNote ?? "You can't send messages here right now."}</Banner></View>
              )}
              <Text style={{ color: T.textFaint, fontSize: 11, textAlign: 'center' }}>{t.reviewNotice}</Text>
            </View>
          </>
        )}
      </KeyboardAvoidingView>

      <ImageViewer url={photo} onClose={() => setPhoto(null)} />

      <BottomSheet visible={!!reporting} onClose={() => setReporting(null)} title="Report this message">
        <Text style={{ color: T.textSub, fontSize: 13, lineHeight: 19, marginBottom: SP.md }}>
          The gym's team will see this message and the conversation, and follow up with you. {t?.other.name ?? 'The other person'} isn't notified about the report.
        </Text>
        <TextInput value={reason} onChangeText={setReason} placeholder="What's wrong? (optional)" placeholderTextColor={T.textFaint} multiline maxLength={1000}
          accessibilityLabel="Reason for the report (optional)"
          style={{ minHeight: 80, color: T.text, fontSize: 14, padding: SP.md, backgroundColor: T.bgInput, borderRadius: R.md, borderWidth: 1, borderColor: T.line, textAlignVertical: 'top' }} />
        <PrimaryButton label="Report message" icon="flag" loading={report.isPending} onPress={doReport} style={{ marginTop: SP.md }} />
      </BottomSheet>
    </Screen>
  );
}
