import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { T, SP, R, withAlpha } from '../../../theme';
import { useToast } from '../../common/components/Toast';
import Skeleton from '../../common/components/Skeleton';
import { apiErrorText } from '../../../api/apiError';
import { formatPrice } from '../common/format';
import { ShopProductCard } from '../api/shop.types';
import { useAddToCart, useToggleWishlist, useWishlist } from '../api/storeQueries';
import { useShopNav } from './shopNav';
import { ProductImage, Stars } from './ui';

/** Saved product ids, from the wishlist cache. */
export function useSavedIds(): Set<number> {
  const { data } = useWishlist();
  return new Set((data?.items ?? []).map(i => i.productId));
}

/** Heart toggle with optimistic update and toast. */
export function WishlistHeart({ product, saved, size = 36 }: { product: ShopProductCard; saved: boolean; size?: number }) {
  const toggle = useToggleWishlist();
  const toast = useToast();
  return (
    <Pressable
      onPress={() => toggle.mutate({ product, saved }, {
        onSuccess: () => toast.show({ message: saved ? 'Removed from wishlist' : 'Saved to wishlist' }),
        onError: e => toast.show({ type: 'error', message: apiErrorText(e) }),
      })}
      hitSlop={(44 - size) / 2}
      accessibilityRole="button"
      accessibilityLabel={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
      accessibilityState={{ selected: saved }}
      style={{
        width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center',
        backgroundColor: withAlpha(T.black, 0.55), borderWidth: 1, borderColor: withAlpha(T.text, 0.12),
      }}
    >
      <Ionicons name={saved ? 'heart' : 'heart-outline'} size={Math.round(size * 0.5)} color={saved ? T.rose : T.text} />
    </Pressable>
  );
}

function Badge({ label, color, fg }: { label: string; color: string; fg: string }) {
  return (
    <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: R.sm, backgroundColor: color }}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: '800' }}>{label}</Text>
    </View>
  );
}

/** Quick-add (+) for the default variant; turns into "Added ✓" for a moment. */
function QuickAdd({ product }: { product: ShopProductCard }) {
  const add = useAddToCart();
  const toast = useToast();
  const nav = useShopNav();
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const onPress = () => {
    if (!product.defaultVariantId) return nav.push({ id: 'product', slug: product.slug });
    add.mutate({ variantId: product.defaultVariantId, quantity: 1 }, {
      onSuccess: () => {
        setAdded(true);
        timer.current = setTimeout(() => setAdded(false), 1800);
      },
      onError: e => toast.show({ type: 'error', message: apiErrorText(e) }),
    });
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={add.isPending}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={added ? 'Added to cart' : `Add ${product.name} to cart`}
      style={({ pressed }) => ({
        height: 36, minWidth: 36, paddingHorizontal: added ? 10 : 0, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
        backgroundColor: added ? T.ok : pressed ? T.brandDark : T.brand, opacity: add.isPending ? 0.6 : 1,
      })}
    >
      {added
        ? <Text style={{ color: T.onBrand, fontSize: 12, fontWeight: '800' }}>Added ✓</Text>
        : <Feather name="plus" size={18} color={T.onBrand} />}
    </Pressable>
  );
}

export function ProductCard({ product, width, saved }: { product: ShopProductCard; width: number; saved: boolean }) {
  const nav = useShopNav();
  const off = product.discountPercent ?? (product.compareAtPrice && product.compareAtPrice > product.price
    ? Math.round((1 - product.price / product.compareAtPrice) * 100) : null);

  return (
    <View style={{ width, backgroundColor: T.bgInput, borderRadius: R.lg, borderWidth: 1, borderColor: T.line, overflow: 'hidden' }}>
      <Pressable
        onPress={() => nav.push({ id: 'product', slug: product.slug })}
        accessibilityRole="button"
        accessibilityLabel={`${product.name}, ${formatPrice(product.price)}${product.inStock ? '' : ', sold out'}`}
      >
        <ProductImage uri={product.primaryImageUrl} style={{ width: '100%', aspectRatio: 1, opacity: product.inStock ? 1 : 0.55 }} />
        <View style={{ position: 'absolute', top: 8, left: 8, gap: 4, alignItems: 'flex-start' }}>
          {!product.inStock && <Badge label="Sold out" color={T.bgNav} fg={T.textSub} />}
          {product.inStock && !!off && off > 0 && <Badge label={`−${off}%`} color={T.err} fg={T.text} />}
          {product.isNew && <Badge label="New" color={T.brand} fg={T.onBrand} />}
        </View>
        <View style={{ padding: SP.md, paddingBottom: 52, gap: 4 }}>
          {product.brand && <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>{product.brand}</Text>}
          <Text numberOfLines={2} style={{ color: T.text, fontSize: 14, fontWeight: '600', lineHeight: 19, minHeight: 38 }}>{product.name}</Text>
          {product.reviewCount > 0 ? <Stars rating={product.averageRating} count={product.reviewCount} /> : <View style={{ height: 15 }} />}
        </View>
      </Pressable>
      <View style={{ position: 'absolute', top: 6, right: 6 }}>
        <WishlistHeart product={product} saved={saved} />
      </View>
      <View style={{ position: 'absolute', left: SP.md, right: SP.sm, bottom: SP.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
        <View style={{ flexShrink: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: T.text, fontSize: 15, fontWeight: '800' }}>{formatPrice(product.price)}</Text>
          {product.compareAtPrice && product.compareAtPrice > product.price ? (
            <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 11, textDecorationLine: 'line-through' }}>{formatPrice(product.compareAtPrice)}</Text>
          ) : null}
        </View>
        {product.inStock && <QuickAdd product={product} />}
      </View>
    </View>
  );
}

/** Columns for the product grid at the current width. */
export function useGrid(hPad: number) {
  const { width } = useWindowDimensions();
  const cols = width >= 900 ? 4 : width >= 600 ? 3 : 2;
  const gap = SP.md;
  const w = Math.floor((width - hPad * 2 - gap * (cols - 1)) / cols);
  return { cols, gap, cardW: w };
}

export function ProductGrid({ products, hPad }: { products: ShopProductCard[]; hPad: number }) {
  const { gap, cardW } = useGrid(hPad);
  const saved = useSavedIds();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {products.map(p => <ProductCard key={p.id} product={p} width={cardW} saved={saved.has(p.id)} />)}
    </View>
  );
}

export function GridSkeleton({ hPad, count = 4 }: { hPad: number; count?: number }) {
  const { gap, cardW } = useGrid(hPad);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ width: cardW }}><Skeleton rows={1} height={cardW + 110} borderRadius={R.lg} gap={0} /></View>
      ))}
    </View>
  );
}

/** Horizontal rail of cards that bleeds to the screen edges. */
export function ProductRail({ products, hPad, loading }: { products?: ShopProductCard[]; hPad: number; loading?: boolean }) {
  const saved = useSavedIds();
  const { width } = useWindowDimensions();
  const cardW = Math.min(180, Math.floor((width - hPad * 2 - SP.md) / 2.2));
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -hPad }}
      contentContainerStyle={{ paddingHorizontal: hPad, gap: SP.md }}
    >
      {loading && !products
        ? [0, 1, 2].map(i => <View key={i} style={{ width: cardW }}><Skeleton rows={1} height={cardW + 110} borderRadius={R.lg} gap={0} /></View>)
        : (products ?? []).map(p => <ProductCard key={p.id} product={p} width={cardW} saved={saved.has(p.id)} />)}
    </ScrollView>
  );
}
