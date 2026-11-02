import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import BottomSheet from '../../common/components/BottomSheet';
import PrimaryButton from '../../common/components/PrimaryButton';
import EmptyState from '../../dashboard/components/EmptyState';
import { apiErrorText } from '../../../api/apiError';
import { formatPrice } from '../common/format';
import { ShopCategory, ShopSort } from '../api/shop.types';
import { useCategories, useCategory, useFilters, useProductPages } from '../api/storeQueries';
import { ShopRoute, useShopNav } from './shopNav';
import { GridSkeleton, ProductGrid } from './ProductCard';
import { Chip, Field } from './ui';

export interface Filters {
  inStock: boolean;
  isNew: boolean;
  featured: boolean;
  minPrice?: number;
  maxPrice?: number;
  brands: string[];
  flavours: string[];
  sizes: string[];
  colours: string[];
}

const NO_FILTERS: Filters = { inStock: false, isNew: false, featured: false, brands: [], flavours: [], sizes: [], colours: [] };

const BANDS: { label: string; min?: number; max?: number }[] = [
  { label: 'Under ₹1,000', max: 1000 },
  { label: '₹1,000 – 2,500', min: 1000, max: 2500 },
  { label: '₹2,500 – 5,000', min: 2500, max: 5000 },
  { label: 'Over ₹5,000', min: 5000 },
];

const SORTS: { key: ShopSort; label: string }[] = [
  { key: 'featured', label: 'Featured' },
  { key: 'newest', label: 'Newest' },
  { key: 'price_asc', label: 'Price: low to high' },
  { key: 'price_desc', label: 'Price: high to low' },
  { key: 'rating', label: 'Top rated' },
  { key: 'name', label: 'Name A–Z' },
];

type ListKey = 'brands' | 'flavours' | 'sizes' | 'colours';
const LISTS: { key: ListKey; label: string }[] = [
  { key: 'brands', label: 'Brand' }, { key: 'flavours', label: 'Flavour' }, { key: 'sizes', label: 'Size' }, { key: 'colours', label: 'Colour' },
];

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
const priceLabel = (min?: number, max?: number) =>
  BANDS.find(b => b.min === min && b.max === max)?.label ??
  (min !== undefined && max !== undefined ? `${formatPrice(min)} – ${formatPrice(max)}` : min !== undefined ? `Over ${formatPrice(min)}` : `Under ${formatPrice(max)}`);

function find(tree: ShopCategory[], slug: string, parent: ShopCategory | null = null): { node: ShopCategory; parent: ShopCategory | null } | null {
  for (const c of tree) {
    if (c.slug === slug) return { node: c, parent };
    const hit = find(c.children ?? [], slug, c);
    if (hit) return hit;
  }
  return null;
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={{ color: T.textSub, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: SP.sm, marginTop: SP.lg }}>{children}</Text>;
}

function FilterSheet({ visible, onClose, value, onApply, category }: {
  visible: boolean; onClose: () => void; value: Filters; onApply: (f: Filters) => void; category?: string;
}) {
  const { height } = useWindowDimensions();
  const options = useFilters(category);
  const [draft, setDraft] = useState<Filters>(value);
  const [minText, setMinText] = useState('');
  const [maxText, setMaxText] = useState('');
  // Reset the draft to what's applied each time the sheet opens.
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setDraft(value);
      const band = BANDS.some(b => b.min === value.minPrice && b.max === value.maxPrice);
      setMinText(!band && value.minPrice !== undefined ? String(value.minPrice) : '');
      setMaxText(!band && value.maxPrice !== undefined ? String(value.maxPrice) : '');
    }
  }

  const setCustom = (minS: string, maxS: string) => {
    setMinText(minS); setMaxText(maxS);
    const min = minS ? Number(minS) : undefined;
    const max = maxS ? Number(maxS) : undefined;
    setDraft(d => ({ ...d, minPrice: min, maxPrice: max }));
  };

  const count = countFilters(draft);
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Filters"
      leftAction={{ label: 'Reset', onPress: () => { setDraft({ ...NO_FILTERS }); setMinText(''); setMaxText(''); } }}
    >
      <ScrollView style={{ maxHeight: height * 0.62 }} contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: SP.lg }} keyboardShouldPersistTaps="handled">
        <SectionLabel>Show</SectionLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm }}>
          <Chip label="In stock" selected={draft.inStock} onPress={() => setDraft(d => ({ ...d, inStock: !d.inStock }))} />
          <Chip label="New" selected={draft.isNew} onPress={() => setDraft(d => ({ ...d, isNew: !d.isNew }))} />
          <Chip label="Bestsellers" selected={draft.featured} onPress={() => setDraft(d => ({ ...d, featured: !d.featured }))} />
        </View>

        <SectionLabel>Price</SectionLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm }}>
          {BANDS.map(b => {
            const on = draft.minPrice === b.min && draft.maxPrice === b.max;
            return (
              <Chip key={b.label} label={b.label} selected={on} onPress={() => {
                setMinText(''); setMaxText('');
                setDraft(d => (on ? { ...d, minPrice: undefined, maxPrice: undefined } : { ...d, minPrice: b.min, maxPrice: b.max }));
              }} />
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: SP.md, marginTop: SP.md }}>
          <Field style={{ flex: 1, marginBottom: 0 }} label="Min ₹" keyboardType="number-pad" value={minText} placeholder={options.data ? String(Math.floor(options.data.minPrice)) : '0'} onChangeText={t => setCustom(t.replace(/\D/g, ''), maxText)} />
          <Field style={{ flex: 1, marginBottom: 0 }} label="Max ₹" keyboardType="number-pad" value={maxText} placeholder={options.data ? String(Math.ceil(options.data.maxPrice)) : 'Any'} onChangeText={t => setCustom(minText, t.replace(/\D/g, ''))} />
        </View>

        {LISTS.map(({ key, label }) => {
          const values = options.data?.[key] ?? [];
          if (!values.length) return null;
          return (
            <View key={key}>
              <SectionLabel>{label}</SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm }}>
                {values.map(v => <Chip key={v} label={v} selected={draft[key].includes(v)} onPress={() => setDraft(d => ({ ...d, [key]: toggle(d[key], v) }))} />)}
              </View>
            </View>
          );
        })}
      </ScrollView>
      <View style={{ paddingHorizontal: SP.xl, paddingTop: SP.md, borderTopWidth: 1, borderTopColor: T.line }}>
        <PrimaryButton label={count ? `Show results (${count} filter${count > 1 ? 's' : ''})` : 'Show results'} onPress={() => { onApply(draft); onClose(); }} />
      </View>
    </BottomSheet>
  );
}

export function countFilters(f: Filters): number {
  return (f.inStock ? 1 : 0) + (f.isNew ? 1 : 0) + (f.featured ? 1 : 0) +
    (f.minPrice !== undefined || f.maxPrice !== undefined ? 1 : 0) +
    f.brands.length + f.flavours.length + f.sizes.length + f.colours.length;
}

export default function ListingScreen({ route }: { route: Extract<ShopRoute, { id: 'listing' }> }) {
  const nav = useShopNav();
  const { hPad } = useLayout();
  const [category, setCategory] = useState(route.category);
  const [filters, setFilters] = useState<Filters>({ ...NO_FILTERS, featured: !!route.featured, isNew: !!route.isNew });
  const [sort, setSort] = useState<ShopSort>(route.isNew ? 'newest' : 'featured');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const tree = useCategories();
  const current = useCategory(category);
  const place = useMemo(() => (category && tree.data ? find(tree.data, category) : null), [tree.data, category]);
  // Sub-category chips: the category's children, or its siblings when it is a sub-category.
  const chipParent = place ? (place.node.children?.length ? place.node : place.parent) : null;

  const query = {
    pageSize: 12, search: route.search, category, sort,
    minPrice: filters.minPrice, maxPrice: filters.maxPrice,
    brands: filters.brands, flavours: filters.flavours, sizes: filters.sizes, colours: filters.colours,
    inStock: filters.inStock || undefined, featured: filters.featured || undefined, isNew: filters.isNew || undefined,
  };
  const list = useProductPages(query);
  const products = list.data?.pages.flatMap(p => p.items) ?? [];
  const total = list.data?.pages[0]?.totalRecords ?? 0;

  const title = route.search ? `“${route.search}”` : current.data?.name ?? route.title ?? 'All products';
  const eyebrow = route.search ? 'Search results' : category ? 'Category' : 'Shop';

  const active: { key: string; label: string; remove: () => void }[] = [];
  if (filters.inStock) active.push({ key: 'stock', label: 'In stock', remove: () => setFilters(f => ({ ...f, inStock: false })) });
  if (filters.isNew) active.push({ key: 'new', label: 'New', remove: () => setFilters(f => ({ ...f, isNew: false })) });
  if (filters.featured) active.push({ key: 'best', label: 'Bestsellers', remove: () => setFilters(f => ({ ...f, featured: false })) });
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined)
    active.push({ key: 'price', label: priceLabel(filters.minPrice, filters.maxPrice), remove: () => setFilters(f => ({ ...f, minPrice: undefined, maxPrice: undefined })) });
  for (const { key } of LISTS)
    for (const v of filters[key]) active.push({ key: `${key}:${v}`, label: v, remove: () => setFilters(f => ({ ...f, [key]: f[key].filter(x => x !== v) })) });

  const nFilters = countFilters(filters);

  return (
    <Screen>
      <ScreenHeader eyebrow={eyebrow} title={title} onBack={nav.pop} />
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: 60 }}>
        {chipParent && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -hPad, marginBottom: SP.md }} contentContainerStyle={{ paddingHorizontal: hPad, gap: SP.sm }}>
            <Chip label={`All ${chipParent.name}`} selected={category === chipParent.slug} onPress={() => setCategory(chipParent.slug)} />
            {chipParent.children.map(c => (
              <Chip key={c.id} label={`${c.name} · ${c.productCount}`} accessibilityLabel={`${c.name}, ${c.productCount} products`} selected={category === c.slug} onPress={() => setCategory(c.slug)} />
            ))}
          </ScrollView>
        )}
        {current.data?.description && !route.search ? (
          <Text style={{ color: T.textSub, fontSize: 13, lineHeight: 19, marginBottom: SP.md }}>{current.data.description}</Text>
        ) : null}

        {/* Toolbar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm, marginBottom: SP.md }}>
          <Chip label={nFilters ? `Filters · ${nFilters}` : 'Filters'} icon="sliders" selected={nFilters > 0} onPress={() => setFilterOpen(true)} />
          <Chip label={SORTS.find(s => s.key === sort)?.label ?? 'Sort'} icon="chevron-down" onPress={() => setSortOpen(true)} accessibilityLabel={`Sort: ${SORTS.find(s => s.key === sort)?.label}`} />
          <Text style={{ flex: 1, textAlign: 'right', color: T.textFaint, fontSize: 12 }} numberOfLines={1}>
            {list.data ? `${total} ${total === 1 ? 'product' : 'products'}` : ''}
          </Text>
        </View>

        {active.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, marginBottom: SP.md }}>
            {active.map(a => <Chip key={a.key} label={a.label} icon="x" selected onPress={a.remove} accessibilityLabel={`Remove filter ${a.label}`} />)}
            <Pressable onPress={() => setFilters({ ...NO_FILTERS })} accessibilityRole="button" accessibilityLabel="Clear all filters" style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: SP.sm }}>
              <Text style={{ color: T.brand, fontSize: 13, fontWeight: '700' }}>Clear all</Text>
            </Pressable>
          </View>
        )}

        {list.isPending && <GridSkeleton hPad={hPad} count={4} />}
        {list.isError && (
          <EmptyState icon="alert-circle" tone="error" title="Couldn’t load products" subtitle={apiErrorText(list.error)} action={{ label: 'Retry', onPress: () => list.refetch() }} />
        )}
        {list.data && products.length === 0 && (
          <EmptyState
            icon="search"
            title={route.search ? `Nothing matches “${route.search}”` : 'No products match'}
            subtitle={nFilters ? 'Try removing a filter.' : 'Check back soon — new stock arrives every week.'}
            action={nFilters ? { label: 'Clear all filters', onPress: () => setFilters({ ...NO_FILTERS }) } : undefined}
          />
        )}
        {products.length > 0 && <ProductGrid products={products} hPad={hPad} />}

        {list.hasNextPage && (
          <PrimaryButton
            label={`Load more (${total - products.length} left)`}
            variant="secondary"
            loading={list.isFetchingNextPage}
            onPress={() => list.fetchNextPage()}
            style={{ marginTop: SP.lg }}
          />
        )}
        {list.data && products.length > 0 && !list.hasNextPage && products.length > 6 && (
          <Text style={{ color: T.textFaint, textAlign: 'center', fontSize: 12, marginTop: SP.lg }}>You’ve seen all {total} products</Text>
        )}
      </ScrollView>

      <FilterSheet visible={filterOpen} onClose={() => setFilterOpen(false)} value={filters} onApply={setFilters} category={category} />

      <BottomSheet visible={sortOpen} onClose={() => setSortOpen(false)} title="Sort by">
        <View style={{ paddingVertical: SP.sm }}>
          {SORTS.map(s => (
            <Pressable
              key={s.key}
              onPress={() => { setSort(s.key); setSortOpen(false); }}
              accessibilityRole="radio"
              accessibilityState={{ checked: sort === s.key }}
              accessibilityLabel={s.label}
              style={({ pressed }) => ({ minHeight: 52, paddingHorizontal: SP.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: pressed ? T.bgInputActive : 'transparent' })}
            >
              <Text style={{ color: sort === s.key ? T.brand : T.text, fontSize: 15, fontWeight: sort === s.key ? '700' : '400' }}>{s.label}</Text>
              {sort === s.key && <Feather name="check" size={18} color={T.brand} />}
            </Pressable>
          ))}
        </View>
      </BottomSheet>
    </Screen>
  );
}

