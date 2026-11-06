import React, { useCallback } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { T, SP } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import EmptyState from '../../common/components/EmptyState';
import Skeleton from '../../common/components/Skeleton';
import { apiErrorText } from '../../../api/apiError';
import { useMyReports } from '../api/facilitiesQueries';
import type { MyReport } from '../types/facilities.types';
import { REPORT_STATUS_LABEL, ago } from '../utils/facilitiesFormat';
import { ListRow, ReportStatusChip } from '../components/FacilitiesUi';

interface Props {
  onBack?: () => void;
  onOpen: (id: number) => void;
  onNew: () => void;
}

const keyOf = (r: MyReport) => String(r.id);

const Row = React.memo(function Row({ r, onOpen }: { r: MyReport; onOpen: (id: number) => void }) {
  const sub = `${r.problemLabel} · ${r.isMine ? 'Reported' : '+1'} ${ago(r.createdAt)}${r.branchName ? ` · ${r.branchName}` : ''}`;
  return (
    <ListRow title={r.subject} subtitle={sub} onPress={() => onOpen(r.id)}
      label={`${r.subject}, ${r.problemLabel}, ${REPORT_STATUS_LABEL[r.status]}`} right={<ReportStatusChip status={r.status} />} />
  );
});

/** The member's problem reports (and ones they +1'd), with their status. */
export default function MyReportsScreen({ onBack, onOpen, onNew }: Props) {
  const q = useMyReports();
  const renderItem = useCallback(({ item }: { item: MyReport }) => <Row r={item} onOpen={onOpen} />, [onOpen]);
  return (
    <Screen>
      <ScreenHeader eyebrow="Equipment" title="My reports" onBack={onBack} action={{ label: 'Report', icon: 'plus', onPress: onNew }} />
      {q.isLoading ? (
        <View style={{ paddingHorizontal: SP.xl }} accessibilityLabel="Loading your reports"><Skeleton rows={4} height={72} /></View>
      ) : q.isError ? (
        <EmptyState icon="alert-triangle" tone="error" title="Couldn't load your reports" subtitle={apiErrorText(q.error)}
          action={{ label: 'Try again', onPress: () => q.refetch() }} />
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={keyOf}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 110, gap: SP.md, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={T.brand} />}
          ListEmptyComponent={
            <EmptyState icon="check-circle" title="No reports yet" subtitle="See something broken, dirty or unsafe? Tell us in a few taps."
              action={{ label: 'Report a problem', onPress: onNew }} />
          }
        />
      )}
    </Screen>
  );
}
