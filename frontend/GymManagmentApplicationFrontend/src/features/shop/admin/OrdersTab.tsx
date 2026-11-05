import React, { useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { T, SP } from '../../../theme';
import SearchBar from '../../common/components/SearchBar';
import Skeleton from '../../common/components/Skeleton';
import StatusPill from '../../common/components/StatusPill';
import PaginationFooter from '../../common/components/PaginationFooter';
import EmptyState from '../../common/components/EmptyState';
import { useAdminOrders } from '../api/adminQueries';
import { ShopOrderStatus } from '../api/shop.types';
import { formatDate, formatMoney, ORDER_STATUS_LABEL } from '../common/format';
import { ChipRow, ErrorView, ORDER_STATUSES, RowCard, STATUS_TONE, Thumb, useDebounced } from './components/kit';
import { ShopNav } from './nav';

const PAGE_SIZE = 20;
type Filter = 'all' | ShopOrderStatus;

export default function OrdersTab({ nav, initialStatus }: { nav: ShopNav; initialStatus?: ShopOrderStatus }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Filter>(initialStatus ?? 'all');
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim());
  const { data, isPending, isError, error, refetch, isRefetching, isPlaceholderData } = useAdminOrders({
    page, pageSize: PAGE_SIZE, search: q || undefined, status: status === 'all' ? undefined : status,
  });

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={isRefetching && !isPlaceholderData} onRefresh={refetch} tintColor={T.brand} colors={[T.brand]} />}
    >
      <SearchBar value={search} onChangeText={t => { setSearch(t); setPage(1); }} placeholder="Order number, name or email" style={{ marginBottom: SP.md }} />
      <ChipRow<Filter>
        label="Order status"
        value={status}
        onChange={k => { setStatus(k); setPage(1); }}
        items={[{ key: 'all', label: 'All' }, ...ORDER_STATUSES.map(s => ({ key: s as Filter, label: ORDER_STATUS_LABEL[s] }))]}
        style={{ marginBottom: SP.lg }}
      />

      {isPending ? <Skeleton rows={6} height={84} />
        : isError ? <ErrorView error={error} onRetry={refetch} />
        : !data.items.length ? (
          <EmptyState icon="package" title={q || status !== 'all' ? 'No matching orders' : 'No orders yet'}
            subtitle={q || status !== 'all' ? 'Try another search or status.' : 'Orders show up here as soon as members check out.'} />
        ) : (
          <View style={{ opacity: isPlaceholderData ? 0.6 : 1 }}>
            <Text style={{ color: T.textFaint, fontSize: 12, marginBottom: SP.sm }}>{data.totalRecords} order{data.totalRecords === 1 ? '' : 's'}</Text>
            {data.items.map(o => (
              <RowCard key={o.id} onPress={() => nav.openOrder(o.orderNumber)}
                label={`Order ${o.orderNumber} from ${o.customerName ?? o.customerEmail ?? 'customer'}, ${ORDER_STATUS_LABEL[o.status]}, ${formatMoney(o.total)}`}>
                <View style={{ flexDirection: 'row', gap: SP.md, alignItems: 'center' }}>
                  <Thumb uri={o.previewImages[0]} size={48} icon="package" />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>#{o.orderNumber}</Text>
                    <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 12 }}>{o.customerName ?? '—'}</Text>
                    <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 11 }}>
                      {formatDate(o.placedAt)} · {o.itemCount} item{o.itemCount === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={{ color: T.text, fontSize: 14, fontWeight: '800' }}>{formatMoney(o.total)}</Text>
                    <StatusPill label={ORDER_STATUS_LABEL[o.status]} tone={STATUS_TONE[o.status]} />
                  </View>
                </View>
              </RowCard>
            ))}
            <PaginationFooter page={page} totalPages={data.totalPages} onChange={setPage} />
          </View>
        )}
    </ScrollView>
  );
}
