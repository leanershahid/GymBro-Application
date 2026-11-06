import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R, withAlpha } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import { apiErrorText, describeApiError } from '../../../api/apiError';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../common/components/EmptyState';
import BottomSheet from '../../common/components/BottomSheet';
import StatusPill from '../../common/components/StatusPill';
import { useToast } from '../../common/components/Toast';
import { DeskMode } from '../api/supportApi';
import { useAssign, useCanned, useDeskRequest, useSetPriority, useSetStatus, useStaffOptions, useStaffReply } from '../api/supportQueries';
import { SupportPriority, SupportStatus } from '../api/support.types';
import {
  Card, MessageBubble, PRIORITY_LABEL, PRIORITY_TONE, STAFF_STATUS_LABEL, SlaChip, StatusChip, categoryOf, day, dueText, when,
} from '../components/SupportUi';
import ReplyComposer from '../components/ReplyComposer';

interface Props {
  mode?: DeskMode;
  requestId: number;
  onBack: () => void;
  onOpenMember?: (memberId: number) => void;
}

type Sheet = 'assign' | 'priority' | 'status' | 'canned' | null;

function Pill({ icon, label, onPress, tone = T.textSub }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; onPress?: () => void; tone?: string }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 12, borderRadius: R.pill,
        borderWidth: 1, borderColor: T.line, backgroundColor: pressed ? T.bgInputActive : T.bgInput })}>
      <Feather name={icon} size={14} color={tone} />
      <Text style={{ color: T.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
      {onPress && <Feather name="chevron-down" size={14} color={T.textFaint} />}
    </Pressable>
  );
}

function Option({ label, sub, on, onPress }: { label: string; sub?: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={label}
      style={({ pressed }) => ({ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingHorizontal: SP.md, borderRadius: R.md,
        backgroundColor: on ? withAlpha(T.brand, 0.12) : pressed ? T.bgInputActive : 'transparent' })}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: T.text, fontSize: 15, fontWeight: '600' }}>{label}</Text>
        {!!sub && <Text style={{ color: T.textFaint, fontSize: 12 }}>{sub}</Text>}
      </View>
      {on && <Feather name="check" size={18} color={T.brand} />}
    </Pressable>
  );
}

/** One request for staff (assign, priority, status, reply / internal note, saved replies) or the assigned trainer. */
export default function SupportRequestPage({ mode = 'staff', requestId, onBack, onOpenMember }: Props) {
  const staff = mode === 'staff';
  const { hPad } = useLayout();
  const toast = useToast();
  const q = useDeskRequest(mode, requestId);
  const reply = useStaffReply(mode, requestId);
  const status = useSetStatus(mode, requestId);
  const assign = useAssign(requestId);
  const priority = useSetPriority(requestId);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [asNote, setAsNote] = useState(false);
  const [after, setAfter] = useState<SupportStatus>('waiting');
  const [draft, setDraft] = useState('');
  const people = useStaffOptions(staff && sheet === 'assign').data ?? [];
  const canned = useCanned(mode).data ?? [];
  const scroll = useRef<ScrollView>(null);
  const r = q.data;
  const count = r?.messages.length ?? 0;
  useEffect(() => { if (count) setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50); }, [count]);

  const fail = (e: unknown) => toast.show({ type: 'error', message: apiErrorText(e) });
  const close = () => setSheet(null);
  const send = (body: string, photos: string[]) =>
    reply.mutateAsync({ body, photos, internal: asNote, status: asNote ? undefined : after })
      .then(() => toast.show({ message: asNote ? 'Note added.' : after === 'resolved' ? 'Reply sent and resolved.' : 'Reply sent.' }))
      .catch(e => { fail(e); throw e; });

  return (
    <Screen>
      <ScreenHeader eyebrow={r ? `#${r.id} · ${categoryOf(r.category).label}` : 'Support'} title={r?.subject ?? 'Request'} onBack={onBack} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {q.isLoading && <LoadingState label="Loading request" />}
        {q.isError && (
          <EmptyState icon="alert-triangle" tone="error" title="Couldn't load this request" subtitle={describeApiError(q.error).message}
            action={{ label: 'Try again', onPress: () => q.refetch() }} />
        )}
        {r && (
          <>
            <ScrollView ref={scroll} keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: SP.lg, gap: SP.md, width: '100%', maxWidth: 760, alignSelf: 'center' }}>
              <Card accent={r.sla?.overdue ? T.err : undefined}>
                <Pressable disabled={!onOpenMember || !r.memberId} onPress={() => r.memberId && onOpenMember?.(r.memberId)}
                  accessibilityRole={onOpenMember ? 'link' : undefined} accessibilityLabel={`Member ${r.memberName}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 44 }}>
                  <Feather name="user" size={18} color={T.brand} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: T.text, fontSize: 16, fontWeight: '700' }}>{r.memberName}</Text>
                    <Text style={{ color: T.textSub, fontSize: 12 }}>
                      {r.canContact ? `Happy to be contacted · ${r.contactMethod === 'phone' ? r.memberPhone ?? 'phone' : r.contactMethod === 'email' ? r.memberEmail ?? 'email' : 'in the app'}` : 'Reply in the app only'}
                      {r.memberOtherRequests ? ` · ${r.memberOtherRequests} other request${r.memberOtherRequests > 1 ? 's' : ''}` : ''}
                    </Text>
                  </View>
                  {onOpenMember && <Feather name="chevron-right" size={18} color={T.textFaint} />}
                </Pressable>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: SP.md }}>
                  <StatusChip status={r.status} staff />
                  <StatusPill label={PRIORITY_LABEL[r.priority]} tone={PRIORITY_TONE[r.priority]} />
                  <SlaChip sla={r.sla} />
                </View>
                {r.sla && (
                  <Text style={{ color: r.sla.overdue ? T.err : T.textFaint, fontSize: 12, marginTop: 8 }}>
                    {r.firstResponseAt ? `First reply ${when(r.firstResponseAt)}` : `First reply ${dueText(r.sla.firstResponseDueAt)}`}
                    {r.status === 'open' ? ` · resolve ${dueText(r.sla.resolutionDueAt)}` : ''} · opened {day(r.createdAt)}{r.branchName ? ` · ${r.branchName}` : ''}
                  </Text>
                )}
              </Card>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {staff && <Pill icon="user-check" label={r.assigneeName ?? 'Assign'} tone={r.assigneeName ? T.brand : T.brandGold} onPress={() => setSheet('assign')} />}
                {staff && <Pill icon="flag" label={PRIORITY_LABEL[r.priority]} onPress={() => setSheet('priority')} />}
                <Pill icon="activity" label={STAFF_STATUS_LABEL[r.status]} onPress={() => setSheet('status')} />
              </View>

              <View accessibilityRole="list" accessibilityLabel="Conversation">
                {r.messages.map(m => <MessageBubble key={m.id} m={m} viewer="staff" />)}
              </View>
            </ScrollView>

            <View style={{ paddingHorizontal: hPad, paddingBottom: SP.lg, borderTopWidth: 1, borderTopColor: T.line, backgroundColor: T.bg, width: '100%', maxWidth: 760, alignSelf: 'center' }}>
              <ReplyComposer
                value={draft} onChangeValue={setDraft}
                placeholder={asNote ? 'Internal note (staff only)…' : `Reply to ${r.memberName ?? 'the member'}…`}
                tone={asNote ? 'note' : 'default'} sending={reply.isPending} onSend={send} sendLabel={asNote ? 'Add note' : 'Send reply'}
                extra={
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <Pressable onPress={() => setAsNote(n => !n)} accessibilityRole="switch" accessibilityState={{ checked: asNote }} accessibilityLabel="Internal note, staff only"
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: R.pill, borderWidth: 1,
                        borderColor: asNote ? T.brandGold : T.line, backgroundColor: asNote ? withAlpha(T.brandGold, 0.14) : T.bgInput }}>
                      <Feather name="lock" size={13} color={asNote ? T.brandGold : T.textSub} />
                      <Text style={{ color: asNote ? T.brandGold : T.textSub, fontSize: 12, fontWeight: '600' }}>Internal note</Text>
                    </Pressable>
                    {!asNote && (['waiting', 'resolved', 'open'] as SupportStatus[]).map(s => (
                      <Pressable key={s} onPress={() => setAfter(s)} accessibilityRole="radio" accessibilityState={{ checked: after === s }}
                        accessibilityLabel={`After sending: ${STAFF_STATUS_LABEL[s]}`}
                        style={{ minHeight: 36, paddingHorizontal: 12, justifyContent: 'center', borderRadius: R.pill, borderWidth: 1,
                          borderColor: after === s ? T.brand : T.line, backgroundColor: after === s ? withAlpha(T.brand, 0.12) : T.bgInput }}>
                        <Text style={{ color: after === s ? T.text : T.textSub, fontSize: 12, fontWeight: '600' }}>{s === 'waiting' ? '& wait for member' : s === 'resolved' ? '& resolve' : '& keep open'}</Text>
                      </Pressable>
                    ))}
                    {canned.length > 0 && (
                      <Pressable onPress={() => setSheet('canned')} accessibilityRole="button" accessibilityLabel="Insert a saved reply"
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12 }}>
                        <Feather name="message-square" size={13} color={T.brand} />
                        <Text style={{ color: T.brand, fontSize: 12, fontWeight: '600' }}>Saved replies</Text>
                      </Pressable>
                    )}
                  </View>
                }
              />
            </View>

            <BottomSheet visible={sheet === 'assign'} onClose={close} title="Assign to">
              <ScrollView style={{ maxHeight: 420 }}>
                <Option label="Unassigned" on={!r.assigneeId} onPress={() => { close(); assign.mutate(null, { onError: fail }); }} />
                {people.map(p => (
                  <Option key={p.id} label={p.name} sub={p.role} on={r.assigneeId === p.id}
                    onPress={() => { close(); assign.mutate(p.id, { onError: fail }); }} />
                ))}
              </ScrollView>
            </BottomSheet>
            <BottomSheet visible={sheet === 'priority'} onClose={close} title="Priority">
              {(['urgent', 'high', 'normal', 'low'] as SupportPriority[]).map(p => (
                <Option key={p} label={PRIORITY_LABEL[p]} on={r.priority === p} onPress={() => { close(); priority.mutate(p, { onError: fail }); }} />
              ))}
            </BottomSheet>
            <BottomSheet visible={sheet === 'status'} onClose={close} title="Status">
              {(['open', 'waiting', 'resolved', 'closed'] as SupportStatus[]).map(s => (
                <Option key={s} label={STAFF_STATUS_LABEL[s]} sub={s === 'resolved' ? 'Member can rate it and reopen for 7 days' : s === 'closed' ? 'No more replies' : undefined}
                  on={r.status === s} onPress={() => { close(); status.mutate(s, { onError: fail }); }} />
              ))}
            </BottomSheet>
            <BottomSheet visible={sheet === 'canned'} onClose={close} title="Saved replies">
              <ScrollView style={{ maxHeight: 420 }}>
                {canned.map(c => (
                  <Option key={c.id} label={c.title} sub={c.body.slice(0, 80)} on={false}
                    onPress={() => { close(); setAsNote(false); setDraft(c.body.replace('{name}', (r.memberName ?? '').split(' ')[0])); }} />
                ))}
              </ScrollView>
            </BottomSheet>
          </>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}
