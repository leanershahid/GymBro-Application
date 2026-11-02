// Order detail (items, address, payment, totals, tracking timeline) — the same view members get,
// with an optional `aside` (the admin status panel) rendered after the timeline.
import React from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, withAlpha } from '../../../../theme';
import StatusPill from '../../../common/components/StatusPill';
import { useToast } from '../../../common/components/Toast';
import { ShopOrder } from '../../api/shop.types';
import { formatDate, formatMoney, ORDER_STATUS_LABEL } from '../../common/format';
import { Card, Eyebrow, IconButton, InfoRow, STATUS_TONE, Thumb, copyText } from './kit';

const PAYMENT_LABEL: Record<string, string> = { CashOnDelivery: 'Cash on delivery', Card: 'Credit / debit card', Upi: 'UPI' };

export const formatDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';

export function OrderTimeline({ timeline }: { timeline: ShopOrder['timeline'] }) {
  const lastDone = timeline.reduce((acc, t, i) => (t.completed ? i : acc), -1);
  return (
    <View accessibilityLabel="Order progress">
      {timeline.map((e, i) => {
        const done = e.completed;
        const cancelled = e.status === 'Cancelled';
        const current = i === lastDone + 1 && !cancelled;
        const isLast = i === timeline.length - 1;
        const c = cancelled ? T.err : T.brand;
        return (
          <View key={`${e.status}-${done}`} style={{ flexDirection: 'row', gap: SP.md }}
            accessible accessibilityLabel={`${ORDER_STATUS_LABEL[e.status]}: ${done ? formatDateTime(e.at) || 'done' : current ? 'in progress' : 'pending'}`}>
            <View style={{ alignItems: 'center', width: 32 }}>
              <View style={{
                width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2,
                borderColor: done || current ? c : T.line, backgroundColor: done ? c : T.bg,
              }}>
                {done
                  ? <Feather name={cancelled ? 'x' : 'check'} size={15} color={T.onBrand} />
                  : current ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: T.brand }} /> : null}
              </View>
              {!isLast && <View style={{ width: 2, flex: 1, minHeight: 18, backgroundColor: i < lastDone ? T.brand : T.line }} />}
            </View>
            <View style={{ flex: 1, paddingTop: 5, paddingBottom: isLast ? 0 : SP.lg }}>
              <Text style={{ color: cancelled ? T.err : done || current ? T.text : T.textFaint, fontSize: 14, fontWeight: '700' }}>
                {ORDER_STATUS_LABEL[e.status]}
              </Text>
              <Text style={{ color: T.textFaint, fontSize: 12 }}>{e.at ? formatDateTime(e.at) : current ? 'In progress' : 'Pending'}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function OrderView({ order, aside }: { order: ShopOrder; aside?: React.ReactNode }) {
  const toast = useToast();
  const a = order.shippingAddress;
  const copy = async (text: string, what: string) => { if (await copyText(text)) toast.show({ message: `${what} copied` }); };

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm, marginBottom: SP.lg, flexWrap: 'wrap' }}>
        <View style={{ flex: 1, minWidth: 180 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: T.text, fontSize: 20, fontWeight: '800' }}>#{order.orderNumber}</Text>
            <IconButton icon="copy" label="Copy order number" onPress={() => copy(order.orderNumber, 'Order number')} />
          </View>
          <Text style={{ color: T.textSub, fontSize: 13 }}>Placed {formatDateTime(order.placedAt)}</Text>
        </View>
        <StatusPill label={ORDER_STATUS_LABEL[order.status]} tone={STATUS_TONE[order.status]} dot />
      </View>

      <Card title={`${order.items.length} item${order.items.length === 1 ? '' : 's'}`} style={{ paddingBottom: SP.sm }}>
        {order.items.map((i, idx) => (
          <View key={i.id} style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingVertical: SP.sm, borderTopWidth: idx ? 1 : 0, borderTopColor: T.line }}>
            <Thumb uri={i.imageUrl} size={52} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={2} style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>{i.productName}</Text>
              <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 12 }}>{i.variantName} · {i.sku}</Text>
              <Text style={{ color: T.textSub, fontSize: 12 }}>{i.quantity} × {formatMoney(i.unitPrice)}</Text>
            </View>
            <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>{formatMoney(i.lineTotal)}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <Eyebrow>Delivery address</Eyebrow>
        <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>{a.fullName}</Text>
        <Text style={{ color: T.textSub, fontSize: 14, lineHeight: 20 }}>
          {a.line1}{a.line2 ? `\n${a.line2}` : ''}{`\n${a.city}, ${a.state} ${a.postalCode}`}{`\n${a.phone}`}
        </Text>
        {!!order.notes && <Text style={{ color: T.textFaint, fontSize: 13, marginTop: SP.sm }}>Note: {order.notes}</Text>}
      </Card>

      <Card>
        <Eyebrow>Payment</Eyebrow>
        {order.payment ? (
          <>
            <InfoRow label="Method" value={PAYMENT_LABEL[order.payment.method] ?? order.payment.method} />
            <InfoRow label="Status" value={order.payment.status} tone={order.payment.status === 'Paid' ? T.ok : order.payment.status === 'Failed' ? T.err : undefined} />
            {!!order.payment.transactionReference && <InfoRow label="Reference" value={order.payment.transactionReference} />}
          </>
        ) : <InfoRow label="Method" value="—" />}
        <View style={{ height: 1, backgroundColor: T.line, marginVertical: SP.sm }} />
        <InfoRow label="Subtotal" value={formatMoney(order.subtotal)} />
        {order.discount > 0 && <InfoRow label={`Discount${order.couponCode ? ` (${order.couponCode})` : ''}`} value={`−${formatMoney(order.discount)}`} tone={T.ok} />}
        <InfoRow label={`Delivery (${order.deliveryMethod})`} value={order.shipping === 0 ? 'Free' : formatMoney(order.shipping)} />
        <InfoRow label="GST" value={formatMoney(order.tax)} />
        <View style={{ height: 1, backgroundColor: T.line, marginVertical: SP.sm }} />
        <InfoRow label="Total" value={formatMoney(order.total)} strong />
      </Card>

      <Card>
        <Eyebrow>Tracking</Eyebrow>
        {!!order.estimatedDelivery && order.status !== 'Cancelled' && order.status !== 'Delivered' && (
          <Text style={{ color: T.textSub, fontSize: 13, marginBottom: SP.sm }}>Expected by {formatDate(order.estimatedDelivery)}</Text>
        )}
        {!!order.trackingNumber && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SP.sm, backgroundColor: withAlpha(T.text, 0.04), borderRadius: 10, paddingLeft: SP.md }}>
            <Text style={{ flex: 1, color: T.textSub, fontSize: 13 }}>AWB {order.trackingNumber}</Text>
            <IconButton icon="copy" label="Copy tracking number" onPress={() => copy(order.trackingNumber!, 'Tracking number')} />
          </View>
        )}
        <OrderTimeline timeline={order.timeline} />
      </Card>

      {aside}
    </View>
  );
}
