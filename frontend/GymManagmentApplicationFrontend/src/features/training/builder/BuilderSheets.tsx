import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, useWindowDimensions } from 'react-native';
import { T, SP } from '../../../theme';
import BottomSheet from '../../common/components/BottomSheet';
import SearchBar from '../../common/components/SearchBar';
import Skeleton from '../../common/components/Skeleton';
import EmptyState from '../../common/components/EmptyState';
import ChipSelect from '../../common/components/ChipSelect';
import { Field, SwitchRow } from '../../common/components/FormFields';
import { apiErrorText } from '../../../api/apiError';
import { useLibraryWorkouts } from '../api/trainingQueries';
import type { BuilderWeek, PlanDayRef, WorkoutResponse } from '../api/training.types';
import {
  GOALS, LEVELS, dayCopyTargets, dayKey, dayTitle, humanizeEnum, laterWeeks, weekCopyOptions, weekdayOf,
} from './builderUtils';
import { CheckRow, Chip } from './BuilderUi';

// ─── Copy a day to other days (any week) ─────────────────────────────────────
export function DayCopySheet({ visible, weeks, source, onClose, onCopy }: {
  visible: boolean; weeks: BuilderWeek[]; source: PlanDayRef | null; onClose: () => void; onCopy: (targets: PlanDayRef[]) => void;
}) {
  const { height } = useWindowDimensions();
  const [sel, setSel] = useState<Set<string>>(new Set());
  useEffect(() => { if (visible) setSel(new Set()); }, [visible]);
  const toggle = (k: string) => setSel(s => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const sameDayEveryWeek = () => source && setSel(new Set(weeks.filter(w => w.weekNumber !== source.week).map(w => dayKey(w.weekNumber, source.day))));
  const targets = dayCopyTargets(sel, source ?? undefined);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Copy day to…"
      leftAction={{ label: 'Cancel', onPress: onClose }}
      rightAction={{ label: targets.length ? `Copy (${targets.length})` : 'Copy', primary: targets.length > 0, onPress: () => targets.length && onCopy(targets) }}
    >
      <ScrollView style={{ maxHeight: Math.min(height * 0.75, 640) }} contentContainerStyle={{ padding: SP.xl, gap: SP.lg }}>
        <Text style={{ color: T.textSub, fontSize: 13 }}>The chosen days' contents are replaced by a copy of this day.</Text>
        {weeks.length > 1 && <Chip small icon="repeat" label={`Same day in every week`} onPress={() => sameDayEveryWeek()} />}
        {weeks.map(w => (
          <View key={w.weekNumber}>
            <Text style={{ color: T.textSub, fontSize: 12, fontWeight: '700', marginBottom: SP.sm }}>WEEK {w.weekNumber}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {w.days.map(d => {
                const k = dayKey(w.weekNumber, d.dayNumber);
                const isSource = source?.week === w.weekNumber && source.day === d.dayNumber;
                return (
                  <Chip key={k} small label={`${weekdayOf(d.dayNumber)}${d.isRestDay ? ' · rest' : d.exerciseCount ? ` · ${dayTitle(d)}` : ''}`}
                    active={sel.has(k)} a11y={`Week ${w.weekNumber} ${weekdayOf(d.dayNumber)}${isSource ? ' (this day)' : ''}`}
                    icon={isSource ? 'star' : undefined}
                    onPress={() => !isSource && toggle(k)} />
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </BottomSheet>
  );
}

// ─── Copy a week to other weeks ──────────────────────────────────────────────
export function WeekCopySheet({ visible, totalWeeks, source, onClose, onCopy }: {
  visible: boolean; totalWeeks: number; source: number; onClose: () => void; onCopy: (toWeeks: number[]) => void;
}) {
  const [sel, setSel] = useState<number[]>([]);
  useEffect(() => { if (visible) setSel([]); }, [visible]);
  const options = useMemo(() => weekCopyOptions(totalWeeks, source, 4), [totalWeeks, source]);
  const toggle = (w: number) => setSel(s => (s.includes(w) ? s.filter(x => x !== w) : [...s, w].sort((a, b) => a - b)));
  const later = laterWeeks(totalWeeks, source);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={`Copy week ${source} to…`}
      leftAction={{ label: 'Cancel', onPress: onClose }}
      rightAction={{ label: sel.length ? `Copy (${sel.length})` : 'Copy', primary: sel.length > 0, onPress: () => sel.length && onCopy(sel) }}
    >
      <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ padding: SP.xl }}>
        <Text style={{ color: T.textSub, fontSize: 13, marginBottom: SP.md }}>Every day of the chosen weeks is replaced. New weeks extend the plan.</Text>
        {later.length > 0 && (
          <View style={{ marginBottom: SP.md, alignSelf: 'flex-start' }}>
            <Chip small icon="fast-forward" label={`All later weeks (${later.length})`} onPress={() => setSel(later)} />
          </View>
        )}
        {options.map(o => (
          <CheckRow key={o.week} label={`Week ${o.week}`} sub={o.isNew ? 'New week (extends the plan)' : null}
            checked={sel.includes(o.week)} onPress={() => toggle(o.week)} />
        ))}
      </ScrollView>
    </BottomSheet>
  );
}

// ─── Pick a library workout ──────────────────────────────────────────────────
export function LibraryWorkoutSheet({ visible, dayHasContent, onClose, onPick }: {
  visible: boolean; dayHasContent: boolean; onClose: () => void; onPick: (w: WorkoutResponse, append: boolean) => void;
}) {
  const { height } = useWindowDimensions();
  const { data = [], isLoading, isError, error, refetch } = useLibraryWorkouts(visible);
  const [search, setSearch] = useState('');
  const [append, setAppend] = useState(false);
  useEffect(() => { if (visible) { setSearch(''); setAppend(false); } }, [visible]);
  const q = search.trim().toLowerCase();
  const list = q ? data.filter(w => w.name.toLowerCase().includes(q) || (w.tags ?? []).some(t => t.toLowerCase().includes(q))) : data;

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add from library">
      <View style={{ height: Math.min(height * 0.72, 620) }}>
        <View style={{ paddingHorizontal: SP.xl, paddingTop: SP.md }}>
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search workouts…" label="Search library workouts" />
          {dayHasContent && (
            <SwitchRow label="Append to this day" description="Off: the library workout replaces the day's blocks." value={append} onValueChange={setAppend} />
          )}
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: SP.xl, paddingVertical: SP.md }}>
          {isLoading && <Skeleton rows={4} height={52} />}
          {isError && <EmptyState icon="wifi-off" tone="error" title="Couldn't load workouts" subtitle={apiErrorText(error)} action={{ label: 'Retry', onPress: () => refetch() }} />}
          {!isLoading && !isError && list.length === 0 && <EmptyState icon="activity" title={q ? 'No matching workouts' : 'The workout library is empty'} />}
          {!isLoading && !isError && list.map(w => (
            <CheckRow key={w.id} label={w.name} checked={false}
              sub={[humanizeEnum(w.goal), w.difficulty, w.durationMin ? `${w.durationMin} min` : null].filter(Boolean).join(' · ')}
              onPress={() => onPick(w, append)} />
          ))}
        </ScrollView>
      </View>
    </BottomSheet>
  );
}

// ─── Rename a day ────────────────────────────────────────────────────────────
export function RenameSheet({ visible, initial, title, onClose, onSave }: {
  visible: boolean; initial: string; title: string; onClose: () => void; onSave: (v: string) => void;
}) {
  const [v, setV] = useState(initial);
  useEffect(() => { if (visible) setV(initial); }, [visible, initial]);
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} leftAction={{ label: 'Cancel', onPress: onClose }}
      rightAction={{ label: 'Save', primary: true, onPress: () => onSave(v.trim()) }}>
      <View style={{ padding: SP.xl }}>
        <Field label="Day title" value={v} onChangeText={setV} placeholder="e.g. Push, Legs, Upper" />
        <Text style={{ color: T.textFaint, fontSize: 12 }}>Leave blank to show "Day N".</Text>
      </View>
    </BottomSheet>
  );
}

// ─── Plan details (new plan / edit details) ──────────────────────────────────
export interface PlanDetailsValue {
  name: string;
  description: string;
  goal: string;
  difficulty: string;
  weeks: string;
  daysPerWeek: string;
}

const GOAL_OPTS = GOALS.map(g => ({ value: g as string, label: humanizeEnum(g) }));
const LEVEL_OPTS = LEVELS.map(l => ({ value: l as string, label: l }));

export function PlanDetailsSheet({ visible, title, initial, showWeeks, saving, submitLabel, onClose, onSubmit }: {
  visible: boolean; title: string; initial: PlanDetailsValue; showWeeks: boolean; saving?: boolean; submitLabel: string;
  onClose: () => void; onSubmit: (v: PlanDetailsValue) => void;
}) {
  const { height } = useWindowDimensions();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<{ name?: string; weeks?: string; days?: string }>({});
  useEffect(() => { if (visible) { setV(initial); setErrors({}); } }, [visible, initial]);
  const set = (patch: Partial<PlanDetailsValue>) => setV(x => ({ ...x, ...patch }));

  const submit = () => {
    const e: typeof errors = {};
    if (!v.name.trim()) e.name = 'Name is required.';
    if (showWeeks && !(/^\d+$/.test(v.weeks.trim()) && +v.weeks >= 1 && +v.weeks <= 52)) e.weeks = 'Enter 1–52 weeks.';
    if (v.daysPerWeek.trim() && !(/^\d$/.test(v.daysPerWeek.trim()) && +v.daysPerWeek >= 1 && +v.daysPerWeek <= 7)) e.days = 'Enter 1–7.';
    setErrors(e);
    if (!Object.keys(e).length && !saving) onSubmit(v);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} leftAction={{ label: 'Cancel', onPress: onClose }}
      rightAction={{ label: saving ? 'Saving…' : submitLabel, primary: true, onPress: submit }}>
      <ScrollView style={{ maxHeight: Math.min(height * 0.8, 680) }} contentContainerStyle={{ padding: SP.xl }} keyboardShouldPersistTaps="handled">
        <Field label="Plan name" value={v.name} onChangeText={name => set({ name })} placeholder="e.g. 8-week strength base" error={errors.name} />
        <Field label="Description" value={v.description} onChangeText={description => set({ description })} placeholder="Who is it for?" multiline />
        <ChipSelect<string> label="Goal" options={GOAL_OPTS} value={v.goal} onChange={goal => set({ goal })} />
        <ChipSelect<string> label="Level" options={LEVEL_OPTS} value={v.difficulty} onChange={difficulty => set({ difficulty })} />
        {showWeeks && <Field label="Weeks" value={v.weeks} onChangeText={weeks => set({ weeks })} placeholder="4" keyboardType="number-pad" error={errors.weeks} />}
        <Field label="Training days per week (optional)" value={v.daysPerWeek} onChangeText={daysPerWeek => set({ daysPerWeek })} placeholder="4" keyboardType="number-pad" error={errors.days} />
      </ScrollView>
    </BottomSheet>
  );
}
