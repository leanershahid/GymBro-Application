import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, withAlpha } from '../../../theme';
import StatusPill from '../../common/components/StatusPill';
import { AssignedPlan, AssignedWorkout } from '../types/member-app.types';
import {
  assignmentTone, statusLabel, fmtDay, parseDay, isOverdue, planProgress,
} from './trainingUtils';

/** Thin progress bar (0…1). */
export function ProgressBar({ pct, color = T.brand }: { pct: number; color?: string }) {
  const width = `${Math.round(Math.max(0, Math.min(1, pct)) * 100)}%` as `${number}%`;
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: T.bgInputActive, overflow: 'hidden' }}>
      <View style={{ width, height: 6, borderRadius: 3, backgroundColor: color }} />
    </View>
  );
}

/** "Today in <plan>": today's workout (tap to open) or a rest day. */
export function PlanTodayCard({ plan, onOpenWorkout }: { plan: AssignedPlan; onOpenWorkout?: (id: number) => void }) {
  const workoutId = plan.todayIsRest ? null : plan.todayWorkoutId;
  const canOpen = workoutId != null && !!onOpenWorkout;
  const title = workoutId == null ? 'Rest day' : (plan.todayWorkoutName ?? 'Workout');
  const sub = `Week ${plan.currentWeek} of ${plan.durationWeeks} · Day ${plan.currentDay}`;

  return (
    <Pressable
      disabled={!canOpen}
      onPress={() => { if (canOpen) onOpenWorkout!(workoutId!); }}
      accessibilityRole={canOpen ? 'button' : undefined}
      accessibilityLabel={`Today in ${plan.planName}: ${title}. ${sub}`}
      style={({ pressed }) => ({
        backgroundColor: pressed ? T.bgInputActive : T.bgInput,
        borderRadius: R.xl, padding: 16, marginBottom: 12,
        borderWidth: 1, borderColor: canOpen ? T.brandBorder : T.line,
        flexDirection: 'row', alignItems: 'center',
      })}>
      <View style={{
        width: 44, height: 44, borderRadius: 14, marginRight: 14, alignItems: 'center', justifyContent: 'center',
        backgroundColor: canOpen ? T.brandDim : withAlpha(T.sky, 0.12),
      }}>
        <Feather name={workoutId != null ? 'zap' : 'moon'} size={20} color={workoutId != null ? T.brand : T.sky} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 }} numberOfLines={1}>
          Today in {plan.planName}
        </Text>
        <Text style={{ color: T.text, fontSize: 16, fontWeight: '700', marginTop: 2 }} numberOfLines={1}>{title}</Text>
        <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{sub}</Text>
      </View>
      {canOpen && (
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: T.brand, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="play" size={15} color={T.onBrand} />
        </View>
      )}
    </Pressable>
  );
}

/** One assigned workout: name, trainer, due date (overdue in red), status. */
export function AssignedWorkoutCard({ item, onOpenWorkout }: { item: AssignedWorkout; onOpenWorkout?: (id: number) => void }) {
  const overdue = isOverdue(item);
  const due = parseDay(item.dueDate);
  const meta = [
    item.trainerName ? `From ${item.trainerName}` : null,
    due ? `${overdue ? 'Overdue · was due' : 'Due'} ${fmtDay(due)}` : `Assigned ${fmtDay(parseDay(item.assignedAt))}`,
  ].filter(Boolean).join(' · ');

  return (
    <Pressable
      disabled={!onOpenWorkout}
      onPress={() => onOpenWorkout?.(item.workoutId)}
      accessibilityRole="button"
      accessibilityLabel={`Open assigned workout ${item.workoutName}. ${meta}. ${statusLabel(item.status)}`}
      style={({ pressed }) => ({
        backgroundColor: pressed ? T.bgInputActive : T.bgInput,
        borderRadius: R.xl, padding: 14, marginBottom: 10,
        borderWidth: 1, borderColor: overdue ? withAlpha(T.err, 0.35) : T.bgInputActive,
      })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{item.workoutName}</Text>
          <Text style={{ color: overdue ? T.err : T.textSub, fontSize: 12, marginTop: 3 }} numberOfLines={1}>{meta}</Text>
        </View>
        <StatusPill label={statusLabel(item.status)} tone={assignmentTone(item.status)} />
      </View>
      {!!item.notes && (
        <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 8, fontStyle: 'italic' }} numberOfLines={2}>{item.notes}</Text>
      )}
    </Pressable>
  );
}

/** Assigned plan summary: status, start date, current week/day and an elapsed-days progress bar. */
export function AssignedPlanCard({ plan, onPress }: { plan: AssignedPlan; onPress?: () => void }) {
  const { elapsed, total, pct } = planProgress(plan);
  const start = parseDay(plan.startDate);
  const notStarted = plan.currentWeek == null && elapsed === 0;
  const position = plan.currentWeek != null
    ? `Week ${plan.currentWeek} · Day ${plan.currentDay}`
    : notStarted ? `Starts ${fmtDay(start, true)}` : 'Finished';
  const today = plan.currentWeek != null
    ? (plan.todayIsRest || plan.todayWorkoutId == null ? 'Rest day' : (plan.todayWorkoutName ?? 'Workout'))
    : null;

  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${plan.planName}, ${statusLabel(plan.status)}, ${position}, ${elapsed} of ${total} days`}
      style={({ pressed }) => ({
        backgroundColor: pressed ? T.bgInputActive : T.bgInput,
        borderRadius: R.xl, padding: 16, marginBottom: 12,
        borderWidth: 1, borderColor: pressed ? T.brandBorder : T.bgInputActive,
      })}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 }}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={{ color: T.text, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>{plan.planName}</Text>
          <Text style={{ color: T.textSub, fontSize: 12, marginTop: 3 }} numberOfLines={1}>
            {plan.durationWeeks} weeks · {notStarted ? 'starts' : 'started'} {fmtDay(start, true)}
          </Text>
        </View>
        <StatusPill label={statusLabel(plan.status)} tone={assignmentTone(plan.status)} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ color: T.text, fontSize: 12, fontWeight: '600' }}>{position}</Text>
        <Text style={{ color: T.textFaint, fontSize: 12 }}>{elapsed}/{total} days</Text>
      </View>
      <ProgressBar pct={pct} />
      {(today || onPress) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
          <Text style={{ flex: 1, color: T.textSub, fontSize: 12 }} numberOfLines={1}>{today ? `Today: ${today}` : 'View schedule'}</Text>
          {onPress && <Feather name="chevron-right" size={18} color={T.textFaint} />}
        </View>
      )}
    </Pressable>
  );
}
