import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { T, SP } from '../../../theme';
import SearchBar from '../../common/components/SearchBar';
import Skeleton from '../../common/components/Skeleton';
import StatusPill from '../../common/components/StatusPill';
import PaginationFooter from '../../common/components/PaginationFooter';
import { useToast } from '../../common/components/Toast';
import EmptyState from '../../dashboard/components/EmptyState';
import { useApiAccess } from '../../access/context/AccessContext';
import { apiErrorText } from '../../../api/apiError';
import { useAdminInventory, useUpdateInventory } from '../api/adminQueries';
import { ShopInventoryRow } from '../api/shop.types';
import { ChipRow, ErrorView, IconButton, NumberBox, RowCard, SmallButton, Thumb, useDebounced } from './components/kit';
import { ShopNav } from './nav';

const PAGE_SIZE = 20;

export default function InventoryTab({ nav, initialLowOnly }: { nav: ShopNav; initialLowOnly?: boolean }) {
  const [search, setSearch] = useState('');
  const [low, setLow] = useState<'all' | 'low'>(initialLowOnly ? 'low' : 'all');
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim());
  const { data, isPending, isError, error, refetch, isRefetching, isPlaceholderData } =
    useAdminInventory({ page, pageSize: PAGE_SIZE, search: q || undefined, lowStockOnly: low === 'low' });

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={isRefetching && !isPlaceholderData} onRefresh={refetch} tintColor={T.brand} colors={[T.brand]} />}
    >
      <Text style={{ color: T.textSub, fontSize: 13, marginBottom: SP.md }}>
        Stock on hand for every variant. Reserved units are held by orders that haven't shipped.
      </Text>
      <SearchBar value={search} onChangeText={t => { setSearch(t); setPage(1); }} placeholder="Search product or SKU" style={{ marginBottom: SP.md }} />
      <ChipRow<'all' | 'low'> label="Stock filter" value={low} onChange={k => { setLow(k); setPage(1); }} style={{ marginBottom: SP.lg }}
        items={[{ key: 'all', label: 'All variants' }, { key: 'low', label: 'Low stock', icon: 'alert-triangle' }]} />

      {isPending ? <Skeleton rows={5} height={150} />
        : isError ? <ErrorView error={error} onRetry={refetch} />
        : !data.items.length ? <EmptyState icon="layers" title={low === 'low' ? 'Nothing is running low' : 'No variants found'} />
        : (
          <View style={{ opacity: isPlaceholderData ? 0.6 : 1 }}>
            {data.items.map(i => <StockRow key={i.variantId} item={i} onOpenProduct={nav.can('products') ? () => nav.openProduct(i.productId) : undefined} />)}
            <PaginationFooter page={page} totalPages={data.totalPages} onChange={setPage} />
          </View>
        )}
    </ScrollView>
  );
}

function StockRow({ item, onOpenProduct }: { item: ShopInventoryRow; onOpenProduct?: () => void }) {
  const { canEdit } = useApiAccess('shop');
  const toast = useToast();
  const update = useUpdateInventory();
  const [onHand, setOnHand] = useState(String(item.quantityOnHand));
  const [threshold, setThreshold] = useState(String(item.lowStockThreshold));
  useEffect(() => {
    setOnHand(String(item.quantityOnHand));
    setThreshold(String(item.lowStockThreshold));
  }, [item.quantityOnHand, item.lowStockThreshold]);

  const onHandN = Number(onHand);
  const dirty = onHand !== String(item.quantityOnHand) || threshold !== String(item.lowStockThreshold);
  const onHandValid = onHand !== '' && Number.isInteger(onHandN) && onHandN >= item.reservedQuantity;
  const valid = onHandValid && threshold !== '' && Number(threshold) >= 0;
  const fail = (e: unknown) => toast.show({ type: 'error', message: apiErrorText(e) });

  const adjust = (delta: number) => update.mutate({ variantId: item.variantId, body: { adjustment: delta } }, { onError: fail });
  const saveRow = () => update.mutate(
    { variantId: item.variantId, body: { quantityOnHand: onHandN, lowStockThreshold: Number(threshold) } },
    { onSuccess: () => toast.show({ message: `${item.sku} updated` }), onError: fail },
  );

  return (
    <RowCard>
      <Pressable onPress={onOpenProduct} disabled={!onOpenProduct} accessibilityRole={onOpenProduct ? 'link' : undefined}
        accessibilityLabel={onOpenProduct ? `Open ${item.productName}` : undefined}
        style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 44 }}>
        <Thumb uri={item.imageUrl} size={44} icon="box" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>{item.productName}</Text>
          <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 12 }}>{item.variantName}</Text>
          <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 11 }}>{item.sku}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {item.available === 0 ? <StatusPill label="Out · 0" tone="err" />
            : item.isLowStock ? <StatusPill label={`Low · ${item.available}`} tone="warn" />
            : <Text style={{ color: T.text, fontSize: 15, fontWeight: '800' }}>{item.available}</Text>}
          <Text style={{ color: T.textFaint, fontSize: 11 }}>available · {item.reservedQuantity} reserved</Text>
        </View>
      </Pressable>

      {canEdit && (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', gap: SP.sm, marginTop: SP.md, paddingTop: SP.md, borderTopWidth: 1, borderTopColor: T.line }}>
          <View>
            <Text style={{ color: T.textFaint, fontSize: 11, marginBottom: 4 }}>On hand</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <IconButton icon="minus" label={`Remove one unit of ${item.sku}`} filled tone={T.text}
                disabled={item.quantityOnHand <= item.reservedQuantity || update.isPending} onPress={() => adjust(-1)} />
              <NumberBox value={onHand} onChangeText={setOnHand} label={`On hand for ${item.sku}`} invalid={!onHandValid} />
              <IconButton icon="plus" label={`Add one unit of ${item.sku}`} filled tone={T.text} disabled={update.isPending} onPress={() => adjust(1)} />
            </View>
          </View>
          <View>
            <Text style={{ color: T.textFaint, fontSize: 11, marginBottom: 4 }}>Alert at</Text>
            <NumberBox value={threshold} onChangeText={setThreshold} label={`Low-stock alert for ${item.sku}`} width={56} />
          </View>
          {dirty && <SmallButton label="Save" variant="brand" disabled={!valid} loading={update.isPending} onPress={saveRow} />}
          {!onHandValid && <Text style={{ color: T.err, fontSize: 12, width: '100%' }}>On hand can't be below the {item.reservedQuantity} reserved.</Text>}
        </View>
      )}
    </RowCard>
  );
}
