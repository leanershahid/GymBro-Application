import React, { useState } from 'react';
import { View, Text, FlatList, Pressable, Alert } from 'react-native';
import { usePlans, usePlan, useDeletePlan } from '../api/workoutQueries';
import { WorkoutPlan } from '../types/workout.types';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import StatusPill from '../../common/components/StatusPill';
import { difficultyTone, goalTone } from '../../common/constants/statusColors';
import PaginationFooter from '../../common/components/PaginationFooter';
import Skeleton from '../../common/components/Skeleton';
import EmptyState from '../../dashboard/components/EmptyState';
import StatsStrip from '../../common/StatsStrip';
import DetailSheet, { fmtDate } from '../../exercises/components/DetailSheet';
import { humanize } from '../../exercises/components/ChipSelect';
import PrimaryButton from '../../common/components/PrimaryButton';
import { useToast } from '../../common/components/Toast';
import { apiErrorText } from '../../../api/apiError';
import { getSession, isAdminRole } from '../../../api/session';
import { T, withAlpha, R, SP } from '../../../theme';

const GOAL_COLOR: Record<string, string> = {
  general: T.textSub, weightloss: T.sky, musclegain: T.brand, endurance: T.brandGold,
};
function PlanCard({ plan, onOpen }: { plan: WorkoutPlan; onOpen: (id: number) => void }) {
  const goal  = plan.goal?.toLowerCase() ?? 'general';
  const gc    = GOAL_COLOR[goal] ?? T.textSub;

  return (
    <Pressable
      onPress={() => onOpen(plan.id)}
      accessibilityRole="button"
      accessibilityHint="Opens plan details"
      accessibilityLabel={`${plan.name}, ${plan.durationWeeks} weeks${plan.goal ? `, ${plan.goal}` : ''}${plan.difficulty ? `, ${plan.difficulty}` : ''}, ${plan.isActive ? 'active' : 'inactive'}`}
      style={({ pressed }) => ({
        backgroundColor: pressed ? T.bgInputActive : T.bgInput,
        borderRadius: R.xl, padding: 16, marginBottom: 12,
        borderWidth: 1, borderColor: T.bgInputActive,
      })}>
      {/* Accent bar */}
      <View style={{ height: 3, backgroundColor: gc, borderRadius: 2, marginBottom: 14, width: 40 }} />

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <View style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
          <Text className="text-white text-[16px] font-bold" numberOfLines={1}>{plan.name}</Text>
          {!!plan.description && <Text className="text-sub text-[12px] mt-1" numberOfLines={2}>{plan.description}</Text>}
        </View>
        {/* Duration badge */}
        <View style={{ backgroundColor: withAlpha(T.brand, 0.10), borderWidth: 1, borderColor: withAlpha(T.brand, 0.25), borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' }}>
          <Text style={{ color: T.brand, fontSize: 18, fontWeight: '900' }}>{plan.durationWeeks}</Text>
          <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600' }}>WKS</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {!!plan.goal && <StatusPill label={humanize(plan.goal)} tone={goalTone(goal)} />}
        {!!plan.difficulty && <StatusPill label={plan.difficulty} tone={difficultyTone(plan.difficulty)} />}
        <StatusPill label={plan.isActive ? 'Active' : 'Inactive'} tone={plan.isActive ? 'brand' : 'neutral'} />
      </View>
    </Pressable>
  );
}

interface Props {
  onBack?: () => void;
  onAddPlan?: () => void;
  /** Override the built-in read-only detail sheet. */
  onOpenPlan?: (id: number) => void;
}

export default function ViewPlansPage({ onBack, onAddPlan, onOpenPlan }: Props) {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);
  const { data: paged, isLoading, isError, refetch } = usePlans(page, 20);
  const detail = usePlan(openId);
  const { mutate: del, isPending: deleting } = useDeletePlan();
  const p = detail.data;
  // DELETE /plans/{id} is admin-only on the API.
  const canDelete = isAdminRole(getSession()?.role);

  const handleOpen = (id: number) => (onOpenPlan ? onOpenPlan(id) : setOpenId(id));

  const handleDelete = (id: number, name: string) => {
    Alert.alert('Delete Plan', `Delete "${name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () =>
        del(id, {
          onSuccess: () => { setOpenId(null); toast.show({ type: 'success', message: 'Plan deleted.' }); },
          onError: (e) => Alert.alert('Delete failed', apiErrorText(e)),
        })
      },
    ]);
  };
  const items      = paged?.items ?? [];
  const totalPages = paged?.totalPages ?? 1;
  const totalRecs  = paged?.totalRecords;

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Programs"
        title="Workout Plans"
        onBack={onBack}
        action={onAddPlan ? { label: 'Add', icon: 'plus', onPress: onAddPlan } : undefined}
      />

      {!isLoading && !isError && (
        <View style={{ paddingHorizontal: SP.xl, paddingBottom: SP.lg }}>
          <StatsStrip items={[
            { icon: 'book-open', label: 'Total', value: totalRecs == null ? '—' : totalRecs.toLocaleString('en-IN'), accent: T.brand },
            { icon: 'layers',    label: 'Page',  value: `${page}/${totalPages}`,                                       accent: T.violet },
          ]} />
        </View>
      )}

      <FlatList
        data={isLoading || isError ? [] : items}
        keyExtractor={(p) => String(p.id)}
        renderItem={({ item }) => <PlanCard plan={item} onOpen={handleOpen} />}
        ListHeaderComponent={
          isLoading ? <Skeleton rows={4} height={110} borderRadius={R.xl} gap={12} /> :
          isError ? (
            <EmptyState
              icon="wifi-off"
              tone="error"
              title="Failed to load"
              subtitle="Check your connection and try again."
              action={{ label: 'Retry', onPress: () => refetch() }}
            />
          ) : null
        }
        ListEmptyComponent={
          !isLoading && !isError ? <EmptyState icon="book-open" title="No plans yet" /> : null
        }
        ListFooterComponent={
          !isLoading && !isError
            ? <PaginationFooter page={page} totalPages={totalPages} onChange={setPage} />
            : null
        }
        contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      />

      <DetailSheet
        visible={openId !== null}
        onClose={() => setOpenId(null)}
        title={p?.name ?? 'Plan'}
        loading={detail.isLoading}
        error={detail.isError ? apiErrorText(detail.error) : null}
        rows={p ? [
          { label: 'Description', value: p.description },
          { label: 'Duration',    value: `${p.durationWeeks} week${p.durationWeeks === 1 ? '' : 's'}` },
          { label: 'Goal',        value: p.goal ? humanize(p.goal) : null },
          { label: 'Difficulty',  value: p.difficulty },
          { label: 'Status',      value: p.isActive ? 'Active' : 'Inactive' },
          { label: 'Created',     value: fmtDate(p.createdAt) },
        ] : []}
        footer={p && canDelete ? (
          <PrimaryButton label="Delete plan" icon="trash-2" variant="danger" loading={deleting} onPress={() => handleDelete(p.id, p.name)} />
        ) : null}
      />
    </Screen>
  );
}
