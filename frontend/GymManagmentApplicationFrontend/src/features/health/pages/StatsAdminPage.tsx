import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../dashboard/components/EmptyState';
import StatTile from '../../dashboard/components/Stattile';
import { useHealthAdminOverview } from '../api/healthAdminQueries';
import { ClientHealthRow } from '../types/health.types';

interface Props { onBack?: () => void; }

const fmtRecovery = (v: number | null) => (v === null || v === undefined ? '—' : `${Math.round(v)}%`);
const fmtSleep = (v: number | null) => (v === null || v === undefined ? '—' : `${v.toFixed(1)}h`);
const fmtSteps = (v: number | null) => (v === null || v === undefined ? '—' : Math.round(v).toLocaleString());

function ClientRow({ client }: { client: ClientHealthRow }) {
  const initials = client.name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
  return (
    <View
      accessible
      accessibilityLabel={`${client.name}: steps ${fmtSteps(client.steps)}, sleep ${fmtSleep(client.sleepHours)}, recovery ${fmtRecovery(client.recoveryScore)}`}
      style={{
      flexDirection: 'row', alignItems: 'center', backgroundColor: T.bgInput, borderRadius: 16,
      padding: 14, marginBottom: 10, borderWidth: 1, borderColor: T.line,
    }}>
      <View style={{
        width: 40, height: 40, borderRadius: 20, backgroundColor: T.brandDim,
        borderWidth: 1, borderColor: T.brandBorder, alignItems: 'center', justifyContent: 'center', marginRight: 12,
      }}>
        <Text style={{ color: T.brand, fontSize: 14, fontWeight: '800' }}>{initials}</Text>
      </View>

      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>{client.name}</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 16 }}>
        <View style={{ alignItems: 'center', minWidth: 42 }}>
          <Feather name="activity" size={13} color={T.textFaint} />
          <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 11, marginTop: 3 }}>{fmtSteps(client.steps)}</Text>
        </View>
        <View style={{ alignItems: 'center', minWidth: 42 }}>
          <Feather name="moon" size={13} color={T.textFaint} />
          <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 11, marginTop: 3 }}>{fmtSleep(client.sleepHours)}</Text>
        </View>
        <View style={{ alignItems: 'center', minWidth: 42 }}>
          <Feather name="heart" size={13} color={T.textFaint} />
          <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 11, marginTop: 3 }}>{fmtRecovery(client.recoveryScore)}</Text>
        </View>
      </View>
    </View>
  );
}

export default function StatsAdminPage({ onBack }: Props) {
  const { data, isLoading, isError, refetch } = useHealthAdminOverview();

  const clients = data?.clients ?? [];

  return (
    <Screen>
      <ScreenHeader eyebrow="Health" title="Stats Overview" onBack={onBack} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {isLoading && <LoadingState label="Loading stats" />}

        {isError && !isLoading && (
          <EmptyState icon="alert-triangle" tone="error" title="Failed to load stats" action={{ label: 'Retry', onPress: () => refetch() }} />
        )}

        {!isLoading && !isError && data && (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
              <StatTile icon="users" label="Clients tracked today" value={String(data.clientsTrackedToday)} />
              <StatTile icon="heart" label="Avg recovery" value={fmtRecovery(data.avgRecoveryScore)} />
              <StatTile icon="moon" label="Avg sleep" value={fmtSleep(data.avgSleepHours)} />
              <StatTile icon="activity" label="Avg steps" value={fmtSteps(data.avgSteps)} />
            </View>

            <Text accessibilityRole="header" style={{ color: T.text, fontSize: 15, fontWeight: '800', marginBottom: 12 }}>Client roster</Text>

            {clients.length === 0 ? (
              <EmptyState icon="activity" title="No health check-ins logged today" />
            ) : (
              clients.map((c) => <ClientRow key={c.userId} client={c} />)
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
