import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, withAlpha } from '../../../theme';
import { useMyTraining } from '../api/memberAppQueries';
import { usePlanCalendar, usePlanDayOverride } from '../../training/api/memberTrainingQueries';
import type { CalendarEntry, DateString } from '../../training/api/training.types';
import { apiErrorText } from '../../../api/apiError';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import Skeleton from '../../common/components/Skeleton';
import EmptyState from '../../common/components/EmptyState';
import StatusPill, { PillTone } from '../../common/components/StatusPill';
import BottomSheet from '../../common/components/BottomSheet';
import { useToast } from '../../common/components/Toast';
import { confirm } from '../../common/components/dialogs';
import SummaryRing from '../components/SummaryRing';
import {
  DayRow, STATUS_LABEL, dayActions, dayRows, fromDateString, moveTargets, planWeekOf, planWeekRange, toDateString, undoDateOf,
} from '../utils/planCalendar';
import type { WorkoutContext } from '../memberRoutes';

interface Props {
  assignmentId: number;
  userId: number;
  /** Plan week to show first (default: this week). */
  initialWeek?: number;
  onBack: () => void;
  onOpenWorkout: (workoutId: number, ctx: WorkoutContext) => void;
}

const TONE: Record<CalendarEntry['status'], PillTone> = {
  done: 'ok', scheduled: 'brand', missed: 'err', skipped: 'neutral', moved: 'info', rest: 'info',
};

const fmtDate = (s: DateString, opts: Intl.DateTimeFormatOptions) => fromDateString(s).toLocaleDateString(undefined, opts);

/** One plan week by date (from the calendar): status per day, ⋯ to skip / move / undo, tap to open. */
export default function PlanWeekScreen({ assignmentId, userId, initialWeek, onBack, onOpenWorkout }: Props) {
  const training = useMyTraining(userId);
  const plan = training.data?.plans.find(p => p.assignmentId === assignmentId);
  const today = toDateString(new Date());
  const weeks = Math.max(1, plan?.durationWeeks ?? 1);
  const [picked, setPicked] = useState<number | null>(initialWeek ?? null);
  const week = Math.min(weeks, picked ?? (plan ? planWeekOf(plan.startDate, today, weeks) : 1));
  const range = plan ? planWeekRange(plan.startDate, week) : null;
  const cal = usePlanCalendar(plan ? assignmentId : 0, range?.from, range?.to);
  const override = usePlanDayOverride(assignmentId);
  const toast = useToast();
  const [menu, setMenu] = useState<CalendarEntry | null>(null);
  const [moving, setMoving] = useState<CalendarEntry | null>(null);

  const rows: DayRow[] = range && cal.data ? dayRows(cal.data.entries, range.from, range.to, today) : [];

  const pickWeek = (w: number) => setPicked(w);

  const run = (a: Parameters<typeof override.mutate>[0], ok: string) =>
    override.mutate(a, {
      onSuccess: () => toast.show({ type: 'success', message: ok }),
      onError: e => toast.show({ type: 'error', message: apiErrorText(e) }),
    });

  const skip = async (e: CalendarEntry) => {
    setMenu(null);
    const yes = await confirm({ title: 'Skip this day?', message: `${e.title ?? 'Workout'} on ${fmtDate(e.date, { weekday: 'long', day: 'numeric', month: 'short' })} won't count as missed. You can undo it.`, confirmLabel: 'Skip day' });
    if (yes) run({ kind: 'skip', date: e.date }, 'Day skipped.');
  };

  const open = (e: CalendarEntry) => {
    if (e.workoutId == null) return;
    onOpenWorkout(e.workoutId, { kind: 'plan', planAssignmentId: assignmentId, week: e.weekNumber, day: e.dayNumber, date: e.date });
  };

  if (training.isLoading) return (
    <Screen><ScreenHeader eyebrow="Training plan" title="Plan" onBack={onBack} />
      <View style={{ paddingHorizontal: 20 }}><Skeleton rows={6} height={64} borderRadius={R.lg} gap={10} /></View></Screen>
  );
  if (training.isError || !plan) return (
    <Screen><ScreenHeader eyebrow="Training plan" title="Plan" onBack={onBack} />
      <View style={{ flex: 1, justifyContent: 'center' }}>
        {training.isError
          ? <EmptyState icon="wifi-off" tone="error" title="Couldn't load your plan" action={{ label: 'Retry', onPress: () => training.refetch() }} />
          : <EmptyState icon="calendar" title="Plan not found" subtitle="This plan is no longer assigned to you." />}
      </View></Screen>
  );

  const adherence = cal.data?.adherence ?? plan.adherence;
  const menuActions = menu ? dayActions(menu, today) : [];

  return (
    <Screen>
      <ScreenHeader eyebrow="Training plan" title={plan.planName} onBack={onBack} />

      {/* Week selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 12 }}>
        {Array.from({ length: weeks }, (_, i) => i + 1).map(w => {
          const sel = w === week;
          const current = w === plan.currentWeek;
          return (
            <Pressable key={w} onPress={() => pickWeek(w)} accessibilityRole="button"
              accessibilityLabel={`Week ${w}${current ? ', this week' : ''}`} accessibilityState={{ selected: sel }}
              style={{
                minWidth: 56, minHeight: 44, paddingHorizontal: 12, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center',
                backgroundColor: sel ? T.brand : T.bgInput, borderWidth: 1, borderColor: sel ? T.brand : current ? T.brandBorder : T.line,
              }}>
              <Text style={{ color: sel ? T.onBrand : T.text, fontSize: 13, fontWeight: '700' }}>W{w}</Text>
              {current && <View style={{ width: 4, height: 4, borderRadius: 2, marginTop: 2, backgroundColor: sel ? T.onBrand : T.brand }} />}
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        {/* Week summary */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.bgInput, borderRadius: R.xl, padding: 16, borderWidth: 1, borderColor: T.line, marginBottom: 14 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: T.text, fontSize: 17, fontWeight: '800' }}>Week {week} of {weeks}</Text>
            {range && <Text style={{ color: T.textSub, fontSize: 13, marginTop: 2 }}>
              {fmtDate(range.from, { day: 'numeric', month: 'short' })} – {fmtDate(range.to, { day: 'numeric', month: 'short' })}
            </Text>}
            {adherence && <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 4 }}>
              {adherence.completedWorkoutDays} of {adherence.totalWorkoutDays} workouts done in the plan
            </Text>}
          </View>
          {adherence && (
            <View accessible accessibilityLabel={`Adherence ${adherence.percent ?? 0} percent`}>
              <SummaryRing pct={adherence.percent ?? 0} size={58} strokeWidth={6} labelSize={14} label={adherence.percent == null ? '—' : `${adherence.percent}%`} />
            </View>
          )}
        </View>

        {cal.isLoading && <Skeleton rows={7} height={64} borderRadius={R.lg} gap={8} />}
        {cal.isError && <EmptyState icon="wifi-off" tone="error" title="Couldn't load this week" action={{ label: 'Retry', onPress: () => cal.refetch() }} />}

        {!cal.isLoading && !cal.isError && rows.map(r => (
          <View key={r.date} style={{ marginBottom: 8 }}>
            {r.entries.length === 0 ? (
              <DayLine date={r.date} isToday={r.isToday} entry={null} today={today} />
            ) : r.entries.map(e => (
              <DayLine key={`${e.date}-${e.movedFromDate ?? ''}`} date={r.date} isToday={r.isToday} entry={e} today={today}
                onOpen={() => open(e)} onMenu={() => setMenu(e)} />
            ))}
          </View>
        ))}
      </ScrollView>

      {/* Day ⋯ */}
      <BottomSheet visible={!!menu} onClose={() => setMenu(null)}
        title={menu ? `${menu.title ?? 'Workout'} · ${fmtDate(menu.date, { weekday: 'short', day: 'numeric', month: 'short' })}` : ''}>
        <View style={{ padding: 12 }}>
          {menuActions.includes('open') && <SheetRow icon="play" label="Open workout" onPress={() => { const e = menu!; setMenu(null); open(e); }} />}
          {menuActions.includes('skip') && <SheetRow icon="x-circle" label="Skip this day" onPress={() => skip(menu!)} />}
          {menuActions.includes('move') && <SheetRow icon="corner-up-right" label="Move to another day" onPress={() => { setMoving(menu); setMenu(null); }} />}
          {menuActions.includes('undo') && (
            <SheetRow icon="rotate-ccw" label={menu?.movedFromDate ? 'Move back' : menu?.status === 'moved' ? 'Undo move' : 'Undo skip'}
              onPress={() => { const e = menu!; setMenu(null); run({ kind: 'undo', date: undoDateOf(e) }, 'Day restored.'); }} />
          )}
          {menuActions.filter(a => a !== 'open').length === 0 && (
            <Text style={{ color: T.textSub, fontSize: 13, padding: 12 }}>
              {menu?.status === 'done' ? 'This day is done.' : menu && menu.date < today ? 'Past days can’t be changed.' : 'Nothing to change for this day.'}
            </Text>
          )}
        </View>
      </BottomSheet>

      {/* Move picker: today or later, within the plan (+7 days) */}
      <BottomSheet visible={!!moving} onClose={() => setMoving(null)} title="Move to…">
        {moving && (
          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {moveTargets(today, plan.startDate, plan.endDate, moving.date).map(d => (
              <Pressable key={d}
                onPress={() => { const e = moving; setMoving(null); run({ kind: 'move', date: e.date, toDate: d }, `Moved to ${fmtDate(d, { weekday: 'long', day: 'numeric', month: 'short' })}.`); }}
                accessibilityRole="button" accessibilityLabel={`Move to ${fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}`}
                style={({ pressed }) => ({
                  width: '22.5%', minHeight: 60, borderRadius: R.md, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: pressed ? T.brandDim : T.bgInputActive, borderWidth: 1, borderColor: d === today ? T.brandBorder : T.line,
                })}>
                <Text style={{ color: T.textFaint, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>{d === today ? 'Today' : fmtDate(d, { weekday: 'short' })}</Text>
                <Text style={{ color: T.text, fontSize: 16, fontWeight: '800', marginTop: 2 }}>{fromDateString(d).getDate()}</Text>
                <Text style={{ color: T.textSub, fontSize: 10 }}>{fmtDate(d, { month: 'short' })}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </BottomSheet>
    </Screen>
  );
}

function SheetRow({ icon, label, onPress }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 12, borderRadius: R.md, backgroundColor: pressed ? T.bgInputActive : 'transparent' })}>
      <Feather name={icon} size={18} color={T.text} />
      <Text style={{ color: T.text, fontSize: 15, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

function DayLine({ date, isToday, entry, today, onOpen, onMenu }: {
  date: DateString; isToday: boolean; entry: CalendarEntry | null; today: DateString; onOpen?: () => void; onMenu?: () => void;
}) {
  const rest = !entry || entry.isRestDay || entry.workoutId == null;
  const status = entry?.status ?? 'rest';
  const canOpen = !!entry && !rest && status !== 'moved' && !!onOpen;
  const title = rest ? (entry?.title && !entry.isRestDay ? entry.title : 'Rest') : entry!.title || 'Workout';
  const note = entry?.movedToDate ? `Moved to ${fmtDate(entry.movedToDate, { weekday: 'short', day: 'numeric' })}`
    : entry?.movedFromDate ? `Moved from ${fmtDate(entry.movedFromDate, { weekday: 'short', day: 'numeric' })}`
    : entry ? `Week ${entry.weekNumber} · Day ${entry.dayNumber}` : null;
  const hasMenu = !!entry && !!onMenu && dayActions(entry, today).some(a => a !== 'open');
  const done = status === 'done';

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', borderRadius: R.lg, minHeight: 64,
      backgroundColor: isToday ? T.brandDim : T.bgInput, borderWidth: 1, borderColor: isToday ? T.brandBorder : T.line,
    }}>
      <Pressable disabled={!canOpen} onPress={onOpen} accessibilityRole={canOpen ? 'button' : undefined}
        accessibilityLabel={`${fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}${isToday ? ', today' : ''}: ${title}, ${STATUS_LABEL[status]}${note ? `, ${note}` : ''}`}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingLeft: 12 }}>
        <View style={{ width: 48, alignItems: 'center', marginRight: 10 }}>
          <Text style={{ color: isToday ? T.brand : T.textFaint, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>
            {isToday ? 'Today' : fmtDate(date, { weekday: 'short' })}
          </Text>
          <Text style={{ color: isToday ? T.brand : T.text, fontSize: 18, fontWeight: '800' }}>{fromDateString(date).getDate()}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {rest ? <Feather name="moon" size={13} color={withAlpha(T.sky, 0.9)} />
              : done ? <Feather name="check-circle" size={13} color={T.ok} /> : null}
            <Text numberOfLines={1} style={{
              flexShrink: 1, color: rest ? T.textSub : T.text, fontSize: 15, fontWeight: rest ? '500' : '700',
              textDecorationLine: status === 'skipped' || status === 'moved' ? 'line-through' : 'none',
            }}>{title}</Text>
          </View>
          {!!note && !rest && <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }}>{note}</Text>}
        </View>
        {!rest && <View style={{ marginLeft: 8 }}><StatusPill label={STATUS_LABEL[status]} tone={TONE[status]} /></View>}
      </Pressable>
      {hasMenu ? (
        <Pressable onPress={onMenu} hitSlop={6} accessibilityRole="button" accessibilityLabel={`More actions for ${title}`}
          style={{ width: 48, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="more-horizontal" size={20} color={T.textSub} />
        </Pressable>
      ) : <View style={{ width: canOpen ? 36 : 12, alignItems: 'center' }}>{canOpen && <Feather name="chevron-right" size={16} color={T.textFaint} />}</View>}
    </View>
  );
}
