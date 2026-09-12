import React from 'react';
import { View, Text, ScrollView, StatusBar, Platform } from 'react-native';
import { T } from '../../trainers/components/theme';
import { useMyPlans, useHealthToday } from '../api/memberAppQueries';
import MetricBar from '../components/MetricBar';
import EmptyState from '../../dashboard/components/EmptyState';

interface Props { userId: number; }

export default function ProgressScreen({ userId }: Props) {
  const { data: health } = useHealthToday(userId);
  const { data: planPage } = useMyPlans(1);
  const plans = planPage?.items ?? [];

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0 }}>
      <StatusBar barStyle="light-content" backgroundColor={T.bg} />

      <View className="px-5 pt-5 pb-3">
        <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 }}>This week</Text>
        <Text style={{ color: T.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>Progress</Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        <View style={{ backgroundColor: T.bgInput, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: T.line, marginBottom: 24 }}>
          <MetricBar
            label="Training minutes today"
            current={health?.rings.train.current ?? 0}
            goal={health?.rings.train.goal ?? 60}
            unit="min"
            color={T.brand}
          />
          <MetricBar
            label="Current streak"
            current={health?.streakDays ?? 0}
            goal={Math.max(7, health?.streakDays ?? 0)}
            unit="days"
            color={T.brandGold}
          />
        </View>

        <Text style={{ color: T.text, fontSize: 16, fontWeight: '700', marginBottom: 14 }}>My plans</Text>
        {plans.length === 0 ? (
          <EmptyState icon="book-open" title="No plans assigned yet" subtitle="Your trainer will assign a plan to help you reach your goals." />
        ) : (
          plans.map(plan => (
            <View key={plan.id} style={{ backgroundColor: T.bgInput, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: T.line, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{plan.name}</Text>
                <Text style={{ color: T.textSub, fontSize: 12, marginTop: 3 }}>{plan.durationWeeks} weeks · {plan.goal ?? 'General'}</Text>
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
    </View>
  );
}
