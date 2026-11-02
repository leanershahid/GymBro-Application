import React, { useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { T, SP } from '../../../theme';
import SearchBar from '../../common/components/SearchBar';
import Skeleton from '../../common/components/Skeleton';
import StatusPill from '../../common/components/StatusPill';
import PaginationFooter from '../../common/components/PaginationFooter';
import Avatar from '../../common/components/Avatar';
import EmptyState from '../../dashboard/components/EmptyState';
import { useAdminCustomers } from '../api/adminQueries';
import { formatDate, formatPrice } from '../common/format';
import { ErrorView, RowCard, useDebounced } from './components/kit';
import { ShopNav } from './nav';

const PAGE_SIZE = 20;

export default function CustomersTab({ nav }: { nav: ShopNav }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim());
  const { data, isPending, isError, error, refetch, isRefetching, isPlaceholderData } = useAdminCustomers({ page, pageSize: PAGE_SIZE, search: q || undefined });

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={isRefetching && !isPlaceholderData} onRefresh={refetch} tintColor={T.brand} colors={[T.brand]} />}
    >
      <SearchBar value={search} onChangeText={t => { setSearch(t); setPage(1); }} placeholder="Name, email or phone" style={{ marginBottom: SP.lg }} />
      {isPending ? <Skeleton rows={6} height={88} />
        : isError ? <ErrorView error={error} onRetry={refetch} />
        : !data.items.length ? <EmptyState icon="users" title={q ? 'No matching customers' : 'No customers yet'} />
        : (
          <View style={{ opacity: isPlaceholderData ? 0.6 : 1 }}>
            <Text style={{ color: T.textFaint, fontSize: 12, marginBottom: SP.sm }}>{data.totalRecords} customer{data.totalRecords === 1 ? '' : 's'}</Text>
            {data.items.map(c => {
              const name = `${c.firstName} ${c.lastName}`.trim();
              return (
                <RowCard key={c.id} onPress={() => nav.openCustomer(c.id)} label={`${name}, ${c.ordersCount} orders, ${formatPrice(c.totalSpent)} spent`}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
                    <Avatar size={44} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>{name}</Text>
                      <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 12 }}>{c.email}</Text>
                      {!!c.phone && <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 12 }}>{c.phone}</Text>}
                      <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 11, marginTop: 2 }}>Joined {formatDate(c.createdAt)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={{ color: T.text, fontSize: 14, fontWeight: '800' }}>{formatPrice(c.totalSpent)}</Text>
                      <Text style={{ color: T.textSub, fontSize: 12 }}>{c.ordersCount} order{c.ordersCount === 1 ? '' : 's'}</Text>
                      <StatusPill label={c.isActive ? 'Active' : 'Inactive'} tone={c.isActive ? 'ok' : 'err'} />
                    </View>
                  </View>
                </RowCard>
              );
            })}
            <PaginationFooter page={page} totalPages={data.totalPages} onChange={setPage} />
          </View>
        )}
    </ScrollView>
  );
}
