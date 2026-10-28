import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { T } from '../../../theme';
import { useMyPlans, useHealthToday } from '../api/memberAppQueries';
import MetricBar from '../components/MetricBar';
import EmptyState from '../../dashboard/components/EmptyState';
import Screen from '../../common/components/Screen';
import Skeleton from '../../common/components/Skeleton';

interface Props { userId: number; }

export default function ProgressScreen({ userId }: Props) {
  const { data: health } = useHealthToday(userId);
  const { data: planPage, isLoading: plansLoading, isError: plansError, refetch: refetchPlans } = useMyPlans(1);
  const plans = planPage?.items ?? [];

  return (
    <Screen>

      <View className="px-5 pt-5 pb-3">
        <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 }}>Today</Text>
        <Text style={{ color: T.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>Progress</Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        <View style={{ backgroundColor: T.bgInput, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: T.line, marginBottom: 24 }}>
          <MetricBar
            label="Training minutes today"
            current={health?.rings.train.current ?? null}
            goal={health?.rings.train.goal ?? null}
            unit="min"
            color={T.brand}
          />
          <MetricBar
            label="Current streak"
            current={health ? health.streakDays : null}
            goal={null}
            unit="days"
            color={T.brandGold}
          />
        </View>

        <Text style={{ color: T.text, fontSize: 16, fontWeight: '700', marginBottom: 14 }}>My plans</Text>
        {plansLoading ? (
          <Skeleton rows={2} height={70} borderRadius={18} gap={12} />
        ) : plansError ? (
          <EmptyState icon="wifi-off" tone="error" title="Couldn't load plans" action={{ label: 'Retry', onPress: () => refetchPlans() }} />
        ) : plans.length === 0 ? (
          <EmptyState icon="book-open" title="No plans assigned yet" subtitle="Your trainer will assign a plan to help you reach your goals." />
        ) : (
          plans.map(plan => (
            <View key={plan.id} style={{ backgroundColor: T.bgInput, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: T.line, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{plan.name}</Text>
                <Text style={{ color: T.textSub, fontSize: 12, marginTop: 3 }}>{[`${plan.durationWeeks} weeks`, plan.goal].filter(Boolean).join(' · ')}</Text>
              </View>
              <View style={{
                borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
                backgroundColor: plan.isActive ? T.brandDim : T.line,
                borderWidth: 1, borderColor: plan.isActive ? T.brandBorder : T.line,
              }}>
                <Text style={{ color: plan.isActive ? T.brand : T.textSub, fontSize: 11, fontWeight: '700' }}>
                  {plan.isActive ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
