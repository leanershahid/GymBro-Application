import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, withAlpha } from '../../../theme';
import type { AssignedPlan } from '../../training/api/training.types';
import { usePlanDayOverride, usePlayerStructure } from '../../training/api/memberTrainingQueries';
import PrimaryButton from '../../common/components/PrimaryButton';
import { useToast } from '../../common/components/Toast';
import { apiErrorText } from '../../../api/apiError';
import SummaryRing from './SummaryRing';
import WeekStrip from './WeekStrip';
import { StripChip, toDateString } from '../utils/planCalendar';
import { estimateMinutes } from '../utils/playerModel';
import type { WorkoutContext } from '../memberRoutes';

interface Props {
  plan: AssignedPlan;
  /** Opens a plan day's workout with its plan context (logged to that day). */
  onOpenWorkout: (workoutId: number, ctx: WorkoutContext) => void;
  onOpenWeek: (assignmentId: number) => void;
  onOpenHistory?: () => void;
  onOpenRecords?: () => void;
}

const RECOVERY_TIPS = [
  { icon: 'droplet' as const, text: 'Drink 2–3 litres of water' },
  { icon: 'moon' as const, text: 'Aim for 7–9 hours of sleep' },
  { icon: 'wind' as const, text: '10 minutes of light mobility or a walk' },
];

/** Active plan on the Train tab: header + adherence ring, "This week" strip, today's card, links. */
export default function TrainingHub({ plan, onOpenWorkout, onOpenWeek, onOpenHistory, onOpenRecords }: Props) {
  const today = plan.weekStrip.find(d => d.isToday)?.date ?? toDateString(new Date());
  const pct = plan.adherence?.percent;

  const onPressDay = (c: StripChip) => {
    if (c.canOpen && c.workoutId != null && c.week != null && c.day != null) {
      onOpenWorkout(c.workoutId, { kind: 'plan', planAssignmentId: plan.assignmentId, week: c.week, day: c.day, date: c.date });
    } else onOpenWeek(plan.assignmentId);
  };

  return (
    <View style={{ marginBottom: 24 }}>
      {/* Plan header + adherence */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 }}>This week</Text>
          <Text style={{ color: T.text, fontSize: 19, fontWeight: '800', marginTop: 2 }} numberOfLines={1}>{plan.planName}</Text>
          {plan.currentWeek != null && (
            <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }}>Week {plan.currentWeek} of {plan.durationWeeks}</Text>
          )}
        </View>
        {plan.adherence && (
          <View accessible accessibilityLabel={`Adherence ${pct == null ? 'not started' : `${pct} percent`}, ${plan.adherence.completed} of ${plan.adherence.scheduled} training days done`}
            style={{ alignItems: 'center' }}>
            <SummaryRing pct={pct ?? 0} size={58} strokeWidth={6} labelSize={14} label={pct == null ? '—' : `${pct}%`} />
            <Text style={{ color: T.textFaint, fontSize: 10, fontWeight: '600', marginTop: 4 }}>
              {plan.adherence.completed}/{plan.adherence.scheduled} days
            </Text>
          </View>
        )}
      </View>

      {plan.weekStrip.length > 0 && <WeekStrip days={plan.weekStrip} onPressDay={onPressDay} />}

      <View style={{ marginTop: 14 }}>
        <TodayCard plan={plan} today={today} onOpenWorkout={onOpenWorkout} onOpenHistory={onOpenHistory} />
      </View>

      {/* Links */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <HubLink icon="calendar" label="Plan" onPress={() => onOpenWeek(plan.assignmentId)} />
        {onOpenHistory && <HubLink icon="clock" label="History" onPress={onOpenHistory} />}
        {onOpenRecords && <HubLink icon="award" label="Records" onPress={onOpenRecords} />}
      </View>
    </View>
  );
}

function HubLink({ icon, label, onPress }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1, minHeight: 48, borderRadius: R.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        backgroundColor: pressed ? T.bgInputActive : T.bgInput, borderWidth: 1, borderColor: T.line,
      })}>
      <Feather name={icon} size={15} color={T.brand} />
      <Text style={{ color: T.text, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

/** Today: workout (title, exercises, est. minutes, Start) · rest ("Recovery day") · done · skipped. */
function TodayCard({ plan, today, onOpenWorkout, onOpenHistory }: {
  plan: AssignedPlan; today: string;
  onOpenWorkout: Props['onOpenWorkout']; onOpenHistory?: () => void;
}) {
  const workoutId = !plan.todayIsRest ? plan.todayWorkoutId : null;
  const structure = usePlayerStructure(workoutId != null && !plan.todayDone ? workoutId : 0);
  const override = usePlanDayOverride(plan.assignmentId);
  const toast = useToast();
  const title = plan.todayTitle || plan.todayWorkoutName || 'Workout';
  const card = { backgroundColor: T.bgInput, borderRadius: R.xl, padding: 18, borderWidth: 1 } as const;

  if (plan.todayDone) return (
    <View accessibilityLiveRegion="polite" style={{ ...card, borderColor: T.brandBorder, flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: T.brand, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
        <Feather name="check" size={24} color={T.onBrand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: T.brand, fontSize: 16, fontWeight: '800' }}>Done ✓ — nice work</Text>
        <Text style={{ color: T.textSub, fontSize: 13, marginTop: 2 }} numberOfLines={1}>{title} is logged for today.</Text>
      </View>
      {onOpenHistory && (
        <Pressable onPress={onOpenHistory} hitSlop={8} accessibilityRole="button" accessibilityLabel="See workout history"
          style={{ minHeight: 44, justifyContent: 'center', paddingLeft: 8 }}>
          <Feather name="chevron-right" size={20} color={T.textFaint} />
        </Pressable>
      )}
    </View>
  );

  if (plan.todaySkipped) return (
    <View style={{ ...card, borderColor: T.line, flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: T.bgInputActive, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
        <Feather name="x" size={22} color={T.textSub} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: T.text, fontSize: 16, fontWeight: '700' }}>Skipped today</Text>
        <Text style={{ color: T.textSub, fontSize: 13, marginTop: 2 }} numberOfLines={1}>{title}</Text>
      </View>
      <Pressable
        onPress={() => override.mutate({ kind: 'undo', date: today }, { onError: e => toast.show({ type: 'error', message: apiErrorText(e) }) })}
        disabled={override.isPending}
        accessibilityRole="button" accessibilityLabel="Undo skip"
        style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: R.pill, justifyContent: 'center', backgroundColor: T.brandDim, borderWidth: 1, borderColor: T.brandBorder, opacity: override.isPending ? 0.6 : 1 }}>
        <Text style={{ color: T.brand, fontSize: 13, fontWeight: '700' }}>Undo</Text>
      </Pressable>
    </View>
  );

  if (workoutId == null) return (
    <View style={{ ...card, borderColor: withAlpha(T.sky, 0.25) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: withAlpha(T.sky, 0.12), alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Feather name="moon" size={20} color={T.sky} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Today</Text>
          <Text style={{ color: T.text, fontSize: 18, fontWeight: '800' }}>Recovery day</Text>
        </View>
      </View>
      {RECOVERY_TIPS.map(t => (
        <View key={t.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
          <Feather name={t.icon} size={14} color={T.sky} />
          <Text style={{ color: T.textSub, fontSize: 13, flex: 1 }}>{t.text}</Text>
        </View>
      ))}
    </View>
  );

  const exerciseCount = structure.data?.sections.reduce((n, s) => n + s.exercises.length, 0);
  const minutes = estimateMinutes(structure.data);
  const meta = [
    plan.todayWeekNumber != null ? `Week ${plan.todayWeekNumber} · Day ${plan.todayDayNumber}` : null,
    exerciseCount != null ? `${exerciseCount} exercise${exerciseCount === 1 ? '' : 's'}` : null,
    minutes != null ? `~${minutes} min` : null,
  ].filter(Boolean).join(' · ');
  const start = () => onOpenWorkout(workoutId, {
    kind: 'plan', planAssignmentId: plan.assignmentId,
    week: plan.todayWeekNumber ?? plan.currentWeek ?? 1, day: plan.todayDayNumber ?? plan.currentDay ?? 1, date: today,
  });

  return (
    <View style={{ ...card, borderColor: T.brandBorder }}>
      <Text style={{ color: T.brand, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>Today's workout</Text>
      <Text style={{ color: T.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5, marginTop: 4 }} numberOfLines={2}>{title}</Text>
      {!!meta && <Text style={{ color: T.textSub, fontSize: 13, marginTop: 4, marginBottom: 14 }}>{meta}</Text>}
      <PrimaryButton label="Start workout" icon="play" onPress={start} accessibilityHint={`Opens ${title}`} />
    </View>
  );
}
