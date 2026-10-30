import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, SP, withAlpha } from '../../../theme';
import FormPage from '../../exercises/components/FormPage';
import BottomSheet from '../../common/components/BottomSheet';
import SearchBar from '../../common/components/SearchBar';
import Skeleton from '../../common/components/Skeleton';
import { useToast } from '../../common/components/Toast';
import EmptyState from '../../dashboard/components/EmptyState';
import { apiErrorText } from '../../../api/apiError';
import { usePlanSchedule, useSavePlanSchedule, useWorkoutOptions } from '../api/programQueries';
import { PlanSchedule } from '../types/program.types';

interface Slot { workoutId: number | null; workoutName: string | null }
interface DraftWeek { weekNumber: number; notes: string | null; days: Slot[] }   // days[0] = day 1

const REST: Slot = { workoutId: null, workoutName: null };
const DAYS = [1, 2, 3, 4, 5, 6, 7];

function toDraft(s: PlanSchedule, weeks: number): DraftWeek[] {
  return Array.from({ length: weeks }, (_, i) => {
    const wk = s.weeks.find(w => w.weekNumber === i + 1);
    return {
      weekNumber: i + 1,
      notes: wk?.notes ?? null,
      days: DAYS.map(d => {
        const day = wk?.days.find(x => x.dayNumber === d);
        return day && !day.isRestDay && day.workoutId
          ? { workoutId: day.workoutId, workoutName: day.workoutName ?? `Workout #${day.workoutId}` }
          : REST;
      }),
    };
  });
}

interface Props {
  planId: number;
  planName: string;
  durationWeeks: number;
  onBack: () => void;
}

/** Weeks × 7 days grid; each day is one workout or a rest day. Save replaces the schedule (PUT). */
export default function PlanScheduleEditor({ planId, planName, durationWeeks, onBack }: Props) {
  const toast = useToast();
  const { height } = useWindowDimensions();
  const { data, isLoading, isError, error, refetch } = usePlanSchedule(planId);
  const { mutate: save, isPending: saving } = useSavePlanSchedule(planId);
  const { data: workouts = [], isLoading: wLoading, isError: wError, refetch: wRefetch } = useWorkoutOptions();

  const weeksCount = Math.max(1, data?.durationWeeks || durationWeeks || 1);
  const [weeks, setWeeks] = useState<DraftWeek[]>([]);
  const [dirty, setDirty] = useState(false);
  const [picking, setPicking] = useState<{ week: number; day: number } | null>(null);
  const [search, setSearch] = useState('');
  const loaded = useRef(false);

  useEffect(() => {
    if (data && !loaded.current) {
      loaded.current = true;
      setWeeks(toDraft(data, weeksCount));
    }
  }, [data, weeksCount]);

  const filteredWorkouts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? workouts.filter(w => w.name.toLowerCase().includes(q)) : workouts;
  }, [workouts, search]);

  const setSlot = (week: number, day: number, slot: Slot) => {
    setWeeks(prev => prev.map(w => (w.weekNumber !== week ? w : { ...w, days: w.days.map((d, i) => (i === day - 1 ? slot : d)) })));
    setDirty(true);
    setPicking(null);
  };

  const copyWeekOne = () => {
    if (weeks.length < 2) return;
    Alert.alert('Copy week 1 to all weeks?', `Weeks 2–${weeks.length} will be replaced with week 1's days.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Copy', onPress: () => {
          setWeeks(prev => prev.map((w, i) => (i === 0 ? w : { ...w, days: prev[0].days.slice() })));
          setDirty(true);
        },
      },
    ]);
  };

  const clearAll = () => {
    Alert.alert('Clear the schedule?', 'Every day will become a rest day.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => { setWeeks(prev => prev.map(w => ({ ...w, days: DAYS.map(() => REST) }))); setDirty(true); } },
    ]);
  };

  const handleSave = () => {
    if (saving || !data) return;
    const payload: PlanSchedule = {
      durationWeeks: weeksCount,
      weeks: weeks.map(w => ({
        weekNumber: w.weekNumber,
        notes: w.notes,
        days: w.days.map((d, i) => ({ dayNumber: i + 1, workoutId: d.workoutId, isRestDay: d.workoutId === null })),
      })),
    };
    save(payload, {
      onSuccess: res => {
        if (!res.success) { Alert.alert('Could not save', res.message || 'The schedule was not saved.'); return; }
        if (res.data) setWeeks(toDraft(res.data, weeksCount));
        setDirty(false);
        toast.show({ type: 'success', message: res.message || 'Plan schedule saved.' });
      },
      onError: e => Alert.alert('Could not save', apiErrorText(e)),
    });
  };

  const handleBack = () => {
    if (!dirty) { onBack(); return; }
    Alert.alert('Discard changes?', 'You have unsaved changes to this schedule.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onBack },
    ]);
  };

  const trainingDays = weeks.reduce((n, w) => n + w.days.filter(d => d.workoutId).length, 0);
  const current = picking ? weeks.find(w => w.weekNumber === picking.week)?.days[picking.day - 1] : undefined;

  return (
    <>
      <FormPage
        eyebrow="Plan schedule"
        title={planName}
        onBack={handleBack}
        submitLabel={dirty ? 'Save schedule' : 'Saved'}
        onSubmit={handleSave}
        submitting={saving}
      >
        {isLoading && <Skeleton rows={4} height={56} />}
        {isError && (
          <EmptyState icon="wifi-off" tone="error" title="Couldn't load this plan" subtitle={apiErrorText(error)} action={{ label: 'Retry', onPress: () => refetch() }} />
        )}

        {!isLoading && !isError && (
          <>
            <Text style={{ color: T.textSub, fontSize: 13, marginBottom: SP.md }}>
              {weeksCount} week{weeksCount === 1 ? '' : 's'} · {trainingDays} training day{trainingDays === 1 ? '' : 's'}
              {dirty ? '  ·  unsaved changes' : ''}
            </Text>
            <Text style={{ color: T.textFaint, fontSize: 12, marginBottom: SP.lg }}>
              Tap a day to pick a workout or mark it as rest.
            </Text>

            <View style={{ flexDirection: 'row', gap: SP.sm, marginBottom: SP.lg, flexWrap: 'wrap' }}>
              <HelperButton icon="copy" label="Copy week 1 to all weeks" onPress={copyWeekOne} disabled={weeks.length < 2} />
              <HelperButton icon="x-circle" label="Clear all" onPress={clearAll} disabled={trainingDays === 0} />
            </View>

            {/* Day header */}
            <View style={{ flexDirection: 'row', gap: 4, marginBottom: 6 }}>
              <View style={{ width: 34 }} />
              {DAYS.map(d => (
                <Text key={d} style={{ flex: 1, textAlign: 'center', color: T.textFaint, fontSize: 11, fontWeight: '700' }}>D{d}</Text>
              ))}
            </View>

            {weeks.map(w => (
              <View key={w.weekNumber} style={{ flexDirection: 'row', gap: 4, marginBottom: 4, alignItems: 'stretch' }}>
                <View style={{ width: 34, justifyContent: 'center' }}>
                  <Text style={{ color: T.textSub, fontSize: 12, fontWeight: '800' }}>W{w.weekNumber}</Text>
                </View>
                {w.days.map((d, i) => {
                  const rest = d.workoutId === null;
                  return (
                    <Pressable
                      key={i}
                      onPress={() => { setSearch(''); setPicking({ week: w.weekNumber, day: i + 1 }); }}
                      accessibilityRole="button"
                      accessibilityLabel={`Week ${w.weekNumber}, day ${i + 1}: ${rest ? 'rest day' : d.workoutName}`}
                      accessibilityHint="Choose a workout or rest"
                      style={{
                        flex: 1, minHeight: 52, borderRadius: R.sm, padding: 3, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: rest ? T.bgInput : withAlpha(T.brand, 0.12),
                        borderWidth: 1, borderColor: rest ? T.line : withAlpha(T.brand, 0.4),
                      }}
                    >
                      {rest
                        ? <Feather name="moon" size={13} color={T.textFaint} />
                        : <Text numberOfLines={3} style={{ color: T.brand, fontSize: 9, fontWeight: '700', textAlign: 'center' }}>{d.workoutName}</Text>}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </>
        )}
      </FormPage>

      <BottomSheet
        visible={picking !== null}
        onClose={() => setPicking(null)}
        title={picking ? `Week ${picking.week} · Day ${picking.day}` : ''}
      >
        <View style={{ height: Math.min(height * 0.65, 560) }}>
          <View style={{ paddingHorizontal: SP.xl, paddingTop: SP.md, paddingBottom: SP.sm }}>
            <PickRow
              icon="moon"
              label="Rest day"
              selected={!!current && current.workoutId === null}
              onPress={() => picking && setSlot(picking.week, picking.day, REST)}
            />
            <SearchBar value={search} onChangeText={setSearch} placeholder="Search workouts…" label="Search workouts" />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: SP.xl }}>
            {wLoading && <Skeleton rows={4} height={48} />}
            {wError && <EmptyState icon="wifi-off" tone="error" title="Couldn't load workouts" action={{ label: 'Retry', onPress: () => wRefetch() }} />}
            {!wLoading && !wError && filteredWorkouts.length === 0 && (
              <EmptyState icon="activity" title={search ? 'No matching workouts' : 'No workouts yet'} subtitle={search ? undefined : 'Create a workout in the Workouts tab first.'} />
            )}
            {!wLoading && !wError && filteredWorkouts.map(wo => (
              <PickRow
                key={wo.id}
                icon="activity"
                label={wo.name}
                sub={[wo.goal, wo.difficulty, wo.durationMin ? `${wo.durationMin} min` : null].filter(Boolean).join(' · ')}
                selected={current?.workoutId === wo.id}
                onPress={() => picking && setSlot(picking.week, picking.day, { workoutId: wo.id, workoutName: wo.name })}
              />
            ))}
          </ScrollView>
        </View>
      </BottomSheet>
    </>
  );
}

function HelperButton({ icon, label, onPress, disabled }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38, paddingHorizontal: SP.md,
        borderRadius: 999, backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.line, opacity: disabled ? 0.4 : 1,
      }}
    >
      <Feather name={icon} size={14} color={T.textSub} />
      <Text style={{ color: T.text, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function PickRow({ icon, label, sub, selected, onPress }: {
  icon: React.ComponentProps<typeof Feather>['name']; label: string; sub?: string; selected: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 52, paddingHorizontal: SP.md, marginBottom: SP.sm,
        borderRadius: R.md, backgroundColor: selected ? withAlpha(T.brand, 0.10) : T.bgInputActive,
        borderWidth: 1, borderColor: selected ? withAlpha(T.brand, 0.4) : T.line,
      }}
    >
      <Feather name={icon} size={16} color={selected ? T.brand : T.textSub} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>{label}</Text>
        {!!sub && <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }}>{sub}</Text>}
      </View>
      {selected && <Feather name="check" size={16} color={T.brand} />}
    </Pressable>
  );
}
