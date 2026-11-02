import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R } from '../../../theme';
import PrimaryButton from '../../common/components/PrimaryButton';
import Skeleton from '../../common/components/Skeleton';
import EmptyState from '../../dashboard/components/EmptyState';
import { useToast } from '../../common/components/Toast';
import { apiErrorText } from '../../../api/apiError';
import { formatMoney, formatPrice } from '../common/format';
import { ShopCartItem } from '../api/shop.types';
import { useCart, useClearCart, useProducts, useRemoveCartItem, useStoreSettings, useUpdateCartItem, useWishlist } from '../api/storeQueries';
import { useShopNav } from './shopNav';
import { ProductGrid, ProductRail } from './ProductCard';
import { ConfirmSheet, MoneyRow, ProductImage, QtyStepper, SectionTitle, card } from './ui';

function CartLine({ item }: { item: ShopCartItem }) {
  const nav = useShopNav();
  const toast = useToast();
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();
  const fail = (e: unknown) => toast.show({ type: 'error', message: apiErrorText(e) });
  const max = Math.max(1, Math.min(item.availableStock, 99));
  const attrs = [item.flavour, item.size, item.colour, item.weight].filter(Boolean).join(' · ') || item.variantName;

  return (
    <View style={{ flexDirection: 'row', gap: SP.md, paddingVertical: SP.md, borderTopWidth: 1, borderTopColor: T.line }}>
      <Pressable onPress={() => nav.push({ id: 'product', slug: item.productSlug })} accessibilityRole="button" accessibilityLabel={`Open ${item.productName}`}>
        <ProductImage uri={item.imageUrl} style={{ width: 76, height: 76, borderRadius: R.md }} iconSize={22} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SP.sm }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={2} style={{ color: T.text, fontSize: 14, fontWeight: '600', lineHeight: 19 }}>{item.productName}</Text>
            <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 12 }}>{attrs}</Text>
          </View>
          <Pressable
            onPress={() => remove.mutate(item.id, { onSuccess: () => toast.show({ message: 'Removed from cart' }), onError: fail })}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item.productName} from cart`}
            style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginTop: -6, marginRight: -6 }}
          >
            <Feather name="trash-2" size={16} color={T.textSub} />
          </Pressable>
        </View>
        {item.availableStock > 0 && item.availableStock <= 5 && (
          <Text style={{ color: T.brandGold, fontSize: 12, fontWeight: '700' }}>Only {item.availableStock} left</Text>
        )}
        {item.availableStock <= 0 && <Text style={{ color: T.err, fontSize: 12, fontWeight: '700' }}>Out of stock — remove to check out</Text>}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm, marginTop: 2 }}>
          <QtyStepper compact value={item.quantity} max={max} onChange={n => update.mutate({ itemId: item.id, quantity: n }, { onError: fail })} />
          <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
            <Text style={{ color: T.text, fontSize: 15, fontWeight: '800' }}>{formatMoney(item.lineTotal)}</Text>
            {item.quantity > 1 && <Text style={{ color: T.textFaint, fontSize: 11 }}>{formatPrice(item.unitPrice)} each</Text>}
          </View>
        </View>
      </View>
    </View>
  );
}

export default function CartTab({ hPad }: { hPad: number }) {
  const nav = useShopNav();
  const toast = useToast();
  const cart = useCart();
  const store = useStoreSettings();
  const best = useProducts({ featured: true, pageSize: 10, sort: 'featured' });
  const clear = useClearCart();
  const [confirmClear, setConfirmClear] = useState(false);

  if (cart.isPending) {
    return <View style={{ paddingHorizontal: hPad }}><Skeleton rows={3} height={100} borderRadius={R.lg} /></View>;
  }
  if (cart.isError) {
    return <EmptyState icon="alert-circle" tone="error" title="Couldn’t load your cart" subtitle={apiErrorText(cart.error)} action={{ label: 'Retry', onPress: () => cart.refetch() }} />;
  }

  const c = cart.data;
  if (!c?.items.length) {
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: 60 }}>
        <EmptyState icon="shopping-cart" title="Your cart is empty" subtitle="Fuel up — protein, pre-workout and gear are a tap away." action={{ label: 'Start shopping', onPress: () => nav.setTab('store') }} />
        <SectionTitle title="Bestsellers" style={{ marginTop: SP.md }} />
        <ProductRail products={best.data?.items} loading={best.isPending} hPad={hPad} />
      </ScrollView>
    );
  }

  const threshold = store.data?.freeShippingThreshold ?? 0;
  const left = Math.max(0, threshold - c.subtotal);
  const pct = threshold ? Math.min(1, c.subtotal / threshold) : 1;
  const blocked = c.items.some(i => i.availableStock <= 0 || i.quantity > i.availableStock);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: 24, gap: SP.lg }}>
        {store.data && (
          <View style={[card, { padding: SP.md, gap: SP.sm }]} accessibilityLabel={left > 0 ? `Add ${formatPrice(left)} more for free delivery` : 'Free delivery unlocked'}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
              <Feather name="truck" size={16} color={left > 0 ? T.textSub : T.ok} />
              <Text style={{ flex: 1, color: T.text, fontSize: 13 }}>
                {left > 0
                  ? <>Add <Text style={{ fontWeight: '800', color: T.brand }}>{formatPrice(left)}</Text> more for free delivery</>
                  : <Text style={{ color: T.ok, fontWeight: '700' }}>You’ve unlocked free delivery</Text>}
              </Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: T.bgInputActive, overflow: 'hidden' }}>
              <View style={{ width: `${Math.round(pct * 100)}%`, height: '100%', backgroundColor: left > 0 ? T.brand : T.ok }} />
            </View>
          </View>
        )}

        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: T.textSub, fontSize: 13 }}>{c.itemCount} item{c.itemCount === 1 ? '' : 's'}</Text>
            <Pressable onPress={() => setConfirmClear(true)} accessibilityRole="button" accessibilityLabel="Clear cart" style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ color: T.textSub, fontSize: 13, fontWeight: '600' }}>Clear cart</Text>
            </Pressable>
          </View>
          {c.items.map(i => <CartLine key={i.id} item={i} />)}
        </View>

        <View style={[card, { padding: SP.lg }]}>
          <MoneyRow label="Subtotal" value={formatMoney(c.subtotal)} strong />
          <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }}>Delivery, GST and coupons are worked out at checkout.</Text>
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: hPad, paddingVertical: SP.md, borderTopWidth: 1, borderTopColor: T.line, backgroundColor: T.bgNav }}>
        <PrimaryButton
          label={blocked ? 'Fix stock issues to continue' : `Proceed to checkout · ${formatPrice(c.subtotal)}`}
          icon={blocked ? undefined : 'lock'}
          disabled={blocked}
          onPress={() => nav.push({ id: 'checkout' })}
        />
      </View>
      <ConfirmSheet
        visible={confirmClear}
        title="Clear your cart?"
        message={`All ${c.itemCount} item${c.itemCount === 1 ? '' : 's'} will be removed.`}
        confirmLabel="Clear cart"
        loading={clear.isPending}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => clear.mutate(undefined, {
          onSuccess: () => setConfirmClear(false),
          onError: e => { setConfirmClear(false); toast.show({ type: 'error', message: apiErrorText(e) }); },
        })}
      />
    </View>
  );
}

export function WishlistTab({ hPad }: { hPad: number }) {
  const nav = useShopNav();
  const wl = useWishlist();
  if (wl.isPending) return <View style={{ paddingHorizontal: hPad }}><Skeleton rows={2} height={220} borderRadius={R.lg} /></View>;
  if (wl.isError) return <EmptyState icon="alert-circle" tone="error" title="Couldn’t load your wishlist" subtitle={apiErrorText(wl.error)} action={{ label: 'Retry', onPress: () => wl.refetch() }} />;
  const items = wl.data?.items ?? [];
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: 60 }}>
      {items.length === 0 ? (
        <EmptyState icon="heart" title="Nothing saved yet" subtitle="Tap the heart on any product to keep it here for later." action={{ label: 'Browse the shop', onPress: () => nav.setTab('store') }} />
      ) : (
        <>
          <Text style={{ color: T.textSub, fontSize: 13, marginBottom: SP.md }}>{items.length} saved item{items.length === 1 ? '' : 's'}</Text>
          <ProductGrid products={items.map(i => i.product)} hPad={hPad} />
        </>
      )}
    </ScrollView>
  );
}
