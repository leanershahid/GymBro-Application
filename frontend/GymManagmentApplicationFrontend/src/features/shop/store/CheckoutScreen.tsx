import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R, withAlpha } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import PrimaryButton from '../../common/components/PrimaryButton';
import Skeleton from '../../common/components/Skeleton';
import EmptyState from '../../dashboard/components/EmptyState';
import { useToast } from '../../common/components/Toast';
import { apiErrorText } from '../../../api/apiError';
import { formatMoney } from '../common/format';
import { ShopDeliveryMethod, ShopPaymentMethod, ShopQuote } from '../api/shop.types';
import { useAddresses, useCart, usePlaceOrder, useQuote, useStoreSettings, useValidateCoupon } from '../api/storeQueries';
import { useShopNav } from './shopNav';
import AddressSheet from './AddressForm';
import { AddressTitle, addressLines } from './AddressesScreen';
import { Field, FeatherIcon, MoneyRow, PAYMENT_LABEL, ProductImage, card, shortDay } from './ui';

const STEPS = ['Cart', 'Address', 'Delivery', 'Payment', 'Review'] as const;
const HEADINGS = ['Review your cart', 'Where should we deliver?', 'How fast do you need it?', 'How would you like to pay?', 'Check and place your order'];

function Progress({ step, onJump }: { step: number; onJump: (s: number) => void }) {
  const [w, setW] = useState(0);
  const pad = 22;
  return (
    <View onLayout={e => setW(e.nativeEvent.layout.width)} accessibilityLabel={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}>
      <View style={{ position: 'absolute', left: pad, right: pad, top: 21, height: 2, backgroundColor: T.line }} />
      <View style={{ position: 'absolute', left: pad, top: 21, height: 2, width: Math.max(0, (w - pad * 2) * (step / (STEPS.length - 1))), backgroundColor: T.brand }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {STEPS.map((label, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <Pressable
              key={label}
              onPress={() => done && onJump(i)}
              disabled={!done}
              accessibilityRole="button"
              accessibilityLabel={`${label}${done ? ', completed. Go back to this step' : current ? ', current step' : ''}`}
              accessibilityState={{ disabled: !done, selected: current }}
              style={{ width: 44 + 8, alignItems: 'center', gap: 4 }}
            >
              <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{
                  width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2,
                  borderColor: done || current ? T.brand : T.line, backgroundColor: done ? T.brand : T.bg,
                }}>
                  {done ? <Feather name="check" size={15} color={T.onBrand} /> : <Text style={{ color: current ? T.brand : T.textFaint, fontSize: 12, fontWeight: '800' }}>{i + 1}</Text>}
                </View>
              </View>
              <Text numberOfLines={1} style={{ color: current ? T.text : T.textFaint, fontSize: 11, fontWeight: current ? '700' : '500' }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function RadioCard({ selected, onPress, icon, title, sub, aside, a11y }: {
  selected: boolean; onPress: () => void; icon: FeatherIcon; title: React.ReactNode; sub?: React.ReactNode; aside?: React.ReactNode; a11y: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={a11y}
      style={({ pressed }) => [card, {
        padding: SP.lg, flexDirection: 'row', gap: SP.md, alignItems: 'flex-start',
        borderColor: selected ? T.brand : T.line, borderWidth: selected ? 2 : 1,
        backgroundColor: selected ? withAlpha(T.brand, 0.06) : pressed ? T.bgInputActive : T.bgInput,
      }]}
    >
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: selected ? T.brand : T.textFaint, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        {selected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: T.brand }} />}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
          <Feather name={icon} size={16} color={selected ? T.brand : T.textSub} />
          <View style={{ flex: 1, minWidth: 0 }}>{typeof title === 'string' ? <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>{title}</Text> : title}</View>
        </View>
        {sub ? (typeof sub === 'string' ? <Text style={{ color: T.textSub, fontSize: 13, lineHeight: 19 }}>{sub}</Text> : sub) : null}
      </View>
      {aside}
    </Pressable>
  );
}

function Summary({ q, quoteLoading, quoteError, taxRate, coupon, couponInput, setCouponInput, couponError, applying, onApply, onRemove }: {
  q?: ShopQuote; quoteLoading: boolean; quoteError?: string; taxRate?: number; coupon: string | null; couponInput: string;
  setCouponInput: (s: string) => void; couponError: string | null; applying: boolean; onApply: () => void; onRemove: () => void;
}) {
  return (
    <View style={[card, { padding: SP.lg, gap: SP.md }]}>
      <Text style={{ color: T.text, fontSize: 16, fontWeight: '800' }}>Summary</Text>
      {coupon ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm, paddingLeft: SP.md, borderRadius: R.pill, backgroundColor: T.okDim, borderWidth: 1, borderColor: withAlpha(T.ok, 0.3) }}>
          <Feather name="tag" size={15} color={T.ok} />
          <Text style={{ flex: 1, color: T.ok, fontSize: 14 }}><Text style={{ fontWeight: '800' }}>{coupon}</Text> applied</Text>
          <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Remove coupon ${coupon}`} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="x" size={16} color={T.ok} />
          </Pressable>
        </View>
      ) : (
        <View>
          <View style={{ flexDirection: 'row', gap: SP.sm }}>
            <TextInput
              value={couponInput}
              onChangeText={t => setCouponInput(t.toUpperCase().replace(/\s/g, ''))}
              onSubmitEditing={onApply}
              placeholder="Coupon code"
              placeholderTextColor={T.textFaint}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={30}
              accessibilityLabel="Coupon code"
              returnKeyType="done"
              style={{ flex: 1, minWidth: 0, height: 44, borderRadius: R.pill, paddingHorizontal: 16, color: T.text, backgroundColor: T.bg, borderWidth: 1, borderColor: couponError ? T.err : T.line, fontSize: 14, fontWeight: '700', letterSpacing: 1 }}
            />
            <Pressable
              onPress={onApply}
              disabled={applying || !couponInput.trim()}
              accessibilityRole="button"
              accessibilityLabel="Apply coupon"
              style={({ pressed }) => ({ height: 44, minWidth: 80, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.brandBorder, backgroundColor: pressed ? withAlpha(T.brand, 0.16) : T.brandDim, opacity: !couponInput.trim() ? 0.5 : 1 })}
            >
              {applying ? <ActivityIndicator color={T.brand} /> : <Text style={{ color: T.brand, fontWeight: '800' }}>Apply</Text>}
            </Pressable>
          </View>
          {couponError && <Text accessibilityRole="alert" style={{ color: T.err, fontSize: 12, marginTop: 6 }}>{couponError}</Text>}
        </View>
      )}

      <View style={{ borderTopWidth: 1, borderTopColor: T.line, paddingTop: SP.sm }}>
        {q ? (
          <>
            <MoneyRow label="Subtotal" value={formatMoney(q.subtotal)} />
            {q.discount > 0 && <MoneyRow label={`Discount${q.couponCode ? ` (${q.couponCode})` : ''}`} value={`−${formatMoney(q.discount)}`} tone={T.ok} />}
            <MoneyRow label="Delivery" value={q.shipping === 0 ? 'Free' : formatMoney(q.shipping)} tone={q.shipping === 0 ? T.ok : undefined} />
            <MoneyRow label={taxRate ? `GST (${Math.round(taxRate * 100)}%)` : 'GST'} value={formatMoney(q.tax)} />
            <View style={{ borderTopWidth: 1, borderTopColor: T.line, marginTop: SP.sm, paddingTop: SP.sm }}>
              <MoneyRow label="Total" value={formatMoney(q.total)} strong />
            </View>
          </>
        ) : quoteLoading ? <Skeleton rows={4} height={18} borderRadius={6} gap={10} /> : null}
        {quoteError && <Text style={{ color: T.err, fontSize: 13 }}>{quoteError}</Text>}
      </View>
    </View>
  );
}

export default function CheckoutScreen() {
  const nav = useShopNav();
  const { hPad } = useLayout();
  const toast = useToast();
  const scroll = useRef<ScrollView>(null);
  const cart = useCart();
  const addresses = useAddresses();
  const store = useStoreSettings();
  const validate = useValidateCoupon();
  const place = usePlaceOrder();

  const [step, setStep] = useState(0);
  const [addressId, setAddressId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [delivery, setDelivery] = useState<ShopDeliveryMethod>('Standard');
  const [payment, setPayment] = useState<ShopPaymentMethod>('CashOnDelivery');
  const [notes, setNotes] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  const items = cart.data?.items ?? [];
  const sig = items.map(i => `${i.id}:${i.quantity}`).join(',');
  const has = items.length > 0;
  const standard = useQuote('Standard', coupon, sig, has);
  const express = useQuote('Express', coupon, sig, has);
  const quote = delivery === 'Standard' ? standard : express;
  const q = quote.data;

  useEffect(() => {
    if (addressId || !addresses.data?.length) return;
    setAddressId((addresses.data.find(a => a.isDefault) ?? addresses.data[0]).id);
  }, [addresses.data, addressId]);

  // The quote says why a coupon stopped applying (e.g. the cart dropped below its minimum).
  useEffect(() => {
    if (coupon && q?.couponMessage) { setCouponError(q.couponMessage); setCoupon(null); }
  }, [q?.couponMessage, coupon]);

  const selected = useMemo(() => addresses.data?.find(a => a.id === addressId), [addresses.data, addressId]);
  const go = (s: number) => { setStep(s); scroll.current?.scrollTo({ y: 0, animated: false }); };

  const applyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    if (!code || !cart.data) return;
    setCouponError(null);
    validate.mutate({ code, subtotal: cart.data.subtotal }, {
      onSuccess: res => {
        setCoupon(res.code);
        setCouponInput('');
        toast.show({ message: `${res.code} applied — you save ${formatMoney(res.discountAmount)}` });
      },
      onError: e => setCouponError(apiErrorText(e)),
    });
  };

  const placeOrder = () => {
    if (!addressId) return go(1);
    place.mutate(
      { addressId, deliveryMethod: delivery, paymentMethod: payment, couponCode: coupon ?? undefined, notes: notes.trim() || undefined },
      {
        onSuccess: order => nav.replace({ id: 'confirmed', orderNumber: order.orderNumber }),
        onError: e => toast.show({ type: 'error', message: `We couldn’t place your order. ${apiErrorText(e)}` }),
      },
    );
  };

  if (cart.isPending) {
    return <Screen><ScreenHeader title="Checkout" onBack={nav.pop} /><View style={{ paddingHorizontal: hPad }}><Skeleton rows={3} height={90} borderRadius={R.lg} /></View></Screen>;
  }
  if (!has) {
    return (
      <Screen>
        <ScreenHeader title="Checkout" onBack={nav.pop} />
        <EmptyState icon="shopping-bag" title="Nothing to check out yet" subtitle="Your cart is empty. Add something first." action={{ label: 'Browse the shop', onPress: () => nav.home('store') }} />
      </Screen>
    );
  }

  const blocked = items.some(i => i.availableStock <= 0 || i.quantity > i.availableStock);
  const canContinue = step === 0 ? !blocked : step === 1 ? !!selected : true;
  const dateOf = (x?: ShopQuote) => (x?.estimatedDelivery ? `Arrives by ${shortDay(x.estimatedDelivery)}` : '');
  const fee = (x?: ShopQuote) => (x ? (x.shipping === 0 ? 'Free' : formatMoney(x.shipping)) : '…');

  return (
    <Screen>
      <ScreenHeader eyebrow={`Step ${step + 1} of 5`} title="Checkout" onBack={step > 0 ? () => go(step - 1) : nav.pop} />
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: 32, gap: SP.lg }}>
        <Progress step={step} onJump={go} />
        <Text accessibilityRole="header" style={{ color: T.text, fontSize: 20, fontWeight: '800' }}>{HEADINGS[step]}</Text>

        {step === 0 && (
          <View style={[card, { paddingHorizontal: SP.lg }]}>
            {items.map((i, k) => (
              <View key={i.id} style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingVertical: SP.md, borderTopWidth: k ? 1 : 0, borderTopColor: T.line }}>
                <ProductImage uri={i.imageUrl} style={{ width: 52, height: 52, borderRadius: R.sm }} iconSize={18} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={2} style={{ color: T.text, fontSize: 14, fontWeight: '600' }}>{i.productName}</Text>
                  <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 12 }}>{i.variantName} · Qty {i.quantity}</Text>
                  {i.quantity > i.availableStock && <Text style={{ color: T.err, fontSize: 12 }}>Only {i.availableStock} available</Text>}
                </View>
                <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>{formatMoney(i.lineTotal)}</Text>
              </View>
            ))}
            <Pressable onPress={() => nav.home('cart')} accessibilityRole="button" accessibilityLabel="Edit cart" style={{ minHeight: 44, justifyContent: 'center', borderTopWidth: 1, borderTopColor: T.line }}>
              <Text style={{ color: T.brand, fontSize: 14, fontWeight: '700' }}>Edit cart</Text>
            </Pressable>
          </View>
        )}

        {step === 1 && (
          <View style={{ gap: SP.md }}>
            {addresses.isPending && <Skeleton rows={2} height={100} borderRadius={R.lg} />}
            {addresses.isError && <Text style={{ color: T.err }}>{apiErrorText(addresses.error)}</Text>}
            {addresses.data?.map(a => (
              <RadioCard
                key={a.id}
                selected={addressId === a.id}
                onPress={() => setAddressId(a.id)}
                icon="map-pin"
                a11y={`${a.fullName}, ${addressLines(a)}`}
                title={<AddressTitle a={a} />}
                sub={`${addressLines(a)}\n${a.phone}`}
              />
            ))}
            <Pressable
              onPress={() => setAdding(true)}
              accessibilityRole="button"
              accessibilityLabel="Add a new address"
              style={({ pressed }) => ({ minHeight: 56, borderRadius: R.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: pressed ? T.brand : T.textFaint, flexDirection: 'row', gap: SP.sm, alignItems: 'center', justifyContent: 'center' })}
            >
              <Feather name="plus" size={18} color={T.brand} />
              <Text style={{ color: T.brand, fontSize: 14, fontWeight: '700' }}>Add a new address</Text>
            </Pressable>
            {!!addresses.data?.length && (
              <Pressable onPress={() => nav.push({ id: 'addresses' })} accessibilityRole="button" accessibilityLabel="Manage addresses" style={{ minHeight: 44, alignSelf: 'center', justifyContent: 'center' }}>
                <Text style={{ color: T.textSub, fontSize: 13, fontWeight: '600' }}>Manage addresses</Text>
              </Pressable>
            )}
          </View>
        )}

        {step === 2 && (
          <View style={{ gap: SP.md }}>
            <RadioCard selected={delivery === 'Standard'} onPress={() => setDelivery('Standard')} icon="truck" a11y={`Standard delivery, ${fee(standard.data)}. ${dateOf(standard.data)}`}
              title="Standard delivery" sub={dateOf(standard.data) || `${store.data?.standardDeliveryDays ?? 5} working days`}
              aside={<Text style={{ color: standard.data?.shipping === 0 ? T.ok : T.text, fontWeight: '700' }}>{fee(standard.data)}</Text>} />
            <RadioCard selected={delivery === 'Express'} onPress={() => setDelivery('Express')} icon="zap" a11y={`Express delivery, ${fee(express.data)}. ${dateOf(express.data)}`}
              title="Express delivery" sub={dateOf(express.data) || `${store.data?.expressDeliveryDays ?? 2} working days`}
              aside={<Text style={{ color: express.data?.shipping === 0 ? T.ok : T.text, fontWeight: '700' }}>{fee(express.data)}</Text>} />
            <Field
              label="Delivery instructions"
              optional
              multiline
              maxLength={500}
              value={notes}
              onChangeText={setNotes}
              placeholder="Gate code, preferred time, a neighbour who can receive it…"
            />
            <Text style={{ color: T.textFaint, fontSize: 11, textAlign: 'right', marginTop: -SP.sm }}>{notes.length}/500</Text>
          </View>
        )}

        {step === 3 && (
          <View style={{ gap: SP.md }}>
            <RadioCard selected={payment === 'CashOnDelivery'} onPress={() => setPayment('CashOnDelivery')} icon="dollar-sign" a11y="Cash on delivery" title="Cash on delivery" sub="Pay in cash or by UPI when your order arrives." />
            <RadioCard selected={payment === 'Upi'} onPress={() => setPayment('Upi')} icon="smartphone" a11y="UPI" title="UPI" sub="Google Pay, PhonePe, Paytm or any UPI app." />
            <RadioCard selected={payment === 'Card'} onPress={() => setPayment('Card')} icon="credit-card" a11y="Credit or debit card" title="Credit or debit card" sub="Visa, Mastercard, RuPay — processed securely by our payment partner." />
          </View>
        )}

        {step === 4 && (
          <View style={{ gap: SP.md }}>
            {[
              { title: 'Deliver to', body: selected ? `${selected.fullName}, ${addressLines(selected)} · ${selected.phone}` : 'Choose an address', edit: 1 },
              { title: 'Delivery', body: `${delivery}${q?.estimatedDelivery ? ` · arrives by ${shortDay(q.estimatedDelivery)}` : ''}${notes.trim() ? `\nNote: ${notes.trim()}` : ''}`, edit: 2 },
              { title: 'Payment', body: PAYMENT_LABEL[payment], edit: 3 },
              { title: 'Items', body: items.map(i => `${i.quantity} × ${i.productName} (${i.variantName})`).join('\n'), edit: 0 },
            ].map(row => (
              <View key={row.title} style={[card, { padding: SP.lg, flexDirection: 'row', gap: SP.md, alignItems: 'flex-start' }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: T.textFaint, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>{row.title}</Text>
                  <Text style={{ color: T.textSub, fontSize: 14, lineHeight: 20 }}>{row.body}</Text>
                </View>
                <Pressable onPress={() => go(row.edit)} accessibilityRole="button" accessibilityLabel={`Change ${row.title.toLowerCase()}`} style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' }}>
                  <Text style={{ color: T.brand, fontSize: 13, fontWeight: '700' }}>Change</Text>
                </Pressable>
              </View>
            ))}
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <Feather name="lock" size={12} color={T.textFaint} />
              <Text style={{ flex: 1, color: T.textFaint, fontSize: 12 }}>By placing your order you agree to our delivery and returns terms.</Text>
            </View>
          </View>
        )}

        <Summary
          q={q}
          quoteLoading={quote.isPending}
          quoteError={quote.isError ? apiErrorText(quote.error) : undefined}
          taxRate={store.data?.taxRate}
          coupon={coupon}
          couponInput={couponInput}
          setCouponInput={t => { setCouponInput(t); setCouponError(null); }}
          couponError={couponError}
          applying={validate.isPending}
          onApply={applyCoupon}
          onRemove={() => setCoupon(null)}
        />
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: SP.sm, paddingHorizontal: hPad, paddingVertical: SP.md, borderTopWidth: 1, borderTopColor: T.line, backgroundColor: T.bgNav }}>
        {step > 0 && <PrimaryButton label="Back" variant="secondary" icon="chevron-left" onPress={() => go(step - 1)} style={{ paddingHorizontal: 16 }} />}
        {step < 4 ? (
          <PrimaryButton label={`Continue to ${STEPS[step + 1].toLowerCase()}`} onPress={() => go(step + 1)} disabled={!canContinue} style={{ flex: 1, paddingHorizontal: 12 }} />
        ) : (
          <PrimaryButton
            label={`Place order · ${q ? formatMoney(q.total) : '…'}`}
            icon="lock"
            onPress={placeOrder}
            loading={place.isPending}
            disabled={!q || quote.isFetching || !selected}
            style={{ flex: 1, paddingHorizontal: 12 }}
          />
        )}
      </View>

      <AddressSheet
        visible={adding}
        onClose={() => setAdding(false)}
        defaultChecked={!addresses.data?.length}
        onSaved={a => { setAddressId(a.id); toast.show({ message: 'Address saved' }); }}
      />
    </Screen>
  );
}
