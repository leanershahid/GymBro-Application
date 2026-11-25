import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, SP } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import PrimaryButton from '../../common/components/PrimaryButton';
import StatusPill from '../../common/components/StatusPill';
import Skeleton from '../../common/components/Skeleton';
import EmptyState from '../../common/components/EmptyState';
import PaginationFooter from '../../common/components/PaginationFooter';
import SearchBar from '../../common/components/SearchBar';
import { useToast } from '../../common/components/Toast';
import { confirm, showAlert } from '../../common/components/dialogs';
import { difficultyTone, goalTone } from '../../common/constants/statusColors';
import { apiErrorText } from '../../../api/apiError';
import { useLayout } from '../../../utils/useLayout';
import { useTrainingPlans, usePlanAnalytics, useCreatePlan, useDeletePlan, useDuplicatePlan } from '../api/trainingQueries';
import type { PlanResponse } from '../api/training.types';
import { PlanDetailsSheet, PlanDetailsValue } from './BuilderSheets';
import { ActionSheet, IconBtn, MenuAction, MetaPill } from './BuilderUi';
import { goalIndex, humanizeEnum, levelIndex } from './builderUtils';

interface Props {
  /** Inside another screen (trainer Program Builder tab): no Screen / header of its own. */
  embedded?: boolean;
  onBack?: () => void;
  onOpenPlan: (planId: number) => void;
  canCreate?: boolean;
  /** Archive (DELETE is admin-only on the API). */
  canDelete?: boolean;
}

const NEW_PLAN: PlanDetailsValue = { name: '', description: '', goal: 'General', difficulty: 'Beginner', weeks: '4', daysPerWeek: '' };

/** Master plans as cards (weeks, days/week, assigned count) with New / Duplicate / Delete. */
export default function PlansList({ embedded, onBack, onOpenPlan, canCreate = true, canDelete = false }: Props) {
  const toast = useToast();
  const { hPad, cols, cardW, cardGap } = useLayout();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [menu, setMenu] = useState<PlanResponse | null>(null);
  const q = useTrainingPlans({ pageNumber: page, pageSize: 20 });
  const create = useCreatePlan();
  const del = useDeletePlan();
  const duplicate = useDuplicatePlan();

  const items = (q.data?.items ?? []).filter(p => p.isTemplate !== false);
  const s = search.trim().toLowerCase();
  const shown = s ? items.filter(p => p.name.toLowerCase().includes(s)) : items;

  const submitNew = async (v: PlanDetailsValue) => {
    try {
      const p = await create.mutateAsync({
        name: v.name.trim(), description: v.description.trim() || null, durationWeeks: Number(v.weeks),
        goal: goalIndex(v.goal), difficulty: levelIndex(v.difficulty), daysPerWeekHint: v.daysPerWeek.trim() ? Number(v.daysPerWeek) : null,
      });
      setCreating(false);
      toast.show({ type: 'success', message: 'Plan created — now fill in its days.' });
      onOpenPlan(p.id);
    } catch (e) { showAlert('Could not create the plan', apiErrorText(e)); }
  };

  const doDuplicate = async (p: PlanResponse) => {
    try {
      const b = await duplicate.mutateAsync({ planId: p.id });
      toast.show({ type: 'success', message: `"${b.name}" created.` });
    } catch (e) { showAlert('Could not duplicate', apiErrorText(e)); }
  };

  const doDelete = async (p: PlanResponse) => {
    if (!(await confirm({ title: `Delete "${p.name}"?`, message: 'The plan is archived. Members keep their own copies.', confirmLabel: 'Delete', destructive: true }))) return;
    try {
      await del.mutateAsync(p.id);
      toast.show({ type: 'success', message: 'Plan deleted.' });
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      showAlert(status === 409 ? 'This plan is in use' : 'Could not delete', apiErrorText(e));
    }
  };

  const actions: MenuAction[] = menu ? [
    { icon: 'calendar', label: 'Open builder', onPress: () => onOpenPlan(menu.id) },
    ...(canCreate ? [{ icon: 'copy' as const, label: 'Duplicate', onPress: () => doDuplicate(menu) }] : []),
    ...(canDelete ? [{ icon: 'trash-2' as const, label: 'Delete', danger: true, onPress: () => doDelete(menu) }] : []),
  ] : [];

  const body = (
    <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: embedded ? 20 : hPad, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', gap: SP.sm, alignItems: 'center', marginBottom: SP.lg }}>
        {canCreate && <PrimaryButton label="New plan" icon="plus" onPress={() => setCreating(true)} style={{ alignSelf: 'flex-start' }} />}
        {items.length > 5 && <View style={{ flex: 1 }}><SearchBar value={search} onChangeText={setSearch} placeholder="Search plans…" label="Search plans" /></View>}
      </View>

      {q.isLoading && <Skeleton rows={3} height={110} />}
      {q.isError && <EmptyState icon="wifi-off" tone="error" title="Couldn't load plans" subtitle={apiErrorText(q.error)} action={{ label: 'Retry', onPress: () => q.refetch() }} />}
      {!q.isLoading && !q.isError && shown.length === 0 && (
        <EmptyState icon="calendar" title={s ? 'No matching plans' : 'No plans yet'} subtitle={s ? undefined : 'Create a plan, then set exercises on each day of the week.'} />
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: cardGap }}>
        {!q.isLoading && !q.isError && shown.map(p => (
          <View key={p.id} style={{ width: embedded || cols === 1 ? '100%' : cardW }}>
            <PlanCard plan={p} onOpen={() => onOpenPlan(p.id)} onMore={() => setMenu(p)} />
          </View>
        ))}
      </View>
      {!q.isLoading && !q.isError && <PaginationFooter page={page} totalPages={q.data?.totalPages ?? 1} onChange={setPage} />}
    </ScrollView>
  );

  const sheets = (
    <>
      <ActionSheet visible={menu !== null} title={menu?.name ?? ''} actions={actions} onClose={() => setMenu(null)} />
      <PlanDetailsSheet visible={creating} title="New plan" initial={NEW_PLAN} showWeeks saving={create.isPending} submitLabel="Create"
        onClose={() => setCreating(false)} onSubmit={submitNew} />
    </>
  );

  if (embedded) return <View style={{ flex: 1 }}>{body}{sheets}</View>;
  return (
    <Screen>
      <ScreenHeader eyebrow="Training" title="Plans" onBack={onBack} />
      {body}
      {sheets}
    </Screen>
  );
}

const PlanCard = React.memo(function PlanCard({ plan, onOpen, onMore }: { plan: PlanResponse; onOpen: () => void; onMore: () => void }) {
  const analytics = usePlanAnalytics(plan.id);
  const assigned = analytics.data?.totalAssigned;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.bgInput, borderRadius: R.lg, marginBottom: 10, borderWidth: 1, borderColor: T.bgInputActive }}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${plan.name}, ${plan.durationWeeks} weeks${assigned != null ? `, ${assigned} assigned` : ''}`}
        accessibilityHint="Opens the plan builder"
        style={({ pressed }) => ({ flex: 1, padding: 14, borderRadius: R.lg, opacity: pressed ? 0.75 : 1 })}
      >
        <Text numberOfLines={2} style={{ color: T.text, fontSize: 15, fontWeight: '700', marginBottom: 8 }}>{plan.name}</Text>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <MetaPill icon="calendar" label={`${plan.durationWeeks} wk${plan.durationWeeks === 1 ? '' : 's'}`} />
          {!!plan.daysPerWeekHint && <MetaPill icon="repeat" label={`${plan.daysPerWeekHint} days/wk`} />}
          <MetaPill icon="users" label={assigned == null ? '…' : `${assigned} assigned`} />
          {!!plan.goal && <StatusPill label={humanizeEnum(plan.goal)} tone={goalTone(plan.goal)} />}
          {!!plan.difficulty && <StatusPill label={plan.difficulty} tone={difficultyTone(plan.difficulty)} />}
        </View>
      </Pressable>
      <View style={{ paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <IconBtn icon="more-horizontal" label={`Actions for ${plan.name}`} onPress={onMore} size={36} />
        <Feather name="chevron-right" size={16} color={T.textFaint} />
      </View>
    </View>
  );
});
