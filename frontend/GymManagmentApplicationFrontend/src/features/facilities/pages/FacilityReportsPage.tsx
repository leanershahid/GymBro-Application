import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { T, SP } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import EmptyState from '../../common/components/EmptyState';
import Skeleton from '../../common/components/Skeleton';
import SegmentedTabs from '../../common/components/SegmentedTabs';
import { apiErrorText } from '../../../api/apiError';
import { useFacilityReportCounts, useStaffReports } from '../api/facilitiesQueries';
import type { StaffReportItem } from '../types/facilities.types';
import { REPORT_STATUS_LABEL, ago } from '../utils/facilitiesFormat';
import { ListRow, ReportStatusChip, UrgentChip } from '../components/FacilitiesUi';

interface Props {
  onBack?: () => void;
  onOpen: (id: number) => void;
}

type Tab = 'open' | 'urgent' | 'mine' | 'closed';
const keyOf = (r: StaffReportItem) => String(r.id);

const Row = React.memo(function Row({ r, onOpen }: { r: StaffReportItem; onOpen: (id: number) => void }) {
  const sub = [
    r.problemLabel, r.branchName, `${r.reporterName} · ${ago(r.createdAt)}`,
    r.plusOneCount ? `+${r.plusOneCount}` : null, r.assigneeName ? `→ ${r.assigneeName}` : 'Unassigned',
  ].filter(Boolean).join(' · ');
  return (
    <ListRow title={r.subject} subtitle={sub} onPress={() => onOpen(r.id)} tint={r.isUrgent && r.status !== 'Fixed' ? T.err : undefined}
      label={`${r.isUrgent ? 'Urgent. ' : ''}${r.subject}, ${r.problemLabel}, ${REPORT_STATUS_LABEL[r.status]}`}
      right={<View style={{ gap: 4, alignItems: 'flex-end' }}>{r.isUrgent && <UrgentChip />}<ReportStatusChip status={r.status} /></View>} />
  );
});

/** Admin: the problem-report triage queue (urgent first). */
export default function FacilityReportsPage({ onBack, onOpen }: Props) {
  const [tab, setTab] = useState<Tab>('open');
  const counts = useFacilityReportCounts();
  const q = useStaffReports(
    tab === 'closed' ? { status: 'closed' } : tab === 'urgent' ? { status: 'open', urgent: true } : tab === 'mine' ? { status: 'open', mine: true } : { status: 'open' },
  );
  const renderItem = useCallback(({ item }: { item: StaffReportItem }) => <Row r={item} onOpen={onOpen} />, [onOpen]);
  const c = counts.data;

  return (
    <Screen>
      <ScreenHeader eyebrow="Facilities" title="Problem reports" onBack={onBack} />
      <SegmentedTabs<Tab> style={{ marginHorizontal: SP.xl, marginBottom: SP.md }} value={tab} onChange={setTab}
        tabs={[
          { key: 'open', label: `Open${c ? ` (${c.open})` : ''}` }, { key: 'urgent', label: `Urgent${c?.urgent ? ` (${c.urgent})` : ''}` },
          { key: 'mine', label: 'Mine' }, { key: 'closed', label: 'Closed' },
        ]} />
      {q.isLoading ? (
        <View style={{ paddingHorizontal: SP.xl }} accessibilityLabel="Loading reports"><Skeleton rows={5} height={72} /></View>
      ) : q.isError ? (
        <EmptyState icon="alert-triangle" tone="error" title="Couldn't load reports" subtitle={apiErrorText(q.error)}
          action={{ label: 'Try again', onPress: () => q.refetch() }} />
      ) : (
        <FlatList data={q.data?.items ?? []} keyExtractor={keyOf} renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 110, gap: SP.md, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); counts.refetch(); }} tintColor={T.brand} />}
          ListEmptyComponent={<EmptyState icon="check-circle" title={tab === 'closed' ? 'Nothing closed yet' : 'All clear'}
            subtitle={tab === 'closed' ? undefined : 'No open problem reports. Nice.'} />} />
      )}
    </Screen>
  );
}
