import React, { useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { T, SP } from '../../../theme';
import SearchBar from '../../common/components/SearchBar';
import Skeleton from '../../common/components/Skeleton';
import StatusPill from '../../common/components/StatusPill';
import PaginationFooter from '../../common/components/PaginationFooter';
import { useToast } from '../../common/components/Toast';
import EmptyState from '../../common/components/EmptyState';
import { useApiAccess } from '../../access/context/AccessContext';
import { apiErrorText } from '../../../api/apiError';
import { useAdminCategories, useAdminProducts, useDeleteProduct } from '../api/adminQueries';
import { ProductStatusFilter } from '../api/adminApi';
import { ShopAdminProductRow } from '../api/shop.types';
import { formatPrice } from '../common/format';
import {
  ChipRow, ConfirmSheet, ErrorView, IconButton, PickerField, RowCard, SmallButton, Thumb, orderCategories, useDebounced,
} from './components/kit';
import { ShopNav } from './nav';

const PAGE_SIZE = 15;

export default function ProductsTab({ nav }: { nav: ShopNav }) {
  const { canCreate, canEdit, canDelete } = useApiAccess('shop');
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProductStatusFilter>('all');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim());
  const query = { page, pageSize: PAGE_SIZE, search: q || undefined, status, categoryId: categoryId ?? undefined };
  const { data, isPending, isError, error, refetch, isRefetching, isPlaceholderData } = useAdminProducts(query);
  const categories = useAdminCategories();
  const remove = useDeleteProduct();
  const [deleting, setDeleting] = useState<ShopAdminProductRow | null>(null);

  const reset = <V,>(fn: (v: V) => void) => (v: V) => { fn(v); setPage(1); };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={isRefetching && !isPlaceholderData} onRefresh={refetch} tintColor={T.brand} colors={[T.brand]} />}
    >
      {canCreate && <SmallButton label="Add product" icon="plus" variant="brand" onPress={() => nav.openProduct(null)} style={{ alignSelf: 'flex-start', marginBottom: SP.md }} />}
      <SearchBar value={search} onChangeText={reset(setSearch)} placeholder="Search name or SKU" style={{ marginBottom: SP.md }} />
      <PickerField
        label="Category"
        value={categoryId}
        onChange={reset(setCategoryId)}
        options={[
          { value: null, label: 'All categories' },
          ...orderCategories(categories.data ?? []).map(c => ({ value: c.id as number | null, label: c.name, indent: !!c.parentId })),
        ]}
      />
      <ChipRow<ProductStatusFilter>
        label="Visibility"
        value={status}
        onChange={reset(setStatus)}
        items={[{ key: 'all', label: 'All' }, { key: 'active', label: 'Active' }, { key: 'inactive', label: 'Hidden' }]}
        style={{ marginBottom: SP.lg }}
      />

      {isPending ? <Skeleton rows={5} height={96} />
        : isError ? <ErrorView error={error} onRetry={refetch} />
        : !data.items.length ? (
          <EmptyState icon="box" title="No products found" subtitle={q ? 'Try a different search.' : 'Create your first product to start selling.'}
            action={canCreate && !q ? { label: 'Add product', onPress: () => nav.openProduct(null) } : undefined} />
        ) : (
          <View style={{ opacity: isPlaceholderData ? 0.6 : 1 }}>
            <Text style={{ color: T.textFaint, fontSize: 12, marginBottom: SP.sm }}>
              {data.totalRecords} product{data.totalRecords === 1 ? '' : 's'}
            </Text>
            {data.items.map(p => (
              <ProductRow key={p.id} p={p}
                onOpen={canEdit ? () => nav.openProduct(p.id) : undefined}
                onDelete={canDelete ? () => setDeleting(p) : undefined} />
            ))}
            <PaginationFooter page={page} totalPages={data.totalPages} onChange={setPage} />
          </View>
        )}

      <ConfirmSheet
        visible={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name ?? 'product'}?`}
        message="It disappears from the store immediately. Past orders keep their records."
        confirmLabel="Delete product"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, {
          onSuccess: () => { toast.show({ message: `${deleting.name} deleted` }); setDeleting(null); },
          onError: e => { toast.show({ type: 'error', message: apiErrorText(e) }); setDeleting(null); },
        })}
      />
    </ScrollView>
  );
}

function ProductRow({ p, onOpen, onDelete }: { p: ShopAdminProductRow; onOpen?: () => void; onDelete?: () => void }) {
  const stockColour = p.totalStock === 0 ? T.err : p.totalStock <= 5 ? T.brandGold : T.textSub;
  return (
    <RowCard onPress={onOpen} label={`Edit ${p.name}`}>
      <View style={{ flexDirection: 'row', gap: SP.md }}>
        <Thumb uri={p.primaryImageUrl} size={56} icon="box" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={2} style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>{p.name}</Text>
          <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 12 }}>
            {p.sku} · {p.variantCount} variant{p.variantCount === 1 ? '' : 's'}
          </Text>
          {!!p.categoryName && <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 12 }}>{p.categoryName}</Text>}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: SP.sm, marginTop: 4 }}>
            <Text style={{ color: T.text, fontSize: 15, fontWeight: '800' }}>{formatPrice(p.price)}</Text>
            {!!p.compareAtPrice && p.compareAtPrice > p.price && (
              <Text style={{ color: T.textFaint, fontSize: 12, textDecorationLine: 'line-through' }}>{formatPrice(p.compareAtPrice)}</Text>
            )}
            <Text style={{ color: stockColour, fontSize: 12, fontWeight: '700' }}>{p.totalStock} in stock</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SP.sm }}>
            <StatusPill label={p.isActive ? 'Active' : 'Hidden'} tone={p.isActive ? 'ok' : 'neutral'} />
            {p.isFeatured && <StatusPill label="Featured" tone="warn" />}
            {p.isNew && <StatusPill label="New" tone="info" />}
          </View>
        </View>
        <View style={{ justifyContent: 'space-between', marginRight: -6, marginTop: -6 }}>
          {onOpen && <IconButton icon="edit-2" label={`Edit ${p.name}`} onPress={onOpen} />}
          {onDelete && <IconButton icon="trash-2" label={`Delete ${p.name}`} tone={T.err} onPress={onDelete} />}
        </View>
      </View>
    </RowCard>
  );
}
