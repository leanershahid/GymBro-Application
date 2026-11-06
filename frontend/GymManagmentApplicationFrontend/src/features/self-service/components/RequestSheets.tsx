import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { T, SP } from '../../../theme';
import { apiErrorText, describeApiError } from '../../../api/apiError';
import BottomSheet from '../../common/components/BottomSheet';
import PrimaryButton from '../../common/components/PrimaryButton';
import LoadingState from '../../common/components/LoadingState';
import ChipSelect from '../../common/components/ChipSelect';
import { Field } from '../../common/components/FormFields';
import { DateField } from '../../common/components/DatePicker';
import { useToast } from '../../common/components/Toast';
import { useCreateRequest, usePlanCatalog, useRequestPreview } from '../api/selfServiceQueries';
import { MembershipRequest, MyMembership, RequestPayload, RequestPreview } from '../api/selfService.types';
import { ChoiceRow, InfoRow, Notice, PriceBreakdown, addDays, day, money, perCycle, todayIso } from './SelfServiceUi';

type Kind = 'freeze' | 'cancel' | 'change';

interface Props {
  kind: Kind | null;
  userId: number;
  data: MyMembership;
  onClose: () => void;
  /** Cancel's retention step: switch to the pause sheet. */
  onSwitch: (kind: Kind) => void;
  onCreated: (r: MembershipRequest) => void;
}

const CANCEL_REASONS = [
  { value: 'moving', label: 'Moving away' },
  { value: 'price', label: 'Too expensive' },
  { value: 'time', label: 'No time' },
  { value: 'injury', label: 'Injury / health' },
  { value: 'not_using', label: 'Not using it' },
  { value: 'other_gym', label: 'Joining another gym' },
  { value: 'other', label: 'Something else' },
];

/** Pause / cancel / change-plan sheets: pick → preview (server) → confirm. */
export default function RequestSheets({ kind, userId, data, onClose, onSwitch, onCreated }: Props) {
  const title = kind === 'freeze' ? 'Pause membership' : kind === 'cancel' ? 'Cancel membership' : 'Change plan';
  return (
    <BottomSheet visible={!!kind} onClose={onClose} title={title}>
      <ScrollView style={{ maxHeight: 680 }} contentContainerStyle={{ padding: SP.xl, gap: SP.md }} keyboardShouldPersistTaps="handled">
        {kind === 'freeze' && <PauseForm userId={userId} data={data} onCreated={onCreated} />}
        {kind === 'cancel' && <CancelForm userId={userId} data={data} onCreated={onCreated} onPauseInstead={() => onSwitch('freeze')} />}
        {kind === 'change' && <ChangeForm userId={userId} data={data} onCreated={onCreated} />}
      </ScrollView>
    </BottomSheet>
  );
}

function PreviewBlock({ preview, loading, error }: { preview?: RequestPreview; loading: boolean; error: unknown }) {
  if (error) return <Notice icon="alert-triangle" tone={T.err}>{describeApiError(error).message}</Notice>;
  if (loading || !preview) return <LoadingState label="Checking the rules" />;
  return (
    <View style={{ gap: SP.md }}>
      {!preview.allowed && !!preview.problem && <Notice icon="alert-circle" tone={T.err} title="Not possible">{preview.problem}</Notice>}
      {preview.allowed && <Notice icon="info" tone={T.sky} title="What happens">{preview.summary}</Notice>}
      {preview.allowed && preview.lines.length > 0 && (
        <PriceBreakdown lines={preview.lines} total={preview.lines.reduce((a, l) => a + l.amount, 0)} currency={preview.currency} totalLabel="You'll be invoiced" />
      )}
      {preview.allowed && preview.needsApproval && (
        <Text style={{ color: T.textFaint, fontSize: 12 }}>The gym reviews this request. You'll get a notification when they decide, and you can withdraw it until then.</Text>
      )}
    </View>
  );
}

function useSubmit(userId: number, onCreated: (r: MembershipRequest) => void) {
  const toast = useToast();
  const create = useCreateRequest(userId);
  const submit = (p: RequestPayload) => {
    if (create.isPending) return;
    create.mutate(p, {
      onSuccess: r => {
        toast.show({ type: 'success', message: r.status === 'approved' ? 'Done — approved.' : 'Request sent to the gym.' });
        onCreated(r);
      },
      onError: e => toast.show({ type: 'error', message: apiErrorText(e), durationMs: 6000 }),
    });
  };
  return { submit, busy: create.isPending };
}

// ── Pause ──────────────────────────────────────────────────────────────────

function PauseForm({ userId, data, onCreated }: { userId: number; data: MyMembership; onCreated: (r: MembershipRequest) => void }) {
  const r = data.rules;
  const [from, setFrom] = useState(addDays(todayIso(), 1));
  const [to, setTo] = useState(addDays(todayIso(), Math.max(r.minFreezeDays, 7)));
  const [reason, setReason] = useState('');
  const valid = from >= todayIso() && to >= from;
  const payload: RequestPayload | null = useMemo(() => (valid ? { type: 'freeze', from, to } : null), [valid, from, to]);
  const preview = useRequestPreview(payload);
  const { submit, busy } = useSubmit(userId, onCreated);
  const cur = data.current?.currency ?? 'INR';

  return (
    <>
      <InfoRow icon="pause-circle" label={`Pause days left in ${new Date().getFullYear()}`} value={`${data.freezeDaysLeftThisYear} of ${r.maxFreezeDaysPerYear}`} tone={T.brand} />
      <InfoRow icon="clock" label="Shortest pause" value={`${r.minFreezeDays} days`} />
      <InfoRow icon="tag" label="Fee per pause" value={r.freezeFee > 0 ? money(r.freezeFee, cur) : 'Free'} />
      <DateField label="First paused day" value={from} onChange={setFrom} minYear={new Date().getFullYear()} maxYear={new Date().getFullYear() + 1}
        error={from < todayIso() ? 'Pick today or later.' : undefined} />
      <DateField label="Last paused day" value={to} onChange={setTo} minYear={new Date().getFullYear()} maxYear={new Date().getFullYear() + 1}
        error={to < from ? 'Must be on or after the first day.' : undefined} />
      <Field label="Reason (optional)" value={reason} onChangeText={setReason} placeholder="e.g. travelling for work" />
      {payload && <PreviewBlock preview={preview.data} loading={preview.isLoading} error={preview.error} />}
      <PrimaryButton label={preview.data?.needsApproval ? 'Send pause request' : 'Pause my membership'} icon="pause-circle" loading={busy}
        disabled={!payload || !preview.data?.allowed || busy}
        onPress={() => payload && submit({ ...payload, reason: reason.trim() || undefined })} />
    </>
  );
}

// ── Cancel ─────────────────────────────────────────────────────────────────

function CancelForm({ userId, data, onCreated, onPauseInstead }: {
  userId: number; data: MyMembership; onCreated: (r: MembershipRequest) => void; onPauseInstead: () => void;
}) {
  const [reasonCode, setReasonCode] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [offered, setOffered] = useState(false);
  const preview = useRequestPreview({ type: 'cancel' });
  const { submit, busy } = useSubmit(userId, onCreated);
  const p = preview.data;
  const c = p?.cancel;
  const retention = !!p?.canPauseInstead && !offered && (reasonCode === 'time' || reasonCode === 'injury' || reasonCode === 'moving' || reasonCode === 'not_using' || reasonCode === null);

  return (
    <>
      {c && (
        <View>
          <InfoRow icon="calendar" label="Last day you can train" value={day(c.lastDay)} tone={T.brandGold} />
          {c.paidThrough && <InfoRow icon="check" label="Paid up to" value={day(c.paidThrough)} />}
          {c.noticeEnd && <InfoRow icon="bell" label={`Notice (${data.rules.noticeDays} days)`} value={`until ${day(c.noticeEnd)}`} />}
          {c.minimumTermEnd && <InfoRow icon="lock" label={`Minimum term (${data.rules.minimumTermMonths} months)`} value={`until ${day(c.minimumTermEnd)}`} />}
          <InfoRow icon="file-text" label="Final invoice" value={c.finalCharge > 0 ? money(c.finalCharge, c.currency) : 'Nothing to pay'} />
        </View>
      )}
      <ChipSelect label="Why are you leaving? (optional)" options={CANCEL_REASONS} value={reasonCode} onChange={setReasonCode} />
      <Field label="Anything else? (optional)" value={reason} onChangeText={setReason} multiline />
      <PreviewBlock preview={p} loading={preview.isLoading} error={preview.error} />
      {retention && p?.allowed && (
        <Notice icon="pause-circle" tone={T.brand} title="Pause instead?">
          {`You can pause for up to ${p.freezeDaysLeft} days this year and keep your plan and price. Your end date moves back by the paused days.`}
        </Notice>
      )}
      {retention && p?.allowed ? (
        <>
          <PrimaryButton label="Pause instead" icon="pause-circle" onPress={onPauseInstead} />
          <PrimaryButton label="No thanks, continue cancelling" variant="secondary" onPress={() => setOffered(true)} />
        </>
      ) : (
        <PrimaryButton label={p?.needsApproval ? 'Send cancellation request' : 'Cancel my membership'} icon="x-circle" variant="danger"
          loading={busy} disabled={!p?.allowed || busy}
          onPress={() => submit({ type: 'cancel', reasonCode: reasonCode ?? undefined, reason: reason.trim() || undefined })} />
      )}
    </>
  );
}

// ── Change plan ────────────────────────────────────────────────────────────

function ChangeForm({ userId, data, onCreated }: { userId: number; data: MyMembership; onCreated: (r: MembershipRequest) => void }) {
  const catalog = usePlanCatalog();
  const [planId, setPlanId] = useState<number | null>(null);
  const options = (catalog.data?.plans ?? []).filter(p => !p.isCurrent && p.id !== data.current?.planId);
  useEffect(() => { if (planId && !options.some(o => o.id === planId)) setPlanId(null); }, [options, planId]);
  const preview = useRequestPreview(planId ? { type: 'change', newPlanId: planId } : null);
  const { submit, busy } = useSubmit(userId, onCreated);
  const p = preview.data;

  if (catalog.isLoading) return <LoadingState label="Loading plans" />;
  return (
    <>
      <Text style={{ color: T.textSub, fontSize: 14, lineHeight: 20 }}>
        You're on <Text style={{ color: T.text, fontWeight: '700' }}>{data.current?.planName}</Text>. Upgrades start today (you pay the difference for the days left); downgrades start at your next renewal.
      </Text>
      {options.length === 0 && <Notice icon="info" tone={T.sky}>There are no other plans to switch to right now.</Notice>}
      <View accessibilityRole="radiogroup" style={{ gap: SP.sm }}>
        {options.map(o => (
          <ChoiceRow key={o.id} selected={o.id === planId} onPress={() => setPlanId(o.id)} title={o.name}
            subtitle={`${money(o.price, o.currency)} ${perCycle(o.billingCycle)}`} icon={o.isPopular ? 'star' : 'credit-card'} />
        ))}
      </View>
      {planId && <PreviewBlock preview={p} loading={preview.isLoading} error={preview.error} />}
      {planId && (
        <PrimaryButton
          label={p?.changeKind === 'upgrade' ? `Upgrade to ${p.newPlanName}` : p?.changeKind === 'downgrade' ? `Switch at renewal` : 'Confirm'}
          icon="repeat" loading={busy} disabled={!p?.allowed || busy}
          onPress={() => submit({ type: 'change', newPlanId: planId })} />
      )}
    </>
  );
}
