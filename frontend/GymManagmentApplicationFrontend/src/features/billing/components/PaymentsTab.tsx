import React, { useState } from 'react';
import { View, Text, FlatList, RefreshControl, Alert } from 'react-native';
import StatusPill from '../../common/components/StatusPill';
import LoadingState from '../../common/components/LoadingState';
import PaginationFooter from '../../common/components/PaginationFooter';
import BottomSheet from '../../common/components/BottomSheet';
import PrimaryButton from '../../common/components/PrimaryButton';
import { useToast } from '../../common/components/Toast';
import EmptyState from '../../dashboard/components/EmptyState';
import { Field } from '../../trainers/components/FormFields';
import { describeApiError, apiErrorText } from '../../../api/apiError';
import { usePaymentHistory, useRefundPayment } from '../api/billingQueries';
import { Payment } from '../types/billing.types';
import { ListRow, KeyValue, fmtMoney, fmtDate, paymentTone, toNumber, round2 } from './billingUi';
import { humanize } from '../../exercises/components/ChipSelect';
import { T, SP } from '../../../theme';

const PAGE_SIZE = 20;

export default function PaymentsTab({ memberId }: { memberId?: number }) {
  const [page, setPage] = useState(1);
  const [refunding, setRefunding] = useState<Payment | null>(null);
  const { data, isLoading, error, refetch, isRefetching } = usePaymentHistory(memberId, page, PAGE_SIZE);

  if (isLoading) return <LoadingState label="Loading payments…" />;
  if (error) {
    return (
      <EmptyState icon="alert-triangle" tone="error" title="Couldn't load payments"
        subtitle={describeApiError(error).message} action={{ label: 'Try again', onPress: () => refetch() }} />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={data?.items ?? []}
        keyExtractor={p => String(p.id)}
        contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: SP.xxl }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={T.brand} />}
        ListEmptyComponent={<EmptyState icon="credit-card" title="No payments yet" subtitle="Desk and online payments show up here." />}
        renderItem={({ item }) => {
          const refundable = item.status.toLowerCase() === 'completed' && item.amount - item.refundedAmount > 0;
          return (
            <ListRow
              title={item.memberName ?? `Member #${item.memberId}`}
              subtitle={[
                fmtDate(item.paidAt), humanize(item.method), item.invoiceNo,
                item.refundedAmount > 0 ? `Refunded ${fmtMoney(item.refundedAmount, item.currency)}` : null,
              ].filter(Boolean).join(' · ')}
              amount={fmtMoney(item.amount, item.currency)}
              pill={<StatusPill label={item.status} tone={paymentTone(item.status)} />}
              onPress={refundable ? () => setRefunding(item) : undefined}
              accessibilityLabel={refundable ? `Refund payment from ${item.memberName ?? 'member'}` : undefined}
            />
          );
        }}
        ListFooterComponent={
          (data?.totalPages ?? 0) > 1 ? <PaginationFooter page={page} totalPages={data!.totalPages} onChange={setPage} /> : null
        }
      />
      <RefundSheet payment={refunding} onClose={() => setRefunding(null)} />
    </View>
  );
}

function RefundSheet({ payment, onClose }: { payment: Payment | null; onClose: () => void }) {
  const toast = useToast();
  const refund = useRefundPayment();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | undefined>();
  const remaining = payment ? round2(payment.amount - payment.refundedAmount) : 0;

  React.useEffect(() => {
    setAmount(payment ? String(round2(payment.amount - payment.refundedAmount)) : '');
    setReason(''); setError(undefined);
  }, [payment?.id]);

  const submit = () => {
    if (!payment) return;
    const amt = toNumber(amount);
    if (amt <= 0) return setError('Enter an amount above zero.');
    if (amt > remaining + 0.001) return setError(`At most ${fmtMoney(remaining, payment.currency)} can be refunded.`);
    const doIt = () => refund.mutate(
      { paymentId: payment.id, amount: amt >= remaining ? undefined : amt, reason },
      {
        onSuccess: () => { toast.show({ message: `Refunded ${fmtMoney(amt, payment.currency)}.` }); onClose(); },
        onError: e => Alert.alert('Refund failed', apiErrorText(e)),
      },
    );
    Alert.alert('Refund payment?', `Refund ${fmtMoney(amt, payment.currency)} to ${payment.memberName ?? 'the member'}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Refund', style: 'destructive', onPress: doIt },
    ]);
  };

  return (
    <BottomSheet visible={!!payment} onClose={onClose} title="Refund payment" leftAction={{ label: 'Cancel', onPress: onClose }}>
      {payment && (
        <View style={{ padding: SP.xl }}>
          <KeyValue label="Member" value={payment.memberName ?? `#${payment.memberId}`} />
          <KeyValue label="Paid" value={`${fmtMoney(payment.amount, payment.currency)} · ${humanize(payment.method)}`} />
          {payment.refundedAmount > 0 && <KeyValue label="Already refunded" value={fmtMoney(payment.refundedAmount, payment.currency)} />}
          <Text style={{ color: T.textFaint, fontSize: 12, marginVertical: SP.sm }}>
            Online (Razorpay) payments are refunded to the member's card/UPI; desk payments are only recorded as refunded.
          </Text>
          <Field label={`Amount (${payment.currency})`} value={amount} onChangeText={v => { setAmount(v); setError(undefined); }}
            keyboardType="decimal-pad" error={error} />
          <Field label="Reason (optional)" value={reason} onChangeText={setReason} />
          <PrimaryButton label="Refund" icon="rotate-ccw" variant="danger" onPress={submit} loading={refund.isPending} />
        </View>
      )}
    </BottomSheet>
  );
}
