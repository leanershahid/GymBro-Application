import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, Keyboard } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R, withAlpha } from '../../../theme';
import EmptyState from '../../dashboard/components/EmptyState';
import Skeleton from '../../common/components/Skeleton';
import { formatPrice } from '../common/format';
import { useCategories, useProducts, useStoreSettings, useSuggest } from '../api/storeQueries';
import { useShopNav } from './shopNav';
import { ProductRail } from './ProductCard';
import { ProductImage, SectionTitle } from './ui';
import { clearRecent, loadRecent, pushRecent } from './recentSearches';

const CATEGORY_ICON: Record<string, React.ComponentProps<typeof Feather>['name']> = {
  supplements: 'zap', apparel: 'shopping-bag', accessories: 'watch', equipment: 'activity',
};

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/** Search field with focus, submit and cancel (SearchBar has no submit hook). */
function SearchField({ value, onChange, onSubmit, onFocus, active, onCancel }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; onFocus: () => void; active: boolean; onCancel: () => void;
}) {
  const ref = useRef<TextInput>(null);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 16, paddingHorizontal: 14, backgroundColor: T.bgInput, borderWidth: 1, borderColor: active ? T.brand : T.line }}>
        <Feather name="search" size={18} color={T.textFaint} />
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChange}
          onFocus={onFocus}
          onSubmitEditing={onSubmit}
          placeholder="Search protein, shakers, tees…"
          placeholderTextColor={T.textFaint}
          accessibilityLabel="Search the shop"
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          style={{ flex: 1, minWidth: 0, color: T.text, fontSize: 15, marginLeft: 10, paddingVertical: 0, height: 46 }}
        />
        {value.length > 0 && (
          <Pressable onPress={() => { onChange(''); ref.current?.focus(); }} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search" style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="x" size={18} color={T.textSub} />
          </Pressable>
        )}
      </View>
      {active && (
        <Pressable onPress={() => { ref.current?.blur(); onCancel(); }} accessibilityRole="button" accessibilityLabel="Cancel search" style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}>
          <Text style={{ color: T.brand, fontSize: 14, fontWeight: '700' }}>Cancel</Text>
        </Pressable>
      )}
    </View>
  );
}

function Row({ icon, label, sub, onPress, onRemoveLabel }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; sub?: string; onPress: () => void; onRemoveLabel?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={onRemoveLabel ?? label}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 48, paddingHorizontal: SP.sm, borderRadius: R.md, backgroundColor: pressed ? T.bgInput : 'transparent' })}
    >
      <Feather name={icon} size={16} color={T.textFaint} />
      <Text numberOfLines={1} style={{ flex: 1, color: T.text, fontSize: 14 }}>{label}</Text>
      {sub && <Text style={{ color: T.textFaint, fontSize: 12 }}>{sub}</Text>}
    </Pressable>
  );
}

function SearchPanel({ term, recent, onPick, onClearRecent }: { term: string; recent: string[]; onPick: (s: string) => void; onClearRecent: () => void }) {
  const nav = useShopNav();
  const q = useDebounced(term.trim(), 250);
  const suggest = useSuggest(q);
  const popular = useProducts({ featured: true, pageSize: 5, sort: 'featured' });

  if (q.length < 2) {
    return (
      <View style={{ gap: SP.lg }}>
        {recent.length > 0 && (
          <View>
            <SectionTitle title="Recent searches" action={{ label: 'Clear', onPress: onClearRecent }} />
            {recent.map(s => <Row key={s} icon="clock" label={s} onPress={() => onPick(s)} />)}
          </View>
        )}
        <View>
          <SectionTitle title="Popular" />
          {popular.isPending && <Skeleton rows={3} height={44} borderRadius={R.md} gap={6} />}
          {popular.data?.items.map(p => (
            <Row key={p.id} icon="trending-up" label={p.name} sub={formatPrice(p.price)} onPress={() => nav.push({ id: 'product', slug: p.slug })} />
          ))}
        </View>
      </View>
    );
  }

  const data = suggest.data;
  const empty = data && !data.products.length && !data.categories.length;
  return (
    <View style={{ gap: SP.md }}>
      {suggest.isFetching && !data && <ActivityIndicator color={T.brand} style={{ marginVertical: SP.lg }} />}
      {data?.categories.length ? (
        <View>
          <SectionTitle title="Categories" />
          {data.categories.map(c => (
            <Row key={c.id} icon="folder" label={c.name} onPress={() => nav.push({ id: 'listing', category: c.slug, title: c.name })} />
          ))}
        </View>
      ) : null}
      {data?.products.length ? (
        <View>
          <SectionTitle title="Products" />
          {data.products.map(p => (
            <Pressable
              key={p.id}
              onPress={() => { pushRecent(q); nav.push({ id: 'product', slug: p.slug }); }}
              accessibilityRole="button"
              accessibilityLabel={`${p.name}, ${formatPrice(p.price)}`}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 56, padding: 6, borderRadius: R.md, backgroundColor: pressed ? T.bgInput : 'transparent' })}
            >
              <ProductImage uri={p.primaryImageUrl} style={{ width: 44, height: 44, borderRadius: R.sm }} iconSize={18} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: T.text, fontSize: 14, fontWeight: '600' }}>{p.name}</Text>
                <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 12 }}>{p.categoryName ?? p.brand ?? ''}</Text>
              </View>
              <Text style={{ color: T.text, fontSize: 13, fontWeight: '700' }}>{formatPrice(p.price)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {empty && <EmptyState icon="search" title={`No matches for “${q}”`} subtitle="Try a different word, or browse the categories." />}
      {suggest.isError && <EmptyState icon="alert-circle" tone="error" title="Search isn’t available right now" action={{ label: 'Retry', onPress: () => suggest.refetch() }} />}
      <Pressable
        onPress={() => onPick(q)}
        accessibilityRole="button"
        accessibilityLabel={`See all results for ${q}`}
        style={({ pressed }) => ({ minHeight: 48, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.brandBorder, backgroundColor: pressed ? withAlpha(T.brand, 0.16) : T.brandDim })}
      >
        <Text style={{ color: T.brand, fontWeight: '700' }}>See all results for “{q}”</Text>
      </Pressable>
    </View>
  );
}

export default function HomeTab({ hPad }: { hPad: number }) {
  const nav = useShopNav();
  const store = useStoreSettings();
  const categories = useCategories();
  const bestsellers = useProducts({ featured: true, pageSize: 10, sort: 'featured' });
  const fresh = useProducts({ isNew: true, pageSize: 10, sort: 'newest' });

  const [term, setTerm] = useState('');
  const [active, setActive] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => { loadRecent().then(setRecent); }, []);

  const search = (s: string) => {
    const q = s.trim();
    if (!q) return;
    Keyboard.dismiss();
    pushRecent(q).then(setRecent);
    nav.push({ id: 'listing', search: q });
  };

  const failed = categories.isError && bestsellers.isError;

  return (
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: 60, gap: SP.xl }}>
      <SearchField
        value={term}
        onChange={setTerm}
        onSubmit={() => search(term)}
        onFocus={() => setActive(true)}
        active={active}
        onCancel={() => { setActive(false); setTerm(''); Keyboard.dismiss(); }}
      />

      {active ? (
        <SearchPanel term={term} recent={recent} onPick={s => { setTerm(s); search(s); }} onClearRecent={() => clearRecent().then(setRecent)} />
      ) : failed ? (
        <EmptyState icon="wifi-off" tone="error" title="Couldn’t load the shop" subtitle="Check your connection and try again." action={{ label: 'Retry', onPress: () => { categories.refetch(); bestsellers.refetch(); fresh.refetch(); } }} />
      ) : (
        <>
          {/* Promise strip */}
          {store.data && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, padding: SP.md, borderRadius: R.lg, backgroundColor: T.brandDim, borderWidth: 1, borderColor: T.brandBorder }}>
              <Feather name="truck" size={20} color={T.brand} />
              <Text style={{ flex: 1, color: T.text, fontSize: 13, lineHeight: 18 }}>
                Free delivery over <Text style={{ fontWeight: '800' }}>{formatPrice(store.data.freeShippingThreshold)}</Text> · {store.data.returnDays}-day returns
              </Text>
            </View>
          )}

          <View>
            <SectionTitle title="Shop by category" action={{ label: 'All products', onPress: () => nav.push({ id: 'listing', title: 'All products' }) }} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -hPad }} contentContainerStyle={{ paddingHorizontal: hPad, gap: SP.sm }}>
              {categories.isPending && [0, 1, 2, 3].map(i => <View key={i} style={{ width: 120 }}><Skeleton rows={1} height={96} borderRadius={R.lg} gap={0} /></View>)}
              {categories.data?.map(c => (
                <Pressable
                  key={c.id}
                  onPress={() => nav.push({ id: 'listing', category: c.slug, title: c.name })}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.name}, ${c.productCount} products`}
                  style={({ pressed }) => ({
                    width: 120, minHeight: 96, padding: SP.md, borderRadius: R.lg, justifyContent: 'space-between',
                    backgroundColor: pressed ? T.bgInputActive : T.bgInput, borderWidth: 1, borderColor: T.line,
                  })}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: T.brandDim }}>
                    <Feather name={CATEGORY_ICON[c.slug] ?? 'grid'} size={18} color={T.brand} />
                  </View>
                  <View>
                    <Text numberOfLines={1} style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>{c.name}</Text>
                    <Text style={{ color: T.textFaint, fontSize: 12 }}>{c.productCount} {c.productCount === 1 ? 'item' : 'items'}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View>
            <SectionTitle title="Bestsellers" action={{ label: 'See all', onPress: () => nav.push({ id: 'listing', featured: true, title: 'Bestsellers' }) }} />
            {bestsellers.data && !bestsellers.data.items.length
              ? <Text style={{ color: T.textFaint }}>Nothing here yet.</Text>
              : <ProductRail products={bestsellers.data?.items} loading={bestsellers.isPending} hPad={hPad} />}
          </View>

          <View>
            <SectionTitle title="New arrivals" action={{ label: 'See all', onPress: () => nav.push({ id: 'listing', isNew: true, title: 'New arrivals' }) }} />
            {fresh.data && !fresh.data.items.length
              ? <Text style={{ color: T.textFaint }}>Nothing new this week.</Text>
              : <ProductRail products={fresh.data?.items} loading={fresh.isPending} hPad={hPad} />}
          </View>
        </>
      )}
    </ScrollView>
  );
}
