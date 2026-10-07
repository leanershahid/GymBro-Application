import React from 'react';
import { View, Text, FlatList, Switch, ActivityIndicator } from 'react-native';
import { T, SP } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../dashboard/components/EmptyState';
import { useTrainers, useUpdateTrainerAvailability } from '../api/trainerQueries';
import { TrainerSummary } from '../types/trainer.types';

interface Props { onBack?: () => void; }

function TrainerRow({ trainer }: { trainer: TrainerSummary }) {
  const { mutate: setAvailability, isPending } = useUpdateTrainerAvailability();
  const initials = trainer.displayName.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
  const subtitle = trainer.employment?.designation || 'Trainer';

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', backgroundColor: T.bgInput, borderRadius: 16,
      padding: 14, marginBottom: 10, borderWidth: 1, borderColor: T.line,
    }}>
      <View style={{
        width: 44, height: 44, borderRadius: 22, backgroundColor: T.brandDim,
        borderWidth: 1, borderColor: T.brandBorder, alignItems: 'center', justifyContent: 'center', marginRight: 14,
      }}>
        <Text style={{ color: T.brand, fontSize: 15, fontWeight: '800' }}>{initials}</Text>
      </View>

      <View style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
        <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{trainer.displayName}</Text>
        <Text style={{ color: T.textSub, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{subtitle}</Text>
      </View>

      {isPending
        ? <ActivityIndicator size="small" color={T.brand} accessibilityLabel={`Updating ${trainer.displayName}`} />
        : (
          <Switch
            value={trainer.isAvailable}
            onValueChange={(val) => setAvailability({ id: trainer.id, isAvailable: val })}
            trackColor={{ false: T.line, true: T.brandDim }}
            thumbColor={trainer.isAvailable ? T.brand : T.textFaint}
            accessibilityLabel={`Toggle live coaching availability for ${trainer.displayName}`}
          />
        )}
    </View>
  );
}

export default function LiveCoachingAdminPage({ onBack }: Props) {
  const { data: paged, isLoading, isError, refetch } = useTrainers(1, 100);
  const trainers = paged?.items ?? [];

  return (
    <Screen>
      <ScreenHeader eyebrow="Coaching" title="Live Coaching" onBack={onBack} />

      <FlatList
        data={isLoading || isError ? [] : trainers}
        keyExtractor={(t) => String(t.id)}
        renderItem={({ item }) => <TrainerRow trainer={item} />}
        ListHeaderComponent={
          isLoading ? <LoadingState label="Loading trainers" /> :
          isError ? (
            <EmptyState
              icon="wifi-off"
              tone="error"
              title="Failed to load trainers"
              subtitle="Check your connection and try again."
              action={{ label: 'Retry', onPress: () => refetch() }}
            />
          ) : null
        }
        ListEmptyComponent={
          !isLoading && !isError
            ? <EmptyState icon="video" title="No trainers yet" subtitle="Onboard a trainer to enable live coaching." />
            : null
        }
        contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}
