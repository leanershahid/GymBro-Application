import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, FlatList } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R, withAlpha } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import PrimaryButton from '../../common/components/PrimaryButton';
import StatusPill, { PillTone } from '../../common/components/StatusPill';
import Skeleton from '../../common/components/Skeleton';
import EmptyState from '../../common/components/EmptyState';
import { useToast } from '../../common/components/Toast';
import { apiErrorText } from '../../../api/apiError';
import { ORDER_STATUS_LABEL, formatDate, formatMoney } from '../common/format';
import { ShopOrder, ShopOrderStatus, ShopOrderSummary } from '../api/shop.types';
import { useCancelOrder, useOrder, useOrders } from '../api/storeQueries';
import { useShopNav } from './shopNav';
import { addressLines } from './AddressesScreen';
import { ConfirmSheet, MoneyRow, PAYMENT_LABEL, ProductImage, canCopy, card, copyText, shortDay } from './ui';

const STATUS_TONE: Record<ShopOrderStatus, PillTone> = {
  Pending: 'warn', Confirmed: 'info', Processing: 'violet', Shipped: 'info', OutForDelivery: 'brand', Delivered: 'ok', Cancelled: 'err',
};
const STATUS_ICON: Record<ShopOrderStatus, React.ComponentProps<typeof Feather>['name']> = {
  Pending: 'shopping-bag', Confirmed: 'check-square', Processing: 'package', Shipped: 'truck', OutForDelivery: 'map-pin', Delivered: 'home', Cancelled: 'x-circle',
};

export function OrderStatusPill({ status }: { status: ShopOrderStatus }) {
  return <StatusPill label={ORDER_STATUS_LABEL[status] ?? status} tone={STATUS_TONE[status] ?? 'neutral'} dot />;
}

const canCancel = (s: ShopOrderStatus) => s === 'Pending' || s === 'Confirmed';

/** Order number with a copy button on web; selectable text on phones. */
function CopyValue({ value, label, big }: { value: string; label: string; big?: boolean }) {
  const toast = useToast();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.xs }}>
      <Text selectable style={{ color: T.text, fontSize: big ? 18 : 14, fontWeight: '800', letterSpacing: 0.5 }}>{value}</Text>
      {canCopy() && (
        <Pressable
          onPress={async () => toast.show(await copyText(value) ? { message: `${label} copied` } : { type: 'error', message: 'Couldn’t copy' })}
          accessibilityRole="button"
          accessibilityLabel={`Copy ${label.toLowerCase()}`}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Feather name="copy" size={16} color={T.brand} />
        </Pressable>
      )}
    </View>
  );
}

const paymentLine = (o: ShopOrder) =>
  !o.payment ? 'Payment pending'
    : o.payment.status === 'Paid' ? `Paid by ${PAYMENT_LABEL[o.payment.method]}`
    : o.payment.status === 'Refunded' ? `Refunded to ${PAYMENT_LABEL[o.payment.method]}`
    : o.payment.method === 'CashOnDelivery' ? 'Pay on delivery' : `${PAYMENT_LABEL[o.payment.method]} · ${o.payment.status}`;

// ── Confirmation ─────────────────────────────────────────────────────────

export function OrderConfirmedScreen({ orderNumber }: { orderNumber: string }) {
  const nav = useShopNav();
  const { hPad } = useLayout();
  const q = useOrder(orderNumber);
  const o = q.data;
  const first = o?.shippingAddress.fullName.trim().split(/\s+/)[0];

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingHorizontal: hPad, paddingTop: SP.xxl, paddingBottom: 60, gap: SP.xl }}>
        <View style={{ alignItems: 'center', gap: SP.md }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: T.okDim, borderWidth: 2, borderColor: withAlpha(T.ok, 0.4) }}>
            <Feather name="check" size={40} color={T.ok} />
          </View>
          <Text accessibilityRole="header" style={{ color: T.text, fontSize: 26, fontWeight: '800', textAlign: 'center' }}>
            Thank you{first ? `, ${first}` : ''}!
          </Text>
          <Text style={{ color: T.textSub, fontSize: 14, textAlign: 'center', maxWidth: 300 }}>Your order is placed. We’ll keep you posted as it moves.</Text>
        </View>

        {q.isPending && <Skeleton rows={2} height={90} borderRadius={R.lg} />}
        {q.isError && <EmptyState icon="alert-circle" tone="error" title="Couldn’t load the order details" action={{ label: 'Retry', onPress: () => q.refetch() }} />}
        {o && (
          <View style={[card, { padding: SP.lg, gap: SP.md }]}>
            <View>
              <Text style={{ color: T.textFaint, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>Order number</Text>
              <CopyValue value={o.orderNumber} label="Order number" big />
            </View>
            <Row icon="calendar" label="Estimated delivery" value={o.estimatedDelivery ? shortDay(o.estimatedDelivery) : `${o.deliveryMethod} delivery`} />
            <Row icon="credit-card" label="Payment" value={o.payment?.method === 'CashOnDelivery' && o.payment.status !== 'Paid' ? `Pay on delivery · ${formatMoney(o.total)}` : `Paid · ${formatMoney(o.total)}`} />
            <Row icon="map-pin" label="Delivering to" value={`${o.shippingAddress.fullName}, ${addressLines(o.shippingAddress)}`} />
          </View>
        )}

        <View style={{ gap: SP.sm }}>
          <PrimaryButton label="Continue shopping" onPress={() => nav.home('store')} />
          <PrimaryButton label="View order" variant="secondary" onPress={() => nav.replace({ id: 'order', orderNumber })} />
        </View>
      </ScrollView>
    </Screen>
  );
}

function Row({ icon, label, value }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: SP.md, alignItems: 'flex-start' }}>
      <Feather name={icon} size={16} color={T.brand} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: T.textFaint, fontSize: 12 }}>{label}</Text>
        <Text style={{ color: T.text, fontSize: 14, lineHeight: 20 }}>{value}</Text>
      </View>
    </View>
  );
}

// ── List ─────────────────────────────────────────────────────────────────

function OrderRow({ o }: { o: ShopOrderSummary }) {
  const nav = useShopNav();
  return (
    <Pressable
      onPress={() => nav.push({ id: 'order', orderNumber: o.orderNumber })}
      accessibilityRole="button"
      accessibilityLabel={`Order ${o.orderNumber}, ${ORDER_STATUS_LABEL[o.status]}, ${formatMoney(o.total)}`}
      style={({ pressed }) => [card, { padding: SP.lg, gap: SP.md, backgroundColor: pressed ? T.bgInputActive : T.bgInput }]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SP.sm }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: T.text, fontSize: 15, fontWeight: '800' }}>{o.orderNumber}</Text>
          <Text style={{ color: T.textFaint, fontSize: 12 }}>{formatDate(o.placedAt)} · {o.itemCount} item{o.itemCount === 1 ? '' : 's'}</Text>
        </View>
        <OrderStatusPill status={o.status} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
        {o.previewImages.slice(0, 4).map((u, i) => <ProductImage key={u + i} uri={u} style={{ width: 44, height: 44, borderRadius: R.sm }} iconSize={16} />)}
        {o.previewImages.length > 4 && <Text style={{ color: T.textFaint, fontSize: 12 }}>+{o.previewImages.length - 4}</Text>}
        <View style={{ flex: 1 }} />
        <Text style={{ color: T.text, fontSize: 16, fontWeight: '800' }}>{formatMoney(o.total)}</Text>
        <Feather name="chevron-right" size={18} color={T.textFaint} />
      </View>
    </Pressable>
  );
}

const orderKey = (o: ShopOrderSummary) => String(o.id);
const renderOrder = ({ item }: { item: ShopOrderSummary }) => <OrderRow o={item} />;
const OrderGap = () => <View style={{ height: SP.md }} />;

/** The member's orders: a virtualised list (ARCH-133) that pages in with "Load more". */
export function OrdersTab({ hPad }: { hPad: number }) {
  const nav = useShopNav();
  const q = useOrders();
  const orders = q.data?.pages.flatMap(p => p.items) ?? [];
  return (
    <FlatList
      data={orders}
      keyExtractor={orderKey}
      renderItem={renderOrder}
      ItemSeparatorComponent={OrderGap}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: 60 }}
      ListHeaderComponent={
        <View style={{ gap: SP.md }}>
          {q.isPending && <Skeleton rows={3} height={120} borderRadius={R.lg} />}
          {q.isError && <EmptyState icon="alert-circle" tone="error" title="Couldn’t load your orders" subtitle={apiErrorText(q.error)} action={{ label: 'Retry', onPress: () => q.refetch() }} />}
          {q.data && !orders.length && (
            <EmptyState icon="package" title="No orders yet" subtitle="When you buy something it’ll show up here, with live tracking." action={{ label: 'Start shopping', onPress: () => nav.setTab('store') }} />
          )}
        </View>
      }
      ListFooterComponent={q.hasNextPage
        ? <View style={{ marginTop: SP.md }}><PrimaryButton label="Load more orders" variant="secondary" loading={q.isFetchingNextPage} onPress={() => q.fetchNextPage()} /></View>
        : null}
    />
  );
}

// ── Detail ───────────────────────────────────────────────────────────────

function Timeline({ order }: { order: ShopOrder }) {
  const steps = order.timeline ?? [];
  const current = steps.reduce((last, s, i) => (s.completed ? i : last), -1);
  return (
    <View>
      {steps.map((s, i) => {
        const done = s.completed;
        const isCurrent = i === current;
        const cancelled = s.status === 'Cancelled';
        const color = cancelled ? T.err : done ? T.brand : T.textDisabled;
        return (
          <View key={s.status + i} style={{ flexDirection: 'row', gap: SP.md }} accessibilityLabel={`${ORDER_STATUS_LABEL[s.status]}${s.at ? `, ${formatDate(s.at)}` : ''}${isCurrent ? ', current' : done ? ', done' : ', upcoming'}`}>
            <View style={{ alignItems: 'center', width: 32 }}>
              <View style={{
                width: isCurrent ? 32 : 24, height: isCurrent ? 32 : 24, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                backgroundColor: done ? withAlpha(color, isCurrent ? 0.2 : 0.12) : T.bg, borderWidth: isCurrent ? 2 : 1, borderColor: color,
                marginTop: isCurrent ? 0 : 4,
              }}>
                <Feather name={done ? STATUS_ICON[s.status] : 'circle'} size={isCurrent ? 15 : 11} color={color} />
              </View>
              {i < steps.length - 1 && <View style={{ flex: 1, width: 2, minHeight: 18, backgroundColor: steps[i + 1].completed ? T.brand : T.line, marginVertical: 2 }} />}
            </View>
            <View style={{ flex: 1, paddingBottom: SP.lg, paddingTop: isCurrent ? 5 : 6 }}>
              <Text style={{ color: isCurrent ? T.text : done ? T.textSub : T.textFaint, fontSize: 14, fontWeight: isCurrent ? '800' : '600' }}>{ORDER_STATUS_LABEL[s.status] ?? s.status}</Text>
              {s.at ? <Text style={{ color: T.textFaint, fontSize: 12 }}>{new Date(s.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function OrderDetailScreen({ orderNumber }: { orderNumber: string }) {
  const nav = useShopNav();
  const { hPad } = useLayout();
  const toast = useToast();
  const q = useOrder(orderNumber);
  const cancel = useCancelOrder();
  const [confirm, setConfirm] = useState(false);
  const o = q.data;

  return (
    <Screen>
      <ScreenHeader eyebrow="Order" title={orderNumber} onBack={nav.pop} />
      {q.isPending && <View style={{ paddingHorizontal: hPad }}><Skeleton rows={3} height={120} borderRadius={R.lg} /></View>}
      {q.isError && <EmptyState icon="alert-circle" tone="error" title="Couldn’t load this order" subtitle={apiErrorText(q.error)} action={{ label: 'Retry', onPress: () => q.refetch() }} />}
      {o && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: 60, gap: SP.lg }}>
          <View style={[card, { padding: SP.lg, gap: SP.sm }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <CopyValue value={o.orderNumber} label="Order number" />
                <Text style={{ color: T.textFaint, fontSize: 12 }}>Placed {formatDate(o.placedAt)} · {o.deliveryMethod} delivery</Text>
              </View>
              <OrderStatusPill status={o.status} />
            </View>
            {o.status !== 'Cancelled' && o.status !== 'Delivered' && o.estimatedDelivery && (
              <Text style={{ color: T.text, fontSize: 14 }}>Arriving by <Text style={{ fontWeight: '800' }}>{shortDay(o.estimatedDelivery)}</Text></Text>
            )}
            {o.trackingNumber && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm, flexWrap: 'wrap' }}>
                <Text style={{ color: T.textFaint, fontSize: 12 }}>Tracking</Text>
                <CopyValue value={o.trackingNumber} label="Tracking number" />
              </View>
            )}
          </View>

          <View style={[card, { padding: SP.lg }]}>
            <Text style={{ color: T.text, fontSize: 16, fontWeight: '800', marginBottom: SP.md }}>Tracking</Text>
            <Timeline order={o} />
          </View>

          <View style={[card, { paddingHorizontal: SP.lg }]}>
            {o.items.map((i, k) => (
              <Pressable
                key={i.id}
                onPress={() => nav.push({ id: 'product', slug: i.productSlug })}
                accessibilityRole="button"
                accessibilityLabel={`${i.productName}, ${i.variantName}, quantity ${i.quantity}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingVertical: SP.md, borderTopWidth: k ? 1 : 0, borderTopColor: T.line }}
              >
                <ProductImage uri={i.imageUrl} style={{ width: 52, height: 52, borderRadius: R.sm }} iconSize={18} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={2} style={{ color: T.text, fontSize: 14, fontWeight: '600' }}>{i.productName}</Text>
                  <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 12 }}>{i.variantName} · {i.quantity} × {formatMoney(i.unitPrice)}</Text>
                </View>
                <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>{formatMoney(i.lineTotal)}</Text>
              </Pressable>
            ))}
          </View>

          <View style={[card, { padding: SP.lg, gap: SP.md }]}>
            <Info title="Delivery address" body={`${o.shippingAddress.fullName}\n${addressLines(o.shippingAddress)}\n${o.shippingAddress.phone}`} />
            {o.notes ? <Info title="Delivery instructions" body={o.notes} /> : null}
            <Info title="Payment" body={`${paymentLine(o)}${o.payment?.transactionReference ? `\nRef ${o.payment.transactionReference}` : ''}`} />
          </View>

          <View style={[card, { padding: SP.lg }]}>
            <MoneyRow label="Subtotal" value={formatMoney(o.subtotal)} />
            {o.discount > 0 && <MoneyRow label={`Discount${o.couponCode ? ` (${o.couponCode})` : ''}`} value={`−${formatMoney(o.discount)}`} tone={T.ok} />}
            <MoneyRow label="Delivery" value={o.shipping === 0 ? 'Free' : formatMoney(o.shipping)} />
            <MoneyRow label="GST" value={formatMoney(o.tax)} />
            <View style={{ borderTopWidth: 1, borderTopColor: T.line, marginTop: SP.sm, paddingTop: SP.sm }}>
              <MoneyRow label="Total" value={formatMoney(o.total)} strong />
            </View>
          </View>

          {canCancel(o.status) && (
            <PrimaryButton label="Cancel order" variant="danger" icon="x-circle" onPress={() => setConfirm(true)} />
          )}
        </ScrollView>
      )}

      <ConfirmSheet
        visible={confirm}
        title="Cancel this order?"
        message={o?.payment?.status === 'Paid'
          ? `We’ll stop ${o.orderNumber} before it ships and refund ${formatMoney(o.total)} to your ${PAYMENT_LABEL[o.payment.method]} in 5–7 working days.`
          : `We’ll stop ${o?.orderNumber ?? 'this order'} before it ships. Nothing has been charged; if you paid online, refunds take 5–7 working days.`}
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        loading={cancel.isPending}
        onClose={() => setConfirm(false)}
        onConfirm={() => cancel.mutate(orderNumber, {
          onSuccess: () => { setConfirm(false); toast.show({ message: 'Order cancelled' }); },
          onError: e => { setConfirm(false); toast.show({ type: 'error', message: apiErrorText(e) }); },
        })}
      />
    </Screen>
  );
}

function Info({ title, body }: { title: string; body: string }) {
  return (
    <View>
      <Text style={{ color: T.textFaint, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>{title}</Text>
      <Text style={{ color: T.textSub, fontSize: 14, lineHeight: 20 }}>{body}</Text>
    </View>
  );
}
