import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { usePlanSchedule } from '../api/memberAppQueries';
import { AssignedPlan, PlanDay } from '../types/member-app.types';
import { T, R, withAlpha } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import Skeleton from '../../common/components/Skeleton';
import EmptyState from '../../dashboard/components/EmptyState';
import { AssignedPlanCard } from '../components/TrainingCards';
import { addDays, fmtWeekday, parseDay } from '../components/trainingUtils';

interface Props {
  /** The member's assignment (from /me/training) — gives start date and today's position. */
  plan: AssignedPlan;
  onBack: () => void;
  /** Opens a workout from a schedule day; days are not tappable when omitted. */
  onOpenWorkout?: (id: number) => void;
}

/** Week-by-week schedule of an assigned plan; today's day is highlighted. */
export default function PlanDetailScreen({ plan, onBack, onOpenWorkout }: Props) {
  const { data: schedule, isLoading, isError, refetch } = usePlanSchedule(plan.planId);
  const start = parseDay(plan.startDate);
  const weeksCount = Math.max(plan.durationWeeks, schedule?.durationWeeks ?? 0, ...(schedule?.weeks.map(w => w.weekNumber) ?? [0]));
  const [open, setOpen] = useState<Set<number>>(() => new Set([plan.currentWeek ?? 1]));

  const toggle = (wk: number) => setOpen(prev => {
    const next = new Set(prev);
    if (next.has(wk)) next.delete(wk); else next.add(wk);
    return next;
  });

  return (
    <Screen>
      <ScreenHeader eyebrow="Training plan" title={plan.planName} onBack={onBack} />

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        <AssignedPlanCard plan={plan} />

        <Text style={{ color: T.text, fontSize: 17, fontWeight: '700', marginTop: 8, marginBottom: 12 }}>Schedule</Text>

        {isLoading && <Skeleton rows={3} height={56} borderRadius={R.lg} gap={10} />}

        {isError && (
          <EmptyState icon="wifi-off" tone="error" title="Couldn't load the schedule" action={{ label: 'Retry', onPress: () => refetch() }} />
        )}

        {!isLoading && !isError && schedule && schedule.weeks.length === 0 && (
          <EmptyState icon="calendar" title="No schedule yet" subtitle="Your trainer hasn't filled in this plan's weeks yet." />
        )}

        {!isLoading && !isError && schedule && schedule.weeks.length > 0 && Array.from({ length: weeksCount }, (_, i) => i + 1).map(wk => {
          const week = schedule.weeks.find(w => w.weekNumber === wk);
          const isCurrent = plan.currentWeek === wk;
          const expanded = open.has(wk);
          const workouts = week?.days.filter(d => !d.isRestDay && d.workoutId != null).length ?? 0;

          return (
            <View key={wk} style={{
              backgroundColor: T.bgInput, borderRadius: R.xl, marginBottom: 12, overflow: 'hidden',
              borderWidth: 1, borderColor: isCurrent ? T.brandBorder : T.bgInputActive,
            }}>
              <Pressable
                onPress={() => toggle(wk)}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityLabel={`Week ${wk}${isCurrent ? ', this week' : ''}, ${workouts} workouts`}
                style={{ flexDirection: 'row', alignItems: 'center', padding: 14, minHeight: 52 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>Week {wk}</Text>
                    {isCurrent && (
                      <View style={{ backgroundColor: T.brandDim, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                        <Text style={{ color: T.brand, fontSize: 11, fontWeight: '700' }}>This week</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: T.textSub, fontSize: 12, marginTop: 2 }}>
                    {workouts} workout{workouts === 1 ? '' : 's'}{start ? ` · from ${fmtWeekday(addDays(start, (wk - 1) * 7))}` : ''}
                  </Text>
                </View>
                <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={T.textFaint} />
              </Pressable>

              {expanded && (
                <View style={{ paddingHorizontal: 10, paddingBottom: 10 }}>
                  {!!week?.notes && (
                    <Text style={{ color: T.textSub, fontSize: 12, paddingHorizontal: 4, marginBottom: 8, fontStyle: 'italic' }}>{week.notes}</Text>
                  )}
                  {Array.from({ length: 7 }, (_, d) => d + 1).map(dn => (
                    <DayRow
                      key={dn}
                      dayNumber={dn}
                      day={week?.days.find(x => x.dayNumber === dn)}
                      date={start ? addDays(start, (wk - 1) * 7 + dn - 1) : null}
                      isToday={isCurrent && plan.currentDay === dn}
                      onOpenWorkout={onOpenWorkout}
                    />
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

function DayRow({ dayNumber, day, date, isToday, onOpenWorkout }: {
  dayNumber: number; day?: PlanDay; date: Date | null; isToday: boolean; onOpenWorkout?: (id: number) => void;
}) {
  // Missing days are rest days (the server treats them that way too).
  const workoutId = day && !day.isRestDay ? day.workoutId : null;
  const canOpen = workoutId != null && !!onOpenWorkout;
  const title = workoutId != null ? (day?.workoutName ?? 'Workout') : 'Rest day';

  return (
    <Pressable
      disabled={!canOpen}
      onPress={() => { if (canOpen) onOpenWorkout!(workoutId!); }}
      accessibilityRole={canOpen ? 'button' : undefined}
      accessibilityLabel={`Day ${dayNumber}${date ? `, ${fmtWeekday(date)}` : ''}${isToday ? ', today' : ''}: ${title}`}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: 10, paddingVertical: 8,
        borderRadius: R.lg, marginTop: 4,
        backgroundColor: isToday ? T.brandDim : pressed ? T.bgInputActive : 'transparent',
        borderWidth: 1, borderColor: isToday ? T.brandBorder : 'transparent',
      })}>
      <View style={{ width: 64 }}>
        <Text style={{ color: isToday ? T.brand : T.textSub, fontSize: 12, fontWeight: '700' }}>{isToday ? 'Today' : `Day ${dayNumber}`}</Text>
        {date && <Text style={{ color: T.textFaint, fontSize: 11, marginTop: 1 }}>{fmtWeekday(date)}</Text>}
      </View>
      <Feather name={workoutId != null ? 'zap' : 'moon'} size={14} color={workoutId != null ? T.brand : withAlpha(T.sky, 0.8)} style={{ marginRight: 8 }} />
      <Text style={{ flex: 1, color: workoutId != null ? T.text : T.textSub, fontSize: 14, fontWeight: workoutId != null ? '600' : '400' }} numberOfLines={1}>
        {title}
      </Text>
      {canOpen && <Feather name="chevron-right" size={16} color={T.textFaint} />}
    </Pressable>
  );
}
