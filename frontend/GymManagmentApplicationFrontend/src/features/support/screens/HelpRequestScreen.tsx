import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { T, SP, R } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import { apiErrorText, describeApiError } from '../../../api/apiError';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import PrimaryButton from '../../common/components/PrimaryButton';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../common/components/EmptyState';
import { confirm } from '../../common/components/dialogs';
import { useToast } from '../../common/components/Toast';
import { useMemberReply, useMemberResolve, useMyRequest, useRateRequest, useReopenRequest } from '../api/supportQueries';
import { Card, MessageBubble, Notice, StarRating, StatusChip, categoryOf, day } from '../components/SupportUi';
import ReplyComposer from '../components/ReplyComposer';

interface Props {
  requestId: number;
  onBack: () => void;
  onNew: () => void;
}

/** One request as a conversation: reply (optimistic), mark sorted, rate once, reopen within 7 days. */
export default function HelpRequestScreen({ requestId, onBack, onNew }: Props) {
  const { hPad } = useLayout();
  const toast = useToast();
  const q = useMyRequest(requestId);
  const reply = useMemberReply(requestId);
  const rate = useRateRequest(requestId);
  const reopen = useReopenRequest(requestId);
  const resolve = useMemberResolve(requestId);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const scroll = useRef<ScrollView>(null);
  const r = q.data;
  const count = r?.messages.length ?? 0;
  useEffect(() => { if (count) setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50); }, [count]);

  const fail = (e: unknown) => toast.show({ type: 'error', message: apiErrorText(e) });
  const send = (body: string, photos: string[]) =>
    reply.mutateAsync({ body, photos }).catch(e => { fail(e); throw e; });
  const doResolve = async () => {
    if (!(await confirm({ title: 'Mark this as sorted?', message: "Thanks for letting us know. You can reopen it for 7 days.", confirmLabel: "It's sorted" }))) return;
    resolve.mutate(undefined, { onError: fail });
  };
  const doRate = () => {
    if (stars < 1) return;
    rate.mutate({ score: stars, comment: comment.trim() || undefined }, {
      onSuccess: () => toast.show({ message: 'Thanks for the feedback!' }), onError: fail,
    });
  };

  return (
    <Screen>
      <ScreenHeader eyebrow={r ? categoryOf(r.category).label : 'Help & feedback'} title={r?.subject ?? 'Request'} onBack={onBack} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {q.isLoading && <LoadingState label="Loading conversation" />}
        {q.isError && (
          <EmptyState icon="alert-triangle" tone="error" title="Couldn't load this request" subtitle={describeApiError(q.error).message}
            action={{ label: 'Try again', onPress: () => q.refetch() }} />
        )}
        {r && (
          <>
            <ScrollView ref={scroll} keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: SP.lg, gap: SP.md, width: '100%', maxWidth: 680, alignSelf: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <StatusChip status={r.status} />
                <Text style={{ color: T.textFaint, fontSize: 12 }}>#{r.id} · opened {day(r.createdAt)}{r.branchName ? ` · ${r.branchName}` : ''}</Text>
              </View>

              <View accessibilityRole="list" accessibilityLabel="Conversation">
                {r.messages.map(m => <MessageBubble key={m.id} m={m} viewer="member" />)}
              </View>

              {r.status === 'open' && !r.firstResponseAt && (
                <Notice icon="clock" tone={T.sky}>Thanks — the team will get back to you soon. You'll get a notification when they reply.</Notice>
              )}
              {r.status === 'waiting' && <Notice icon="message-circle" tone={T.brandGold}>The gym is waiting on you. Reply below, or mark it as sorted.</Notice>}

              {r.canRate && (
                <Card accent={T.brandGold}>
                  <Text accessibilityRole="header" style={{ color: T.text, fontSize: 16, fontWeight: '700', marginBottom: 4 }}>How did we do?</Text>
                  <Text style={{ color: T.textSub, fontSize: 13, marginBottom: SP.sm }}>Rate the help you got — it goes straight to the gym's team.</Text>
                  <StarRating value={stars} onChange={setStars} label="Rate this help" />
                  {stars > 0 && (
                    <>
                      <TextInput value={comment} onChangeText={setComment} placeholder="Anything to add? (optional)" placeholderTextColor={T.textFaint}
                        multiline maxLength={1000} accessibilityLabel="Comment (optional)"
                        style={{ marginTop: SP.md, minHeight: 64, color: T.text, fontSize: 14, padding: SP.md, backgroundColor: T.bgInputActive, borderRadius: R.md, borderWidth: 1, borderColor: T.line }} />
                      <PrimaryButton label="Send rating" icon="star" loading={rate.isPending} onPress={doRate} style={{ marginTop: SP.md }} />
                    </>
                  )}
                </Card>
              )}
              {r.rating != null && (
                <Card>
                  <Text style={{ color: T.textSub, fontSize: 13, marginBottom: 4 }}>Your rating</Text>
                  <StarRating value={r.rating} size={22} label="Your rating" />
                  {!!r.ratingComment && <Text style={{ color: T.text, fontSize: 14, marginTop: 6 }}>{r.ratingComment}</Text>}
                </Card>
              )}

              {r.canReopen && (
                <PrimaryButton label="Not sorted? Reopen" icon="rotate-ccw" variant="secondary" loading={reopen.isPending}
                  accessibilityHint={r.reopenUntil ? `Possible until ${day(r.reopenUntil)}` : undefined}
                  onPress={() => reopen.mutate(undefined, { onError: fail })} />
              )}
              {r.status === 'closed' && (
                <EmptyState icon="check-circle" title="This request is closed" subtitle="Need anything else? We're happy to help."
                  action={{ label: 'Start a new request', onPress: onNew }} />
              )}
              {(r.status === 'open' || r.status === 'waiting') && (
                <PrimaryButton label="It's sorted" icon="check" variant="secondary" loading={resolve.isPending} onPress={doResolve} />
              )}
            </ScrollView>

            {r.canReply && r.status !== 'resolved' && (
              <View style={{ paddingHorizontal: hPad, paddingBottom: SP.lg, borderTopWidth: 1, borderTopColor: T.line, backgroundColor: T.bg, width: '100%', maxWidth: 680, alignSelf: 'center' }}>
                <ReplyComposer placeholder="Reply to the gym…" onSend={send} sending={reply.isPending} sendLabel="Send reply" />
              </View>
            )}
          </>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}
