import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { T, SP } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import { apiErrorText, describeApiError } from '../../../api/apiError';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import PrimaryButton from '../../common/components/PrimaryButton';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../common/components/EmptyState';
import StatusPill from '../../common/components/StatusPill';
import { confirm } from '../../common/components/dialogs';
import { useToast } from '../../common/components/Toast';
import { useMyRequest, useWithdrawRequest } from '../api/selfServiceQueries';
import { Card, InfoRow, Notice, STATUS_LABEL, STATUS_TONE, TYPE_LABEL, day, money } from '../components/SelfServiceUi';

interface Props {
  userId: number;
  requestId: number;
  onBack: () => void;
  onOpenBilling?: () => void;
}

/** One pause / cancel / plan-change request: status, dates, fee, the gym's note; withdraw while pending. */
export default function MembershipRequestScreen({ userId, requestId, onBack, onOpenBilling }: Props) {
  const { hPad } = useLayout();
  const toast = useToast();
  const q = useMyRequest(requestId);
  const withdraw = useWithdrawRequest(userId);
  const r = q.data;

  const doWithdraw = async () => {
    if (!r || withdraw.isPending) return;
    const yes = await confirm({ title: `Withdraw this ${TYPE_LABEL[r.type].toLowerCase()} request?`, message: 'Nothing will change on your membership.', confirmLabel: 'Withdraw' });
    if (!yes) return;
    withdraw.mutate(r.id, {
      onSuccess: () => { toast.show({ message: 'Request withdrawn.' }); q.refetch(); },
      onError: e => toast.show({ type: 'error', message: apiErrorText(e) }),
    });
  };

  return (
    <Screen>
      <ScreenHeader title={r ? `${TYPE_LABEL[r.type]} request` : 'Request'} onBack={onBack} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: hPad, paddingTop: SP.sm, paddingBottom: 120, gap: SP.lg, width: '100%', maxWidth: 640, alignSelf: 'center' }}>
        {q.isLoading && <LoadingState label="Loading request" />}
        {q.isError && <EmptyState icon="alert-triangle" tone="error" title="Couldn't load this request" subtitle={describeApiError(q.error).message}
          action={{ label: 'Try again', onPress: () => q.refetch() }} />}
        {r && (
          <>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, marginBottom: SP.sm }}>
                <Text style={{ flex: 1, color: T.text, fontSize: 20, fontWeight: '800' }}>{r.planName}</Text>
                <StatusPill label={STATUS_LABEL[r.status]} tone={STATUS_TONE[r.status]} dot />
              </View>
              <InfoRow icon="send" label="Asked on" value={day(r.requestedAt)} />
              {r.type === 'freeze' && <InfoRow icon="pause-circle" label="Paused" value={`${day(r.effectiveFrom)} – ${day(r.effectiveTo)}`} />}
              {r.type === 'cancel' && <InfoRow icon="flag" label="Last day" value={day(r.effectiveFrom)} />}
              {r.type === 'change' && <InfoRow icon="repeat" label={`To ${r.newPlanName ?? 'new plan'}`} value={`from ${day(r.effectiveFrom)}`} />}
              {r.fee > 0 && <InfoRow icon="file-text" label="Charge" value={money(r.fee, r.currency)} />}
              {!!r.reason && <InfoRow icon="message-square" label="Your note" value={r.reason} />}
              {r.decidedAt && r.status !== 'withdrawn' && (
                <InfoRow icon="user-check" label={r.autoApproved ? 'Approved automatically' : `Decided${r.decidedByName ? ` by ${r.decidedByName}` : ''}`} value={day(r.decidedAt)} />
              )}
            </Card>
            {!!r.decisionNote && <Notice icon="message-circle" tone={r.status === 'rejected' ? T.err : T.sky} title="Note from the gym">{r.decisionNote}</Notice>}
            {r.status === 'pending' && <Notice icon="clock" tone={T.brandGold}>The gym will review this soon. You'll get a notification when they decide.</Notice>}
            {r.status === 'approved' && !r.appliedAt && (
              <Notice icon="calendar" tone={T.sky}>Approved — it takes effect on {day(r.effectiveFrom)}.</Notice>
            )}
            {r.invoiceId && onOpenBilling && <PrimaryButton label="View invoice" icon="file-text" variant="secondary" onPress={onOpenBilling} />}
            {r.status === 'pending' && (
              <PrimaryButton label="Withdraw request" icon="rotate-ccw" variant="secondary" loading={withdraw.isPending} onPress={doWithdraw} />
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
