import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { T, SP } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import EmptyState from '../../common/components/EmptyState';
import Skeleton from '../../common/components/Skeleton';
import SearchBar from '../../common/components/SearchBar';
import SegmentedTabs from '../../common/components/SegmentedTabs';
import StatusPill from '../../common/components/StatusPill';
import { apiErrorText } from '../../../api/apiError';
import { useIncidents } from '../api/facilitiesQueries';
import type { IncidentItem } from '../types/facilities.types';
import { dateTimeLabel } from '../utils/facilitiesFormat';
import { ListRow, SeverityChip } from '../components/FacilitiesUi';

interface Props {
  onBack?: () => void;
  onOpen: (id: number) => void;
  onNew: () => void;
}

type Tab = 'open' | 'closed' | 'all';
const keyOf = (i: IncidentItem) => String(i.id);

const Row = React.memo(function Row({ i, onOpen }: { i: IncidentItem; onOpen: (id: number) => void }) {
  return (
    <ListRow title={`${i.typeLabel} · ${i.location}`} onPress={() => onOpen(i.id)}
      label={`${i.reference}, ${i.typeLabel} at ${i.location}, ${i.severity} severity, ${i.status}`}
      subtitle={[i.reference, dateTimeLabel(i.occurredAt), i.branchName, i.peopleSummary, i.ambulanceCalled ? 'Ambulance called' : null].filter(Boolean).join(' · ')}
      right={<View style={{ gap: 4, alignItems: 'flex-end' }}><SeverityChip severity={i.severity} />
        <StatusPill label={i.status} tone={i.status === 'Open' ? 'warn' : 'neutral'} /></View>} />
  );
});

/** Staff-only incident log (module admin.incidents). Opening any record is audit-logged. */
export default function IncidentsPage({ onBack, onOpen, onNew }: Props) {
  const [tab, setTab] = useState<Tab>('open');
  const [term, setTerm] = useState('');
  const q = useIncidents({ status: tab === 'all' ? undefined : tab, q: term.trim() || undefined });
  const renderItem = useCallback(({ item }: { item: IncidentItem }) => <Row i={item} onOpen={onOpen} />, [onOpen]);

  return (
    <Screen>
      <ScreenHeader eyebrow="Restricted" title="Incident log" onBack={onBack} action={{ label: 'Log', icon: 'plus', onPress: onNew }} />
      <View style={{ paddingHorizontal: SP.xl, gap: SP.md, marginBottom: SP.md }}>
        <SegmentedTabs<Tab> value={tab} onChange={setTab}
          tabs={[{ key: 'open', label: `Open${q.data ? ` (${q.data.openCount})` : ''}` }, { key: 'closed', label: 'Closed' }, { key: 'all', label: 'All' }]} />
        <SearchBar value={term} onChangeText={setTerm} placeholder="Search location, description, people" label="Search incidents" />
        <Text style={{ color: T.textFaint, fontSize: 12 }}>Confidential. Every view and change is recorded.</Text>
      </View>
      {q.isLoading ? (
        <View style={{ paddingHorizontal: SP.xl }} accessibilityLabel="Loading incidents"><Skeleton rows={4} height={72} /></View>
      ) : q.isError ? (
        <EmptyState icon="lock" tone="error" title="Couldn't load incidents" subtitle={apiErrorText(q.error)} action={{ label: 'Try again', onPress: () => q.refetch() }} />
      ) : (
        <FlatList data={q.data?.items ?? []} keyExtractor={keyOf} renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 110, gap: SP.md, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={T.brand} />}
          ListEmptyComponent={<EmptyState icon="clipboard" title={tab === 'open' ? 'No open incidents' : 'No incidents'}
            subtitle="Log injuries, near misses and other incidents here as soon as they happen." action={{ label: 'Log an incident', onPress: onNew }} />} />
      )}
    </Screen>
  );
}
