import React, { useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import { describeApiError } from '../../../api/apiError';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import PrimaryButton from '../../common/components/PrimaryButton';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../common/components/EmptyState';
import StatusPill from '../../common/components/StatusPill';
import RazorpayNativeModal from '../../member-billing/payments/RazorpayNativeModal';
import { useInvoiceCheckout } from '../../member-billing/hooks/useInvoiceCheckout';
import { useMyMembership } from '../api/selfServiceQueries';
import { MembershipRequest } from '../api/selfService.types';
import RequestSheets from '../components/RequestSheets';
import { Card, InfoRow, Notice, SectionTitle, STATUS_LABEL, STATUS_TONE, TYPE_LABEL, day, money, perCycle, rulesSummary } from '../components/SelfServiceUi';

interface Props {
  userId: number;
  onBack?: () => void;
  onBrowsePlans: () => void;
  onOpenRequest: (id: number) => void;
  onOpenBilling?: () => void;
}

/** My membership: current plan + dates, what the rules mean for me, and Pause / Change / Cancel. */
export default function MyMembershipScreen({ userId, onBack, onBrowsePlans, onOpenRequest, onOpenBilling }: Props) {
  const { hPad } = useLayout();
  const q = useMyMembership();
  const [sheet, setSheet] = useState<'freeze' | 'cancel' | 'change' | null>(null);
  const { pay, payingId, verifying, nativeModalProps } = useInvoiceCheckout(userId, { onPaid: () => q.refetch() });

  const onCreated = (r: MembershipRequest) => { setSheet(null); onOpenRequest(r.id); };

  const body = () => {
    if (q.isLoading) return <LoadingState label="Loading your membership" />;
    if (q.isError) return <EmptyState icon="wifi-off" tone="error" title="Couldn't load your membership" subtitle={describeApiError(q.error).message} action={{ label: 'Try again', onPress: () => q.refetch() }} />;
    const d = q.data!;
    const m = d.current;
    if (!m) {
      return (
        <EmptyState icon="credit-card" title="No membership yet"
          subtitle={d.rules.allowOnlineJoin ? 'Pick a plan and join in a couple of minutes.' : 'Visit the front desk to join.'}
          action={d.rules.allowOnlineJoin ? { label: 'Choose your membership', onPress: onBrowsePlans } : undefined} />
      );
    }
    const pending = m.status.toLowerCase() === 'pending';
    const paused = m.status.toLowerCase() === 'paused';
    return (
      <View style={{ gap: SP.xl }}>
        <Card accent={pending || paused ? T.brandGold : T.brand}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SP.md }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' }}>Your plan</Text>
              <Text style={{ color: T.text, fontSize: 22, fontWeight: '800', marginTop: 4 }}>{m.planName}</Text>
              <Text style={{ color: T.textSub, fontSize: 13, marginTop: 2 }}>{money(m.price, m.currency)} {d.plan ? perCycle(d.plan.billingCycle) : ''}</Text>
            </View>
            <StatusPill label={pending ? 'Awaiting payment' : paused ? 'Paused' : m.status} tone={pending || paused ? 'warn' : 'ok'} dot />
          </View>
          <View style={{ marginTop: SP.md }}>
            <InfoRow icon="calendar" label="Started" value={day(m.startDate)} />
            <InfoRow icon={m.autoRenew ? 'refresh-cw' : 'flag'} label={m.autoRenew ? 'Renews' : 'Ends'} value={day(m.endDate)} />
          </View>
        </Card>

        {pending && d.pendingInvoice && (
          <Notice icon="credit-card" tone={T.brandGold} title="Finish joining">
            {`Your membership starts once invoice ${d.pendingInvoice.invoiceNo} (${money(d.pendingInvoice.balance, d.pendingInvoice.currency)}) is paid${d.onlinePayments ? '.' : ' at the front desk.'}`}
          </Notice>
        )}
        {pending && d.pendingInvoice && d.onlinePayments && (
          <PrimaryButton label={`Pay ${money(d.pendingInvoice.balance, d.pendingInvoice.currency)}`} icon="lock"
            loading={payingId !== null || verifying} disabled={payingId !== null || verifying} onPress={() => pay(d.pendingInvoice!)} />
        )}

        {d.openRequests.length > 0 && (
          <View>
            <SectionTitle>Your requests</SectionTitle>
            <View style={{ gap: SP.sm }}>
              {d.openRequests.map(r => (
                <Pressable key={r.id} onPress={() => onOpenRequest(r.id)} accessibilityRole="button"
                  accessibilityLabel={`${TYPE_LABEL[r.type]} request, ${STATUS_LABEL[r.status]}`}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 56, padding: SP.md, borderRadius: R.lg,
                    borderWidth: 1, borderColor: T.line, backgroundColor: pressed ? T.bgInputActive : T.bgInput })}>
                  <Feather name={r.type === 'freeze' ? 'pause-circle' : r.type === 'cancel' ? 'x-circle' : 'repeat'} size={18} color={T.textSub} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>{TYPE_LABEL[r.type]}</Text>
                    <Text style={{ color: T.textSub, fontSize: 12 }}>
                      {r.type === 'freeze' ? `${day(r.effectiveFrom)} – ${day(r.effectiveTo)}` : r.type === 'cancel' ? `Last day ${day(r.effectiveFrom)}` : `${r.newPlanName ?? 'New plan'} from ${day(r.effectiveFrom)}`}
                    </Text>
                  </View>
                  <StatusPill label={STATUS_LABEL[r.status]} tone={STATUS_TONE[r.status]} />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {!pending && (
          <View style={{ gap: SP.sm }}>
            <SectionTitle>Manage</SectionTitle>
            {d.canChangePlan && <PrimaryButton label="Change plan" icon="repeat" variant="secondary" onPress={() => setSheet('change')} />}
            {d.canFreeze && <PrimaryButton label="Pause membership" icon="pause-circle" variant="secondary" onPress={() => setSheet('freeze')} />}
            {!d.canFreeze && !paused && d.rules.maxFreezeDaysPerYear > 0 && (
              <Text style={{ color: T.textFaint, fontSize: 12 }}>
                {d.freezeDaysLeftThisYear < d.rules.minFreezeDays ? `You've used your pause days for this year (${d.freezeDaysUsedThisYear} of ${d.rules.maxFreezeDaysPerYear}).` : 'A pause is already booked.'}
              </Text>
            )}
            {d.canCancel && <PrimaryButton label="Cancel membership" icon="x-circle" variant="danger" onPress={() => setSheet('cancel')} />}
            {!d.rules.allowSelfCancel && <Text style={{ color: T.textFaint, fontSize: 12 }}>To cancel, please speak to the front desk.</Text>}
          </View>
        )}

        <Card>
          <Text style={{ color: T.text, fontSize: 15, fontWeight: '800', marginBottom: 4 }}>Your gym's terms</Text>
          {rulesSummary(d.rules, m.currency).map(r => <InfoRow key={r.label} icon={r.icon} label={r.label} value={r.value} />)}
          {d.rules.maxFreezeDaysPerYear > 0 && <InfoRow icon="pause" label="Pause days left this year" value={`${d.freezeDaysLeftThisYear}`} tone={T.brand} />}
        </Card>

        {onOpenBilling && <PrimaryButton label="Invoices & payments" icon="file-text" variant="secondary" onPress={onOpenBilling} />}

        <RequestSheets kind={sheet} userId={userId} data={d} onClose={() => setSheet(null)} onSwitch={setSheet} onCreated={onCreated} />
      </View>
    );
  };

  return (
    <Screen>
      <ScreenHeader title="My membership" onBack={onBack} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: hPad, paddingTop: SP.sm, paddingBottom: 120, width: '100%', maxWidth: 640, alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} tintColor={T.brand} />}>
        {body()}
      </ScrollView>
      {Platform.OS !== 'web' && <RazorpayNativeModal {...nativeModalProps} />}
    </Screen>
  );
}
