import React, { useEffect, useState } from 'react';
import { Text, ScrollView, RefreshControl, Linking, View } from 'react-native';
import { T, SP } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import PrimaryButton from '../../common/components/PrimaryButton';
import Skeleton from '../../common/components/Skeleton';
import { useToast } from '../../common/components/Toast';
import { Field } from '../../common/components/FormFields';
import { useApiAccess } from '../../access/context/AccessContext';
import { apiErrorText } from '../../../api/apiError';
import { useAdminOrder, useSetOrderStatus } from '../api/adminQueries';
import { ShopOrder, ShopOrderStatus } from '../api/shop.types';
import { ORDER_STATUS_LABEL } from '../common/format';
import OrderView from './components/OrderView';
import { Card, ConfirmSheet, ErrorView, Eyebrow, SmallButton } from './components/kit';
import { ShopNav } from './nav';

const NEXT: Partial<Record<ShopOrderStatus, ShopOrderStatus>> = {
  Pending: 'Confirmed', Confirmed: 'Processing', Processing: 'Shipped', Shipped: 'OutForDelivery', OutForDelivery: 'Delivered',
};
const CANCELLABLE: ShopOrderStatus[] = ['Pending', 'Confirmed', 'Processing'];

export default function OrderDetailScreen({ orderNumber, nav, onBack }: { orderNumber: string; nav: ShopNav; onBack: () => void }) {
  const { data: order, isPending, isError, error, refetch, isRefetching } = useAdminOrder(orderNumber);
  return (
    <Screen>
      <ScreenHeader eyebrow="Orders" title={`Order #${orderNumber}`} onBack={onBack} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={T.brand} colors={[T.brand]} />}
      >
        {isPending ? <Skeleton rows={4} height={140} />
          : isError || !order ? <ErrorView error={error} onRetry={refetch} />
          : <OrderView order={order} aside={<><CustomerCard order={order} nav={nav} /><StatusPanel order={order} /></>} />}
      </ScrollView>
    </Screen>
  );
}

function CustomerCard({ order, nav }: { order: ShopOrder; nav: ShopNav }) {
  return (
    <Card>
      <Eyebrow>Customer</Eyebrow>
      <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>{order.customerName ?? order.shippingAddress.fullName}</Text>
      {!!order.customerEmail && <Text selectable style={{ color: T.textSub, fontSize: 13 }}>{order.customerEmail}</Text>}
      {!!order.customerPhone && <Text selectable style={{ color: T.textSub, fontSize: 13 }}>{order.customerPhone}</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, marginTop: SP.md }}>
        {!!order.customerPhone && <SmallButton label="Call" icon="phone" onPress={() => Linking.openURL(`tel:${order.customerPhone}`)} />}
        {!!order.customerEmail && <SmallButton label="Email" icon="mail" onPress={() => Linking.openURL(`mailto:${order.customerEmail}`)} />}
        {!!order.customerId && nav.can('customers') && <SmallButton label="Profile" icon="user" onPress={() => nav.openCustomer(order.customerId!)} />}
      </View>
    </Card>
  );
}

function StatusPanel({ order }: { order: ShopOrder }) {
  const { canEdit } = useApiAccess('shop');
  const update = useSetOrderStatus();
  const toast = useToast();
  const [tracking, setTracking] = useState(order.trackingNumber ?? '');
  const [cancelling, setCancelling] = useState(false);
  // Stays mounted across status changes (so the success toast fires); refresh the tracking field instead.
  useEffect(() => { setTracking(order.trackingNumber ?? ''); }, [order.status, order.trackingNumber]);
  const next = NEXT[order.status];
  const fail = (e: unknown) => toast.show({ type: 'error', message: apiErrorText(e) });

  if (!canEdit) return null;

  return (
    <Card>
      <Eyebrow>Next step</Eyebrow>
      {next ? (
        <>
          {next === 'Shipped' && (
            <Field label="Courier tracking number (optional)" value={tracking} onChangeText={setTracking} autoCapitalize="characters" autoCorrect={false} />
          )}
          <PrimaryButton
            label={`Mark as ${ORDER_STATUS_LABEL[next].toLowerCase()}`}
            loading={update.isPending && update.variables?.status === next}
            disabled={update.isPending}
            onPress={() => update.mutate(
              { orderNumber: order.orderNumber, status: next, trackingNumber: next === 'Shipped' ? tracking.trim() || null : undefined },
              { onSuccess: () => toast.show({ message: `Order marked as ${ORDER_STATUS_LABEL[next].toLowerCase()}` }), onError: fail },
            )}
          />
        </>
      ) : (
        <Text style={{ color: T.textSub, fontSize: 14 }}>This order is {ORDER_STATUS_LABEL[order.status].toLowerCase()}. No further steps.</Text>
      )}
      {CANCELLABLE.includes(order.status) && (
        <PrimaryButton label="Cancel order" variant="danger" onPress={() => setCancelling(true)} disabled={update.isPending} style={{ marginTop: SP.md }} />
      )}
      <ConfirmSheet
        visible={cancelling}
        onClose={() => setCancelling(false)}
        title={`Cancel order #${order.orderNumber}?`}
        message="Items go back into stock and the member sees the order as cancelled. Refund any prepaid amount through your payment provider."
        confirmLabel="Cancel order"
        loading={update.isPending}
        onConfirm={() => update.mutate({ orderNumber: order.orderNumber, status: 'Cancelled' }, {
          onSuccess: () => toast.show({ message: 'Order cancelled · items restocked' }),
          onError: fail,
          onSettled: () => setCancelling(false),
        })}
      />
    </Card>
  );
}
