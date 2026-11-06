import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import { apiErrorText, describeApiError } from '../../../api/apiError';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import SegmentedTabs from '../../common/components/SegmentedTabs';
import ChipSelect from '../../common/components/ChipSelect';
import StatusPill from '../../common/components/StatusPill';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../common/components/EmptyState';
import BottomSheet from '../../common/components/BottomSheet';
import PrimaryButton from '../../common/components/PrimaryButton';
import { Field, SwitchRow } from '../../common/components/FormFields';
import { useToast } from '../../common/components/Toast';
import { useDecideRequest, useMembershipRules, useRequestQueue, useSaveMembershipRules } from '../api/selfServiceQueries';
import { MembershipRequest, MembershipRulesSettings } from '../api/selfService.types';
import { InfoRow, STATUS_TONE, TYPE_LABEL, day, money } from '../components/SelfServiceUi';

interface Props {
  onBack: () => void;
  /** Only this member's requests (from member detail). */
  memberId?: number;
  onOpenMember?: (memberId: number) => void;
}

const TYPES = [
  { value: '', label: 'All' }, { value: 'freeze', label: 'Pauses' }, { value: 'cancel', label: 'Cancellations' }, { value: 'change', label: 'Plan changes' },
];
const STATUS_TEXT: Record<string, string> = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', withdrawn: 'Withdrawn' };
const keyExtractor = (r: MembershipRequest) => String(r.id);

function summary(r: MembershipRequest) {
  if (r.type === 'freeze') return `${day(r.effectiveFrom)} – ${day(r.effectiveTo)}`;
  if (r.type === 'cancel') return `Last day ${day(r.effectiveFrom)}`;
  return `${r.planName ?? ''} → ${r.newPlanName ?? 'new plan'} · ${day(r.effectiveFrom)}`;
}

const Row = React.memo(function Row({ r, onPress }: { r: MembershipRequest; onPress: (r: MembershipRequest) => void }) {
  return (
    <Pressable onPress={() => onPress(r)} accessibilityRole="button"
      accessibilityLabel={`${TYPE_LABEL[r.type]} request from ${r.memberName}, ${STATUS_TEXT[r.status]}`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: SP.md, padding: SP.lg, marginBottom: SP.sm, borderRadius: R.lg,
        borderWidth: 1, borderColor: T.line, backgroundColor: pressed ? T.bgInputActive : T.bgInput, minHeight: 64 })}>
      <Feather name={r.type === 'freeze' ? 'pause-circle' : r.type === 'cancel' ? 'x-circle' : 'repeat'} size={20} color={r.type === 'cancel' ? T.err : T.textSub} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>{r.memberName ?? `Member ${r.memberId}`} · {TYPE_LABEL[r.type]}</Text>
        <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 12, marginTop: 2 }}>{summary(r)} · asked {day(r.requestedAt)}</Text>
      </View>
      <StatusPill label={r.autoApproved ? 'Auto-approved' : STATUS_TEXT[r.status]} tone={STATUS_TONE[r.status]} />
    </Pressable>
  );
});

/** Staff queue: members' pause / cancel / plan-change requests with approve / reject + note. */
export default function MembershipRequestsPage({ onBack, memberId, onOpenMember }: Props) {
  const { hPad } = useLayout();
  const [status, setStatus] = useState<'pending' | 'decided'>('pending');
  const [type, setType] = useState('');
  const [open, setOpen] = useState<MembershipRequest | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const q = useRequestQueue({ status: memberId ? (status === 'pending' ? 'pending' : 'decided') : status, type, memberId });
  const onPress = useCallback((r: MembershipRequest) => setOpen(r), []);
  const renderItem = useCallback(({ item }: { item: MembershipRequest }) => <Row r={item} onPress={onPress} />, [onPress]);

  return (
    <Screen>
      <ScreenHeader title="Membership requests" eyebrow={memberId ? 'This member' : 'Billing'} onBack={onBack}
        action={{ label: 'Rules', icon: 'sliders', onPress: () => setRulesOpen(true) }} />
      <View style={{ paddingHorizontal: hPad, gap: SP.md }}>
        <SegmentedTabs tabs={[{ key: 'pending', label: 'Pending' }, { key: 'decided', label: 'Decided' }]} value={status} onChange={setStatus} />
        <ChipSelect label="Type" options={TYPES} value={type} onChange={setType} />
      </View>
      {q.isLoading ? <LoadingState label="Loading requests" /> : q.isError ? (
        <EmptyState icon="wifi-off" tone="error" title="Couldn't load requests" subtitle={describeApiError(q.error).message} action={{ label: 'Try again', onPress: () => q.refetch() }} />
      ) : (
        <FlatList
          data={q.data?.items ?? []}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: 120, paddingTop: SP.sm }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} tintColor={T.brand} />}
          ListEmptyComponent={<EmptyState icon="inbox" title={status === 'pending' ? 'Nothing waiting' : 'No decided requests yet'}
            subtitle={status === 'pending' ? 'New pause, cancel and plan-change requests from members show up here.' : undefined} />}
        />
      )}
      <DecideSheet request={open} onClose={() => setOpen(null)} onOpenMember={onOpenMember} />
      <RulesSheet visible={rulesOpen} onClose={() => setRulesOpen(false)} />
    </Screen>
  );
}

function DecideSheet({ request: r, onClose, onOpenMember }: { request: MembershipRequest | null; onClose: () => void; onOpenMember?: (id: number) => void }) {
  const toast = useToast();
  const decide = useDecideRequest();
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string>();
  useEffect(() => { setNote(''); setNoteError(undefined); }, [r?.id]);

  const go = (approve: boolean) => {
    if (!r || decide.isPending) return;
    if (!approve && !note.trim()) { setNoteError('Tell the member why — they will see this note.'); return; }
    decide.mutate({ id: r.id, approve, note: note.trim() || undefined }, {
      onSuccess: () => { toast.show({ message: approve ? 'Approved — the member was notified.' : 'Rejected — the member was notified.' }); onClose(); },
      onError: e => toast.show({ type: 'error', message: apiErrorText(e) }),
    });
  };

  return (
    <BottomSheet visible={!!r} onClose={onClose} title={r ? `${TYPE_LABEL[r.type]} request` : ''}>
      {r && (
        <ScrollView style={{ maxHeight: 620 }} contentContainerStyle={{ padding: SP.xl, gap: SP.sm }} keyboardShouldPersistTaps="handled">
          <InfoRow icon="user" label="Member" value={r.memberName ?? `#${r.memberId}`} />
          <InfoRow icon="credit-card" label="Plan" value={`${r.planName ?? '—'}${r.membershipStatus ? ` (${r.membershipStatus})` : ''}`} />
          <InfoRow icon="calendar" label={r.type === 'freeze' ? 'Pause' : r.type === 'cancel' ? 'Last day' : 'Takes effect'} value={summary(r)} />
          {r.fee > 0 && <InfoRow icon="file-text" label="Invoice on approval" value={money(r.fee, r.currency)} />}
          {!!r.reasonCode && <InfoRow icon="tag" label="Reason" value={r.reasonCode.replace(/_/g, ' ')} />}
          {!!r.reason && <InfoRow icon="message-square" label="Member's note" value={r.reason} />}
          <InfoRow icon="send" label="Asked" value={day(r.requestedAt)} />
          {r.status !== 'pending' && <InfoRow icon="user-check" label={STATUS_TEXT[r.status]} value={`${r.decidedByName ?? (r.autoApproved ? 'Automatically' : '')} ${day(r.decidedAt)}`.trim()} />}
          {!!r.decisionNote && <InfoRow icon="message-circle" label="Decision note" value={r.decisionNote} />}
          {onOpenMember && <PrimaryButton label="Open member" icon="user" variant="secondary" onPress={() => { onClose(); onOpenMember(r.memberId); }} />}
          {r.status === 'pending' && (
            <>
              <Field label="Note to the member" value={note} onChangeText={t => { setNote(t); setNoteError(undefined); }} multiline
                placeholder="Optional when approving, required when rejecting" error={noteError} />
              <PrimaryButton label="Approve" icon="check" loading={decide.isPending && decide.variables?.approve} disabled={decide.isPending} onPress={() => go(true)} />
              <PrimaryButton label="Reject" icon="x" variant="danger" loading={decide.isPending && !decide.variables?.approve} disabled={decide.isPending} onPress={() => go(false)} />
              <Text style={{ color: T.textFaint, fontSize: 12 }}>Approving applies the pause / cancellation / plan change on its date and raises any invoice shown above.</Text>
            </>
          )}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

const num = (s: string) => { const n = Number(s.replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };

function RulesSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const toast = useToast();
  const q = useMembershipRules();
  const save = useSaveMembershipRules();
  const [s, setS] = useState<MembershipRulesSettings | null>(null);
  useEffect(() => { if (visible && q.data) setS(q.data); }, [visible, q.data]);
  const set = <K extends keyof MembershipRulesSettings>(k: K, v: MembershipRulesSettings[K]) => setS(x => (x ? { ...x, [k]: v } : x));
  const approval = (k: 'freezeApproval' | 'cancelApproval' | 'changeApproval', label: string) => s && (
    <SwitchRow label={`${label}: approve automatically`} value={s[k] === 'auto'} onValueChange={v => set(k, v ? 'auto' : 'staff')}
      description={s[k] === 'auto' ? 'Approved at once when within the rules.' : 'Waits for staff approval.'} />
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Membership rules" leftAction={{ label: 'Cancel', onPress: onClose }}>
      {!s ? <LoadingState label="Loading rules" /> : (
        <ScrollView style={{ maxHeight: 680 }} contentContainerStyle={{ padding: SP.xl }} keyboardShouldPersistTaps="handled">
          <Text style={{ color: T.textSub, fontSize: 13, marginBottom: SP.md }}>Members see these terms before they join, pause or cancel. The server enforces them.</Text>
          <Field label="Minimum term (months)" value={String(s.minimumTermMonths)} onChangeText={t => set('minimumTermMonths', num(t))} keyboardType="number-pad" />
          <Field label="Notice to cancel (days)" value={String(s.noticeDays)} onChangeText={t => set('noticeDays', num(t))} keyboardType="number-pad" />
          <Field label="Pause allowance (days per year, 0 = off)" value={String(s.maxFreezeDaysPerYear)} onChangeText={t => set('maxFreezeDaysPerYear', num(t))} keyboardType="number-pad" />
          <Field label="Shortest pause (days)" value={String(s.minFreezeDays)} onChangeText={t => set('minFreezeDays', num(t))} keyboardType="number-pad" />
          <Field label="Pause fee" value={String(s.freezeFee)} onChangeText={t => set('freezeFee', num(t))} keyboardType="decimal-pad" />
          <Field label="Cancellation fee" value={String(s.cancellationFee)} onChangeText={t => set('cancellationFee', num(t))} keyboardType="decimal-pad" />
          <Field label="Tax on online memberships (%)" value={String(s.taxPercent)} onChangeText={t => set('taxPercent', num(t))} keyboardType="decimal-pad" />
          <Field label="Latest start date (days ahead)" value={String(s.maxStartDaysAhead)} onChangeText={t => set('maxStartDaysAhead', num(t))} keyboardType="number-pad" />
          <SwitchRow label="Members can join online" value={s.allowOnlineJoin} onValueChange={v => set('allowOnlineJoin', v)} />
          <SwitchRow label="Members can ask to cancel in the app" value={s.allowSelfCancel} onValueChange={v => set('allowSelfCancel', v)} />
          {approval('freezeApproval', 'Pauses')}
          {approval('cancelApproval', 'Cancellations')}
          {approval('changeApproval', 'Plan changes')}
          <PrimaryButton label="Save rules" icon="check" loading={save.isPending} onPress={() => save.mutate(s, {
            onSuccess: () => { toast.show({ message: 'Rules saved.' }); onClose(); },
            onError: e => toast.show({ type: 'error', message: apiErrorText(e) }),
          })} />
        </ScrollView>
      )}
    </BottomSheet>
  );
}
