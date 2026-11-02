import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R, withAlpha } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import SegmentedTabs from '../../common/components/SegmentedTabs';
import PrimaryButton from '../../common/components/PrimaryButton';
import Skeleton from '../../common/components/Skeleton';
import EmptyState from '../../dashboard/components/EmptyState';
import { useToast } from '../../common/components/Toast';
import { apiErrorText } from '../../../api/apiError';
import { formatPrice } from '../common/format';
import { ShopProductDetail, ShopVariant } from '../api/shop.types';
import { useAddToCart, useProduct, useRelated, useStoreSettings } from '../api/storeQueries';
import { useShopNav } from './shopNav';
import Gallery from './Gallery';
import Reviews from './Reviews';
import { ProductRail, useSavedIds, WishlistHeart } from './ProductCard';
import { QtyStepper, SectionTitle, Stars, card, dateIn } from './ui';

type Attr = 'flavour' | 'size' | 'colour' | 'weight';
const ATTRS: { key: Attr; label: string }[] = [
  { key: 'flavour', label: 'Flavour' }, { key: 'size', label: 'Size' }, { key: 'colour', label: 'Colour' }, { key: 'weight', label: 'Weight' },
];

function initialVariant(p: ShopProductDetail): ShopVariant | undefined {
  return p.variants.find(v => v.isDefault && v.inStock) ?? p.variants.find(v => v.inStock) ?? p.variants.find(v => v.isDefault) ?? p.variants[0];
}

/** Variant pills grouped by attribute; a value with no in-stock match for the other picks is struck through. */
function VariantPicker({ product, selected, onSelect }: { product: ShopProductDetail; selected: ShopVariant; onSelect: (v: ShopVariant) => void }) {
  const variants = product.variants;
  const attrs = ATTRS.filter(a => variants.some(v => v[a.key]));

  const others = (v: ShopVariant, except: Attr) => attrs.every(a => a.key === except || v[a.key] === selected[a.key]);
  const pick = (attr: Attr, value: string) => {
    const c = variants.filter(v => v[attr] === value);
    onSelect(c.find(v => others(v, attr) && v.inStock) ?? c.find(v => others(v, attr)) ?? c.find(v => v.inStock) ?? c[0]);
  };

  if (!attrs.length) {
    if (variants.length < 2) return null;
    return (
      <View style={{ gap: SP.sm }}>
        <Text style={{ color: T.textSub, fontSize: 13, fontWeight: '600' }}>Option: <Text style={{ color: T.text }}>{selected.name}</Text></Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm }}>
          {variants.map(v => <Pill key={v.id} label={v.name} selected={v.id === selected.id} soldOut={!v.inStock} onPress={() => onSelect(v)} />)}
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: SP.lg }}>
      {attrs.map(({ key, label }) => {
        const values = [...new Set(variants.map(v => v[key]).filter((x): x is string => !!x))];
        return (
          <View key={key} style={{ gap: SP.sm }}>
            <Text style={{ color: T.textSub, fontSize: 13, fontWeight: '600' }}>{label}: <Text style={{ color: T.text }}>{selected[key] ?? '—'}</Text></Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm }}>
              {values.map(val => {
                const available = variants.some(v => v[key] === val && v.inStock && others(v, key));
                return <Pill key={val} label={val} selected={selected[key] === val} soldOut={!available} onPress={() => pick(key, val)} />;
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Pill({ label, selected, soldOut, onPress }: { label: string; selected: boolean; soldOut: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={`${label}${soldOut ? ', out of stock' : ''}`}
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => ({
        minHeight: 44, minWidth: 44, paddingHorizontal: 16, borderRadius: R.md, alignItems: 'center', justifyContent: 'center',
        borderWidth: selected ? 2 : 1, borderColor: selected ? T.brand : T.line,
        backgroundColor: selected ? withAlpha(T.brand, 0.1) : pressed ? T.bgInputActive : T.bgInput,
      })}
    >
      <Text style={{ color: soldOut ? T.textFaint : T.text, fontSize: 14, fontWeight: selected ? '700' : '500', textDecorationLine: soldOut ? 'line-through' : 'none' }}>{label}</Text>
    </Pressable>
  );
}

function StockLine({ v }: { v: ShopVariant }) {
  const [color, text] = !v.inStock || v.stock <= 0 ? [T.err, 'Out of stock'] : v.stock <= 5 ? [T.brandGold, `Only ${v.stock} left`] : [T.ok, 'In stock'];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ color, fontSize: 13, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

export default function ProductDetailScreen({ slug }: { slug: string }) {
  const nav = useShopNav();
  const { hPad } = useLayout();
  const toast = useToast();
  const q = useProduct(slug);
  const related = useRelated(slug);
  const store = useStoreSettings();
  const saved = useSavedIds();
  const add = useAddToCart();

  const p = q.data;
  const [variant, setVariant] = useState<ShopVariant | undefined>();
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<'details' | 'specs' | 'delivery'>('details');
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Keep the selection in sync with fresh data (e.g. stock changes after an order).
  useEffect(() => {
    if (!p) return;
    setVariant(cur => (cur && p.variants.find(v => v.id === cur.id)) || initialVariant(p));
  }, [p]);

  const images = useMemo(() => {
    if (!p) return [];
    const list = [...p.images].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder).map(i => i.url);
    return list.length ? list : p.primaryImageUrl ? [p.primaryImageUrl] : [];
  }, [p]);

  if (q.isPending) {
    return (
      <Screen>
        <ScreenHeader title="Loading…" onBack={nav.pop} />
        <View style={{ paddingHorizontal: hPad }}>
          <Skeleton rows={1} height={320} borderRadius={20} />
          <Skeleton rows={3} height={24} borderRadius={8} />
        </View>
      </Screen>
    );
  }
  if (q.isError || !p) {
    return (
      <Screen>
        <ScreenHeader title="Product" onBack={nav.pop} />
        <EmptyState icon="alert-circle" tone="error" title="Couldn’t load this product" subtitle={q.error ? apiErrorText(q.error) : undefined} action={{ label: 'Retry', onPress: () => q.refetch() }} />
      </Screen>
    );
  }

  const v = variant ?? initialVariant(p);
  const price = v?.price ?? p.price;
  const compare = v ? v.compareAtPrice : p.compareAtPrice;
  const save = compare && compare > price ? compare - price : 0;
  const maxQty = Math.max(1, Math.min(v?.stock ?? 0, 99));
  const canBuy = !!v && v.inStock && v.stock > 0;
  const qtyNow = Math.min(qty, maxQty);

  const addToCart = (then?: () => void) => {
    if (!v) return;
    add.mutate({ variantId: v.id, quantity: qtyNow }, {
      onSuccess: () => {
        if (then) return then();
        setAdded(true);
        timer.current = setTimeout(() => setAdded(false), 2000);
      },
      onError: e => toast.show({ type: 'error', message: apiErrorText(e) }),
    });
  };

  const s = store.data;
  const specs = Object.entries(p.specifications ?? {});

  return (
    <Screen>
      <ScreenHeader
        eyebrow={p.category?.name ?? 'Shop'}
        title={p.name}
        onBack={nav.pop}
        right={<WishlistHeart product={p} saved={saved.has(p.id)} size={40} />}
      />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: 40, gap: SP.xl }}>
        <Gallery images={images} name={p.name} soldOut={!p.inStock} />

        <View style={{ gap: SP.sm }}>
          {p.brand && <Text style={{ color: T.brand, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>{p.brand}</Text>}
          <Text accessibilityRole="header" style={{ color: T.text, fontSize: 22, fontWeight: '800', lineHeight: 28 }}>{p.name}</Text>
          {p.reviewCount > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
              <Stars rating={p.averageRating} size={14} />
              <Text style={{ color: T.textSub, fontSize: 13 }}>{p.averageRating.toFixed(1)} · {p.reviewCount} review{p.reviewCount === 1 ? '' : 's'}</Text>
            </View>
          ) : <Text style={{ color: T.textFaint, fontSize: 13 }}>No reviews yet</Text>}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: SP.sm, marginTop: SP.xs }}>
            <Text style={{ color: T.text, fontSize: 26, fontWeight: '800' }}>{formatPrice(price)}</Text>
            {save > 0 && compare ? (
              <>
                <Text style={{ color: T.textFaint, fontSize: 15, textDecorationLine: 'line-through' }}>{formatPrice(compare)}</Text>
                <Text style={{ color: T.ok, fontSize: 13, fontWeight: '700' }}>Save {formatPrice(save)} ({Math.round((save / compare) * 100)}%)</Text>
              </>
            ) : null}
          </View>
          <Text style={{ color: T.textFaint, fontSize: 12 }}>Inclusive of all taxes</Text>
          {p.shortDescription ? <Text style={{ color: T.textSub, fontSize: 14, lineHeight: 20 }}>{p.shortDescription}</Text> : null}
        </View>

        {v && <VariantPicker product={p} selected={v} onSelect={nv => { setVariant(nv); setQty(1); }} />}

        {v && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SP.md }}>
            <StockLine v={v} />
            {canBuy && <QtyStepper value={qtyNow} max={maxQty} onChange={setQty} />}
          </View>
        )}

        {/* Delivery promise */}
        {s && (
          <View style={[card, { padding: SP.lg, gap: SP.md }]}>
            <PromiseRow icon="truck" title={`Standard delivery by ${dateIn(s.standardDeliveryDays)}`} sub={price * qtyNow >= s.freeShippingThreshold ? 'Free on this order' : `${formatPrice(s.standardShipping)} · free over ${formatPrice(s.freeShippingThreshold)}`} />
            <PromiseRow icon="zap" title={`Express by ${dateIn(s.expressDeliveryDays)}`} sub={formatPrice(s.expressShipping)} />
            <PromiseRow icon="rotate-ccw" title={`${s.returnDays}-day easy returns`} sub="Unopened supplements and unworn apparel" />
          </View>
        )}

        <View>
          <SegmentedTabs
            tabs={[{ key: 'details', label: 'Details' }, { key: 'specs', label: 'Specifications' }, { key: 'delivery', label: 'Delivery' }]}
            value={tab}
            onChange={setTab}
            style={{ marginBottom: SP.lg }}
          />
          {tab === 'details' && (
            <Text style={{ color: T.textSub, fontSize: 14, lineHeight: 22 }}>{p.description || p.shortDescription || 'No description yet.'}</Text>
          )}
          {tab === 'specs' && (specs.length ? (
            <View style={[card, { overflow: 'hidden' }]}>
              {[['SKU', v?.sku ?? p.sku] as [string, string], ...specs].map(([k, val], i) => (
                <View key={k} style={{ flexDirection: 'row', gap: SP.md, padding: SP.md, borderTopWidth: i ? 1 : 0, borderTopColor: T.line }}>
                  <Text style={{ width: '40%', color: T.textFaint, fontSize: 13 }}>{k}</Text>
                  <Text style={{ flex: 1, color: T.text, fontSize: 13 }}>{val}</Text>
                </View>
              ))}
            </View>
          ) : <Text style={{ color: T.textFaint, fontSize: 14 }}>No specifications listed.</Text>)}
          {tab === 'delivery' && s && (
            <View style={{ gap: SP.sm }}>
              <Text style={{ color: T.textSub, fontSize: 14, lineHeight: 21 }}>
                Standard delivery takes about {s.standardDeliveryDays} working days and costs {formatPrice(s.standardShipping)} — free on orders over {formatPrice(s.freeShippingThreshold)}.
              </Text>
              <Text style={{ color: T.textSub, fontSize: 14, lineHeight: 21 }}>
                Express delivery arrives in about {s.expressDeliveryDays} working days for {formatPrice(s.expressShipping)}.
              </Text>
              <Text style={{ color: T.textSub, fontSize: 14, lineHeight: 21 }}>
                Changed your mind? Return it within {s.returnDays} days of delivery. Cash on delivery, UPI and cards accepted.
              </Text>
            </View>
          )}
        </View>

        <Reviews productId={p.id} />

        {(related.data?.length ?? 0) > 0 && (
          <View>
            <SectionTitle title="You may also like" />
            <ProductRail products={related.data} hPad={hPad} />
          </View>
        )}
      </ScrollView>

      {/* Sticky buy bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm, paddingHorizontal: hPad, paddingVertical: SP.md, borderTopWidth: 1, borderTopColor: T.line, backgroundColor: T.bgNav }}>
        <View style={{ minWidth: 0, flexShrink: 1, marginRight: 'auto' }}>
          <Text numberOfLines={1} style={{ color: T.text, fontSize: 17, fontWeight: '800' }}>{formatPrice(price * qtyNow)}</Text>
          <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 11 }}>{qtyNow > 1 ? `${qtyNow} × ${formatPrice(price)}` : v?.name ?? ''}</Text>
        </View>
        {canBuy ? (
          <>
            <PrimaryButton
              label={added ? 'Added to cart ✓' : 'Add to cart'}
              variant="secondary"
              onPress={() => addToCart()}
              loading={add.isPending && !added}
              style={{ height: 48, paddingHorizontal: 14 }}
            />
            <PrimaryButton label="Buy now" onPress={() => addToCart(() => nav.push({ id: 'checkout' }))} disabled={add.isPending} style={{ height: 48, paddingHorizontal: 16 }} />
          </>
        ) : (
          <PrimaryButton label="Sold out" onPress={() => undefined} disabled style={{ height: 48 }} />
        )}
      </View>
    </Screen>
  );
}

function PromiseRow({ icon, title, sub }: { icon: React.ComponentProps<typeof Feather>['name']; title: string; sub: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: SP.md, alignItems: 'flex-start' }}>
      <Feather name={icon} size={18} color={T.brand} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: T.text, fontSize: 14, fontWeight: '600' }}>{title}</Text>
        <Text style={{ color: T.textFaint, fontSize: 12 }}>{sub}</Text>
      </View>
    </View>
  );
}
