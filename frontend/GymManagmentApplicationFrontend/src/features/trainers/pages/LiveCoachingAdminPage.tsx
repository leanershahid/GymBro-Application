import React from 'react';
import { View, Text, ScrollView, Switch, StatusBar, Platform, ActivityIndicator, Pressable } from 'react-native';
import { T } from '../components/theme';
import BackButton from '../../common/components/BackButton';
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

      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{trainer.displayName}</Text>
        <Text style={{ color: T.textSub, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{subtitle}</Text>
      </View>

      {isPending
        ? <ActivityIndicator size="small" color={T.brand} />
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
    <View style={{ flex: 1, backgroundColor: T.bg, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0 }}>
      <StatusBar barStyle="light-content" backgroundColor={T.bg} />

      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {onBack && <BackButton onPress={onBack} />}
          <View style={{ flex: 1 }}>
            <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 }}>
              Coaching
            </Text>
            <Text style={{ color: T.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }}>Live Coaching</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {isLoading && <ActivityIndicator size="large" color={T.brand} style={{ marginTop: 40 }} />}

        {isError && !isLoading && (
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <Text style={{ color: T.text, fontSize: 15, fontWeight: '700', marginBottom: 12 }}>Failed to load trainers</Text>
            <Pressable onPress={() => refetch()} style={{ backgroundColor: T.brand, borderRadius: 999, paddingHorizontal: 24, paddingVertical: 12 }}>
              <Text style={{ color: T.onBrand, fontSize: 14, fontWeight: '700' }}>Retry</Text>
            </Pressable>
          </View>
        )}

        {!isLoading && !isError && trainers.length === 0 && (
          <EmptyState icon="video" title="No trainers yet" subtitle="Onboard a trainer to enable live coaching." />
        )}

        {!isLoading && !isError && trainers.map((trainer) => (
          <TrainerRow key={trainer.id} trainer={trainer} />
        ))}
      </ScrollView>
    </View>
  );
}
