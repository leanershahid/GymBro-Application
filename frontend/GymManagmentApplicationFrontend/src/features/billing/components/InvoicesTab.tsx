import React, { useMemo, useState } from 'react';
import { View, FlatList, RefreshControl } from 'react-native';
import SearchBar from '../../common/components/SearchBar';
import StatusPill from '../../common/components/StatusPill';
import LoadingState from '../../common/components/LoadingState';
import PaginationFooter from '../../common/components/PaginationFooter';
import EmptyState from '../../dashboard/components/EmptyState';
import { describeApiError } from '../../../api/apiError';
import { useInvoices } from '../api/billingQueries';
import { Invoice, InvoiceFilter } from '../types/billing.types';
import InvoiceSheet from './InvoiceSheet';
import { FilterChips, ListRow, fmtMoney, fmtDate, invoiceTone, invoiceLabel } from './billingUi';
import { T, SP } from '../../../theme';

const FILTERS: { key: InvoiceFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'paid', label: 'Paid' },
  { key: 'refunded', label: 'Refunded' },
];
const PAGE_SIZE = 20;

export default function InvoicesTab({ onOpenMember }: { onOpenMember?: (memberId: number) => void }) {
  const [filter, setFilter] = useState<InvoiceFilter>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Invoice | null>(null);
  const { data, isLoading, error, refetch, isRefetching } = useInvoices(filter, page, PAGE_SIZE);

  // The API has no name filter, so search narrows the current page.
  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = data?.items ?? [];
    return q ? all.filter(i => (i.memberName ?? '').toLowerCase().includes(q) || i.invoiceNo.toLowerCase().includes(q)) : all;
  }, [data, search]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: SP.xl }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search member or invoice no. on this page" style={{ marginBottom: SP.md }} />
        <FilterChips options={FILTERS} value={filter} onChange={k => { setFilter(k); setPage(1); }} />
      </View>
      {isLoading ? <LoadingState label="Loading invoices…" /> : error ? (
        <EmptyState icon="alert-triangle" tone="error" title="Couldn't load invoices"
          subtitle={describeApiError(error).message} action={{ label: 'Try again', onPress: () => refetch() }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: SP.xxl }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={T.brand} />}
          ListEmptyComponent={
            <EmptyState icon="file-text" title={search ? 'No matches on this page' : 'No invoices'}
              subtitle={search ? 'Try another name, or move to another page.' : 'Invoices appear here when memberships are sold or invoices are raised.'} />
          }
          renderItem={({ item }) => (
            <ListRow
              title={item.memberName ?? `Member #${item.memberId}`}
              subtitle={`${item.invoiceNo} · ${fmtDate(item.issuedAt)}${item.balance > 0 && item.status.toLowerCase() !== 'refunded' ? ` · Due ${fmtMoney(item.balance, item.currency)}` : ''}`}
              amount={fmtMoney(item.total, item.currency)}
              pill={<StatusPill label={invoiceLabel(item)} tone={invoiceTone(invoiceLabel(item))} />}
              onPress={() => setOpen(item)}
            />
          )}
          ListFooterComponent={
            (data?.totalPages ?? 0) > 1
              ? <PaginationFooter page={page} totalPages={data!.totalPages} onChange={setPage} />
              : null
          }
        />
      )}
      <InvoiceSheet invoice={open} onClose={() => setOpen(null)} onOpenMember={onOpenMember} />
    </View>
  );
}
