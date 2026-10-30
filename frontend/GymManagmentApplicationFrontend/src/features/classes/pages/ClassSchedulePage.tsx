import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, FlatList, RefreshControl, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import SegmentedTabs from '../../common/components/SegmentedTabs';
import LoadingState from '../../common/components/LoadingState';
import StatusPill from '../../common/components/StatusPill';
import EmptyState from '../../dashboard/components/EmptyState';
import { describeApiError } from '../../../api/apiError';
import { getSession } from '../../../api/session';
import { useSchedule, useBranchOptions, useTrainerOptions, useMyTrainerProfile } from '../api/classesQueries';
import { GymClass } from '../types/classes.types';
import ClassDetailSheet from '../components/ClassDetailSheet';
import ClassFormSheet from '../components/ClassFormSheet';
import ClassTypesSection from '../components/ClassTypesSection';
import { FilterRow, addDays, fmtTime, localDateKey, startOfWeek, statusLabel, statusTone } from '../components/classesUi';
import { T, SP, R, withAlpha } from '../../../theme';

export interface ClassSchedulePageProps {
  onBack?: () => void;
  mode: 'admin' | 'trainer';
}

type Tab = 'schedule' | 'types';
const TABS: { key: Tab; label: string }[] = [
  { key: 'schedule', label: 'Schedule' },
  { key: 'types', label: 'Class types' },
];

/** Weekly class schedule for staff (admin: all trainers + class types; trainer: their gym's classes, mine by default). */
export default function ClassSchedulePage({ onBack, mode }: ClassSchedulePageProps) {
  const isAdmin = mode === 'admin';
  const [tab, setTab] = useState<Tab>('schedule');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [day, setDay] = useState(() => localDateKey(new Date()));
  const [branchId, setBranchId] = useState<number | null>(null);
  const [trainerId, setTrainerId] = useState<number | null>(null);
  const [mineOnly, setMineOnly] = useState<'mine' | null>('mine');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<{ existing: GymClass | null } | null>(null);

  const branches = useBranchOptions(isAdmin);
  const trainers = useTrainerOptions(isAdmin);
  const myProfile = useMyTrainerProfile(!isAdmin);
  const me = myProfile.me;

  const effectiveTrainer = isAdmin ? trainerId : (mineOnly && me ? me.id : null);
  const filter = useMemo(() => ({
    from: weekStart.toISOString(),
    to: addDays(weekStart, 7).toISOString(),
    branchId: isAdmin ? branchId : null,
    trainerId: effectiveTrainer,
  }), [weekStart, branchId, effectiveTrainer, isAdmin]);
  const { data, isLoading, error, refetch, isRefetching, isPlaceholderData } = useSchedule(filter);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const byDay = useMemo(() => {
    const m: Record<string, GymClass[]> = {};
    for (const c of data ?? []) (m[localDateKey(new Date(c.startsAt))] ??= []).push(c);
    return m;
  }, [data]);
  const dayClasses = byDay[day] ?? [];
  const selected = selectedId != null ? (data ?? []).find(c => c.id === selectedId) ?? null : null;

  const shiftWeek = (n: number) => {
    const next = addDays(weekStart, 7 * n);
    setWeekStart(next);
    // Keep the same weekday selected.
    const offset = days.findIndex(d => localDateKey(d) === day);
    setDay(localDateKey(addDays(next, Math.max(0, offset))));
  };
  const goToday = () => {
    setWeekStart(startOfWeek(new Date()));
    setDay(localDateKey(new Date()));
  };

  const weekLabel = `${weekStart.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${addDays(weekStart, 6).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const todayKey = localDateKey(new Date());
  const trainerBranch = getSession()?.branchId ?? me?.branchId ?? null;

  return (
    <Screen>
      <ScreenHeader
        eyebrow={isAdmin ? 'Classes' : 'My schedule'}
        title="Class schedule"
        onBack={onBack}
        action={tab === 'schedule' ? { label: 'New', icon: 'plus', onPress: () => setForm({ existing: null }) } : undefined}
      />
      {isAdmin && (
        <View style={{ paddingHorizontal: SP.xl, marginBottom: SP.md }}>
          <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} />
        </View>
      )}

      {tab === 'types' && isAdmin ? <ClassTypesSection /> : (
        <View style={{ flex: 1 }}>
          {/* Week navigation */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.xl, marginBottom: SP.sm, gap: SP.sm }}>
            <NavButton icon="chevron-left" label="Previous week" onPress={() => shiftWeek(-1)} />
            <Text style={{ flex: 1, textAlign: 'center', color: T.text, fontSize: 15, fontWeight: '700' }}>{weekLabel}</Text>
            <NavButton icon="chevron-right" label="Next week" onPress={() => shiftWeek(1)} />
            <Pressable onPress={goToday} accessibilityRole="button" accessibilityLabel="Go to today" hitSlop={8}
              style={{ paddingHorizontal: SP.md, minHeight: 36, justifyContent: 'center', borderRadius: R.pill, borderWidth: 1, borderColor: T.brandBorder }}>
              <Text style={{ color: T.brand, fontSize: 12, fontWeight: '700' }}>Today</Text>
            </Pressable>
          </View>

          {/* Day chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}
            contentContainerStyle={{ paddingHorizontal: SP.xl, gap: SP.sm, marginBottom: SP.md }}>
            {days.map(d => {
              const key = localDateKey(d);
              const active = key === day;
              const count = byDay[key]?.length ?? 0;
              return (
                <Pressable key={key} onPress={() => setDay(key)} accessibilityRole="tab" accessibilityState={{ selected: active }}
                  accessibilityLabel={`${d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}, ${count} classes`}
                  style={{
                    width: 48, paddingVertical: SP.sm, borderRadius: R.md, alignItems: 'center', borderWidth: 1,
                    backgroundColor: active ? T.brand : T.bgInput, borderColor: active ? T.brand : key === todayKey ? T.brandBorder : T.line,
                  }}>
                  <Text style={{ color: active ? T.onBrand : T.textFaint, fontSize: 11, fontWeight: '700' }}>
                    {d.toLocaleDateString(undefined, { weekday: 'short' })}
                  </Text>
                  <Text style={{ color: active ? T.onBrand : T.text, fontSize: 17, fontWeight: '800' }}>{d.getDate()}</Text>
                  <View style={{ width: 6, height: 6, borderRadius: 3, marginTop: 3, backgroundColor: count ? (active ? T.onBrand : T.brand) : 'transparent' }} />
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Filters */}
          <View style={{ paddingHorizontal: SP.xl }}>
            {isAdmin && (branches.data?.length ?? 0) > 1 && (
              <FilterRow<number> label="Branch" allLabel="All branches" value={branchId} onChange={setBranchId}
                options={(branches.data ?? []).map(b => ({ value: b.id, label: b.name }))} />
            )}
            {isAdmin && (trainers.data?.length ?? 0) > 0 && (
              <FilterRow<number> label="Trainer" allLabel="All trainers" value={trainerId} onChange={setTrainerId}
                options={(trainers.data ?? []).map(t => ({ value: t.id, label: t.name }))} />
            )}
            {!isAdmin && me && (
              <FilterRow<'mine'> value={mineOnly} onChange={setMineOnly} allLabel="All classes"
                options={[{ value: 'mine', label: 'My classes' }]} />
            )}
          </View>

          {isLoading ? <LoadingState label="Loading classes…" /> : error ? (
            <EmptyState icon="alert-triangle" tone="error" title="Couldn't load classes"
              subtitle={describeApiError(error).message} action={{ label: 'Try again', onPress: () => refetch() }} />
          ) : (
            <FlatList
              data={dayClasses}
              keyExtractor={c => String(c.id)}
              style={{ opacity: isPlaceholderData ? 0.5 : 1 }}
              contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: SP.xxl }}
              refreshControl={<RefreshControl refreshing={isRefetching && !isPlaceholderData} onRefresh={refetch} tintColor={T.brand} />}
              ListEmptyComponent={
                <EmptyState icon="calendar" title="No classes this day"
                  subtitle={(data ?? []).length ? 'Pick another day above, or schedule one.' : 'Nothing scheduled this week yet.'}
                  action={{ label: 'New class', onPress: () => setForm({ existing: null }) }} />
              }
              renderItem={({ item }) => <ClassCard cls={item} onPress={() => setSelectedId(item.id)} />}
            />
          )}
        </View>
      )}

      <ClassDetailSheet
        cls={selected}
        onClose={() => setSelectedId(null)}
        onEdit={c => { setSelectedId(null); setForm({ existing: c }); }}
      />
      <ClassFormSheet
        visible={!!form}
        onClose={() => setForm(null)}
        mode={mode}
        existing={form?.existing ?? null}
        defaultDate={day < todayKey ? todayKey : day}
        defaultBranchId={isAdmin ? branchId : trainerBranch}
      />
    </Screen>
  );
}

function NavButton({ icon, label, onPress }: { icon: 'chevron-left' | 'chevron-right'; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8}
      style={({ pressed }) => ({
        width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
        backgroundColor: pressed ? T.bgInputActive : T.bgInput, borderWidth: 1, borderColor: T.line,
      })}>
      <Feather name={icon} size={18} color={T.text} />
    </Pressable>
  );
}

function ClassCard({ cls, onPress }: { cls: GymClass; onPress: () => void }) {
  const accent = cls.color || T.brand;
  const cancelled = cls.status === 'Cancelled';
  const full = cls.capacity != null && cls.booked >= cls.capacity;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${cls.title} at ${fmtTime(cls.startsAt)}, ${statusLabel(cls.status)}`}
      style={({ pressed }) => ({
        flexDirection: 'row', marginBottom: SP.sm, borderRadius: R.lg, borderWidth: 1, borderColor: T.line, overflow: 'hidden',
        backgroundColor: pressed ? T.bgInputActive : T.bgInput, opacity: cancelled ? 0.6 : 1,
      })}
    >
      <View style={{ width: 4, backgroundColor: accent }} />
      <View style={{ width: 64, paddingVertical: SP.md, alignItems: 'center', backgroundColor: withAlpha(T.brand, 0.04) }}>
        <Text style={{ color: T.text, fontSize: 14, fontWeight: '800' }}>{fmtTime(cls.startsAt)}</Text>
        <Text style={{ color: T.textFaint, fontSize: 11, marginTop: 2 }}>{fmtTime(cls.endsAt)}</Text>
      </View>
      <View style={{ flex: 1, padding: SP.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
          <Text style={{ flex: 1, color: T.text, fontSize: 15, fontWeight: '800', textDecorationLine: cancelled ? 'line-through' : 'none' }} numberOfLines={1}>
            {cls.title}
          </Text>
          {cls.status !== 'Scheduled' && <StatusPill label={statusLabel(cls.status)} tone={statusTone(cls.status)} />}
        </View>
        <Text style={{ color: T.textSub, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
          {cls.trainerName ?? 'No trainer'}{cls.branchName ? ` · ${cls.branchName}` : ''}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, marginTop: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Feather name="users" size={12} color={full ? T.brandGold : T.textFaint} />
            <Text style={{ color: full ? T.brandGold : T.textFaint, fontSize: 12, fontWeight: '600' }}>
              {cls.booked}{cls.capacity != null ? `/${cls.capacity}` : ''} booked
            </Text>
          </View>
          {cls.waitlisted > 0 && (
            <Text style={{ color: T.brandGold, fontSize: 12, fontWeight: '600' }}>{cls.waitlisted} waitlisted</Text>
          )}
          {cls.seriesId != null && <Feather name="repeat" size={12} color={T.textFaint} />}
        </View>
      </View>
    </Pressable>
  );
}
