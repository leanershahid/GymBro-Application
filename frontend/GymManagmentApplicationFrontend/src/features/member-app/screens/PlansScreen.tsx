import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useMyPlans } from '../api/memberAppQueries';
import { T, R, withAlpha } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import Skeleton from '../../common/components/Skeleton';
import StatusPill from '../../common/components/StatusPill';
import PaginationFooter from '../../common/components/PaginationFooter';
import EmptyState from '../../dashboard/components/EmptyState';
import { difficultyTone, goalTone } from '../components/pillTones';

const GOAL_COLOR: Record<string, string> = {
  general: T.textSub, weightloss: T.sky, musclegain: T.brand, endurance: T.brandGold,
};

interface Props { onBack?: () => void; }

export default function PlansScreen({ onBack }: Props) {
  const [page, setPage] = useState(1);
  const { data: paged, isLoading, isError, refetch } = useMyPlans(page);
  const items      = paged?.items ?? [];
  const totalPages = paged?.totalPages ?? 1;

  return (
    <Screen>
      <ScreenHeader eyebrow="My Programs" title="Training Plans" onBack={onBack} />

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        {isLoading && <Skeleton rows={3} height={110} borderRadius={R.xl} gap={12} />}

        {isError && (
          <EmptyState icon="wifi-off" tone="error" title="Failed to load plans" action={{ label: 'Retry', onPress: () => refetch() }} />
        )}

        {!isLoading && !isError && items.length === 0 && (
          <EmptyState icon="book-open" title="No plans assigned yet" subtitle="Your trainer will assign a plan to help you reach your goals." />
        )}

        {!isLoading && !isError && items.map(plan => {
          const goal = plan.goal?.toLowerCase() ?? 'general';
          const gc   = GOAL_COLOR[goal] ?? T.textSub;

          return (
            // Informational card (no action) — read as one element by screen readers.
            <View
              key={plan.id}
              accessible
              accessibilityLabel={`${plan.name}, ${plan.durationWeeks} weeks${plan.goal ? `, ${plan.goal}` : ''}${plan.difficulty ? `, ${plan.difficulty}` : ''}, ${plan.isActive ? 'Active' : 'Inactive'}`}
              style={{
                backgroundColor: T.bgInput,
                borderRadius: R.xl, padding: 16, marginBottom: 12,
                borderWidth: 1, borderColor: T.bgInputActive,
              }}>
              {/* Accent bar */}
              <View style={{ height: 3, backgroundColor: gc, borderRadius: 2, marginBottom: 14, width: 40 }} />

              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={{ color: T.text, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>{plan.name}</Text>
                </View>
                {/* Week badge */}
                <View style={{ backgroundColor: withAlpha(T.brand, 0.10), borderWidth: 1, borderColor: withAlpha(T.brand, 0.25), borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' }}>
                  <Text style={{ color: T.brand, fontSize: 18, fontWeight: '800' }}>{plan.durationWeeks}</Text>
                  <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600' }}>WKS</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {plan.goal && <StatusPill label={plan.goal} tone={goalTone(plan.goal)} />}
                {plan.difficulty && <StatusPill label={plan.difficulty} tone={difficultyTone(plan.difficulty)} />}
                <StatusPill label={plan.isActive ? 'Active' : 'Inactive'} tone={plan.isActive ? 'brand' : 'neutral'} />
              </View>
            </View>
          );
        })}

        {!isLoading && !isError && <PaginationFooter page={page} totalPages={totalPages} onChange={setPage} />}
      </ScrollView>
    </Screen>
  );
}
