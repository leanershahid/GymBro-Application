import React from 'react';
import { View, Text, ScrollView, StatusBar, Platform, ActivityIndicator, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, Shadow } from '../../trainers/components/theme';
import BackButton from '../../common/components/BackButton';
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
    <View style={{
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
          <Text style={{ color: T.textSub, fontSize: 11, marginTop: 3 }}>{fmtSteps(client.steps)}</Text>
        </View>
        <View style={{ alignItems: 'center', minWidth: 42 }}>
          <Feather name="moon" size={13} color={T.textFaint} />
          <Text style={{ color: T.textSub, fontSize: 11, marginTop: 3 }}>{fmtSleep(client.sleepHours)}</Text>
        </View>
        <View style={{ alignItems: 'center', minWidth: 42 }}>
          <Feather name="heart" size={13} color={T.textFaint} />
          <Text style={{ color: T.textSub, fontSize: 11, marginTop: 3 }}>{fmtRecovery(client.recoveryScore)}</Text>
        </View>
      </View>
    </View>
  );
}

export default function StatsAdminPage({ onBack }: Props) {
  const { data, isLoading, isError, refetch } = useHealthAdminOverview();

  const clients = data?.clients ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0 }}>
      <StatusBar barStyle="light-content" backgroundColor={T.bg} />

      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {onBack && <BackButton onPress={onBack} />}
          <View style={{ flex: 1 }}>
            <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 }}>
              Health
            </Text>
            <Text style={{ color: T.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }}>Stats Overview</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {isLoading && <ActivityIndicator size="large" color={T.brand} style={{ marginTop: 40 }} />}

        {isError && !isLoading && (
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <Text style={{ color: T.text, fontSize: 15, fontWeight: '700', marginBottom: 12 }}>Failed to load stats</Text>
            <Pressable onPress={() => refetch()} style={{ backgroundColor: T.brand, borderRadius: 999, paddingHorizontal: 24, paddingVertical: 12 }}>
              <Text style={{ color: T.onBrand, fontSize: 14, fontWeight: '700' }}>Retry</Text>
            </Pressable>
          </View>
        )}

        {!isLoading && !isError && data && (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
              <StatTile icon="users" label="Clients tracked today" value={String(data.clientsTrackedToday)} />
              <StatTile icon="heart" label="Avg recovery" value={fmtRecovery(data.avgRecoveryScore)} />
              <StatTile icon="moon" label="Avg sleep" value={fmtSleep(data.avgSleepHours)} />
              <StatTile icon="activity" label="Avg steps" value={fmtSteps(data.avgSteps)} />
            </View>

            <Text style={{ color: T.text, fontSize: 15, fontWeight: '800', marginBottom: 12 }}>Client roster</Text>

            {clients.length === 0 ? (
              <EmptyState icon="activity" title="No health check-ins logged today" />
            ) : (
              clients.map((c) => <ClientRow key={c.userId} client={c} />)
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
