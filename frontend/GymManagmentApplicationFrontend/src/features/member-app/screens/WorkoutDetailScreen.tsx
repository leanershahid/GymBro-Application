import React, { useEffect, useReducer, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Platform, ImageBackground, KeyboardAvoidingView, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useWorkoutDetail, useBookmarkWorkout, useMyTraining } from '../api/memberAppQueries';
import { useCompleteSession, useLastPerformances, usePlayerStructure } from '../../training/api/memberTrainingQueries';
import type { CompleteWorkoutRequest, CompleteWorkoutResponse, LastPerformance } from '../../training/api/training.types';
import { useIsBookmarked } from '../api/bookmarkStore';
import { T, R, withAlpha } from '../../../theme';
import { apiErrorText } from '../../../api/apiError';
import Screen from '../../common/components/Screen';
import BackButton from '../../common/components/BackButton';
import PrimaryButton from '../../common/components/PrimaryButton';
import LoadingState from '../../common/components/LoadingState';
import StatusPill, { PillTone } from '../../common/components/StatusPill';
import Skeleton from '../../common/components/Skeleton';
import { SmallButton } from '../../common/components/SmallButton';
import { useToast } from '../../common/components/Toast';
import { confirm, showAlert } from '../../common/components/dialogs';
import EmptyState from '../../common/components/EmptyState';
import { difficultyTone } from '../components/pillTones';
import { fmtSeconds, isOpen, statusLabel } from '../components/trainingUtils';
import PlayerExerciseCard from '../components/player/PlayerExerciseCard';
import RestTimerBar from '../components/player/RestTimerBar';
import FinishSheet from '../components/player/FinishSheet';
import {
  PlayerBlock, PlayerSet, SetPos, addSet, buildCompleteSets, buildPlayer, checkedSet, completeBlock, copyPrev, countSets,
  fmtClock, nextOpenSet, removeSet, restAfter, summarize,
} from '../utils/playerModel';
import { REST_IDLE, restReducer } from '../utils/restTimer';
import type { WorkoutContext } from '../memberRoutes';

const IMG_HERO = require('../../../assets/dashboard/workout-1.jpg');

interface Props {
  workoutId: number;
  userId: number;
  /** The plan day / assignment it is logged to (worked out from /me/training when omitted). */
  ctx?: WorkoutContext;
  onBack: () => void;
  /** After the summary's Done (default: onBack). */
  onFinished?: () => void;
}

const SECTION_TONE: Record<string, PillTone> = {
  warmup: 'warn', main: 'brand', cooldown: 'info', circuit: 'violet', superset: 'violet', dropset: 'err', pyramid: 'warn',
};

/** Each exercise card, measured against the scroll content when scrolling to it. */
type Layouts = { ex: Record<string, View | null> };

/** The workout player: blocks in order, prefilled set rows with last time's values, rest timer, finish summary with PRs. */
export default function WorkoutDetailScreen({ workoutId, userId, ctx, onBack, onFinished }: Props) {
  const { data: workout, isLoading, isError, refetch } = useWorkoutDetail(workoutId);
  const structureQ = usePlayerStructure(workoutId);
  const exerciseIds = structureQ.data?.sections.flatMap(s => s.exercises.map(e => e.exerciseId)) ?? [];
  const lastQ = useLastPerformances([...new Set(exerciseIds)]);
  const training = useMyTraining(userId);
  const completeM = useCompleteSession();
  const { mutate: toggleBookmark, isPending: bookmarking } = useBookmarkWorkout();
  const bookmarked = useIsBookmarked(workoutId);
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const heroH = Math.min(200, Math.round(winH * 0.24));

  const [blocks, setBlocks] = useState<PlayerBlock[] | null>(null);
  const [active, setActive] = useState<SetPos | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [rest, dispatchRest] = useReducer(restReducer, REST_IDLE);
  const [finishOpen, setFinishOpen] = useState(false);
  const [rpe, setRpe] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<CompleteWorkoutResponse | null>(null);
  const submitting = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const layouts = useRef<Layouts>({ ex: {} })
  const blocksRef = useRef<View>(null);

  // Build the player once the structure (and last values, unless they fail) are in.
  const lastReady = exerciseIds.length === 0 || lastQ.isSuccess || lastQ.isError;
  if (blocks === null && structureQ.data && lastReady) {
    const byId: Record<number, LastPerformance> = {};
    (lastQ.data ?? []).forEach(l => { byId[l.exerciseId] = l; });
    const built = buildPlayer(structureQ.data, byId);
    setBlocks(built);
    setActive(nextOpenSet(built, null));
  }

  // Elapsed clock + rest countdown.
  const resting = rest.status === 'running';
  useEffect(() => {
    if (!startedAt && !resting) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      dispatchRest({ type: 'tick', now: t });
    }, 250);
    return () => clearInterval(id);
  }, [startedAt, resting]);
  useEffect(() => {
    if (rest.status !== 'finished') return;
    const id = setTimeout(() => dispatchRest({ type: 'dismiss' }), 4000);
    return () => clearTimeout(id);
  }, [rest.status]);

  const locked = !!result;
  const counts = blocks ? countSets(blocks) : { done: 0, total: 0 };
  const elapsedSec = startedAt ? Math.max(0, Math.round((now - startedAt) / 1000)) : 0;

  const update = (fn: (bs: PlayerBlock[]) => PlayerBlock[]) => setBlocks(bs => (bs ? fn(bs) : bs));
  const updateSet = (p: SetPos, fn: (s: PlayerSet) => PlayerSet) => update(bs => bs.map((b, bi) => bi !== p.b ? b : {
    ...b, exercises: b.exercises.map((ex, ei) => ei !== p.e ? ex : { ...ex, sets: ex.sets.map((s, si) => (si === p.s ? fn(s) : s)) }),
  }));

  const scrollToExercise = (b: number, e: number) => {
    const card = layouts.current.ex[`${b}-${e}`];
    if (!card || !blocksRef.current) return;
    // Measured now: positions change as rows above open / close.
    card.measureLayout(blocksRef.current, (_x, y) => {
      scroll.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
    }, () => undefined);
  };

  const start = () => {
    if (!startedAt) { const t = Date.now(); setStartedAt(t); setNow(t); }
  };

  const toggleSet = (p: SetPos) => {
    if (!blocks || locked) return;
    const block = blocks[p.b];
    const ex = block.exercises[p.e];
    const set = ex.sets[p.s];
    if (set.done) { updateSet(p, s => ({ ...s, done: false })); setActive(p); return; }
    const checked = checkedSet(set, ex.timed);
    if (!checked) { toast.show({ type: 'error', message: `Enter ${ex.timed ? 'seconds' : 'reps'} for this set first.` }); setActive(p); return; }
    start();
    const next: PlayerBlock[] = blocks.map((b, bi) => bi !== p.b ? b : {
      ...b, exercises: b.exercises.map((x, ei) => ei !== p.e ? x : { ...x, sets: x.sets.map((s, si) => (si === p.s ? checked : s)) }),
    });
    setBlocks(next);
    const to = nextOpenSet(next, p);
    setActive(to);
    const nextEx = to ? next[to.b].exercises[to.e] : null;
    const restSec = restAfter(block, p.e, p.s);
    if (to && restSec > 0) dispatchRest({ type: 'start', seconds: restSec, now: Date.now(), label: nextEx ? `${nextEx.label ? `${nextEx.label} ` : ''}${nextEx.name} · set ${to.s + 1}` : null });
    else dispatchRest({ type: 'skip' });
    // Inside a superset/circuit: move on to the next exercise's set.
    if (to && block.grouped && to.b === p.b && to.e !== p.e) setTimeout(() => scrollToExercise(to.b, to.e), 50);
  };

  const onCompleteBlock = (bi: number) => {
    if (!blocks) return;
    const next = blocks.map((b, i) => (i === bi ? completeBlock(b) : b));
    start();
    setBlocks(next);
    setActive(nextOpenSet(next, null));
    dispatchRest({ type: 'skip' });
    const open = next[bi].exercises.some(x => x.sets.some(s => !s.done));
    if (open) toast.show({ type: 'error', message: 'Some sets need reps before they can be checked.' });
  };

  const resolvedCtx = ((): WorkoutContext | undefined => {
    if (ctx) return ctx;
    const t = training.data;
    if (!t) return undefined;
    const plan = t.plans.find(p => p.todayWorkoutId === workoutId && !p.todayIsRest && !p.todayDone && p.todayWeekNumber != null && p.todayDayNumber != null);
    if (plan) return { kind: 'plan', planAssignmentId: plan.assignmentId, week: plan.todayWeekNumber!, day: plan.todayDayNumber! };
    const a = t.workouts.find(w => w.workoutId === workoutId && isOpen(w.status));
    return a ? { kind: 'assignment', assignmentId: a.assignmentId } : undefined;
  })();

  const openFinish = () => {
    if (!blocks || counts.done === 0) {
      showAlert('No sets logged', 'Check at least one set before finishing.');
      return;
    }
    setFinishOpen(true);
  };

  const save = () => {
    if (!blocks || submitting.current || completeM.isPending) return;
    const sets = buildCompleteSets(blocks);
    const begin = startedAt ?? Date.now() - 60_000;
    const end = Math.max(Date.now(), begin + 1000);
    const body: CompleteWorkoutRequest = {
      startedAt: new Date(begin).toISOString(),
      endedAt: new Date(end).toISOString(),
      notes: notes.trim() || undefined,
      sessionRpe: rpe ?? undefined,
      sets,
      ...(resolvedCtx?.kind === 'plan' ? { planAssignmentId: resolvedCtx.planAssignmentId, week: resolvedCtx.week, day: resolvedCtx.day } : {}),
      ...(resolvedCtx?.kind === 'assignment' ? { assignmentId: resolvedCtx.assignmentId } : {}),
    };
    submitting.current = true;
    completeM.mutate({ workoutId, body }, {
      onSuccess: res => { setResult(res); dispatchRest({ type: 'dismiss' }); },
      onError: e => { submitting.current = false; toast.show({ type: 'error', message: apiErrorText(e) }); },
    });
  };

  const back = async () => {
    if (counts.done > 0 && !result) {
      const yes = await confirm({ title: 'Discard this workout?', message: 'Your checked sets will not be saved.', confirmLabel: 'Discard', destructive: true });
      if (!yes) return;
    }
    onBack();
  };

  const onBookmark = () => toggleBookmark(workoutId, {
    onSuccess: saved => toast.show({ type: 'success', message: saved ? 'Workout saved.' : 'Removed from saved.' }),
    onError: e => toast.show({ type: 'error', message: apiErrorText(e) }),
  });

  if (isLoading) return <LoadingState fullScreen label="Loading workout" />;

  if (isError || !workout) return (
    <Screen>
      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}><BackButton onPress={onBack} /></View>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <EmptyState icon="wifi-off" tone="error" title="Couldn't open this workout" subtitle="It may no longer be available to you."
          action={{ label: 'Retry', onPress: () => refetch() }} />
      </View>
    </Screen>
  );

  const title = structureQ.data?.workoutName || workout.name;
  const exerciseCount = blocks?.reduce((n, b) => n + b.exercises.length, 0) ?? 0;
  const ctxLabel = resolvedCtx?.kind === 'plan' ? `Week ${resolvedCtx.week} · Day ${resolvedCtx.day}` : resolvedCtx?.kind === 'assignment' ? 'Assigned by your coach' : null;

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroll} style={{ flex: 1 }} showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: 24 }}>
          <View ref={blocksRef}>
          {/* ── Hero ── */}
          <View style={{ height: heroH, overflow: 'hidden' }}>
            <ImageBackground source={IMG_HERO} style={{ flex: 1 }} resizeMode="cover">
              <View style={{ flex: 1, backgroundColor: T.overlay, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <BackButton onPress={back} variant="overlay" />
                  <Pressable onPress={onBookmark} disabled={bookmarking} hitSlop={8}
                    accessibilityRole="button" accessibilityLabel={bookmarked ? 'Remove from saved workouts' : 'Save workout'}
                    accessibilityState={{ selected: bookmarked, busy: bookmarking }}
                    style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: T.overlay, borderWidth: 1, borderColor: withAlpha(T.text, 0.18), alignItems: 'center', justifyContent: 'center', opacity: bookmarking ? 0.6 : 1 }}>
                    <Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={18} color={bookmarked ? T.brand : T.text} />
                  </Pressable>
                </View>
                <View>
                  {!!ctxLabel && <Text style={{ color: T.brand, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>{ctxLabel}</Text>}
                  <Text accessibilityRole="header" style={{ color: T.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }} numberOfLines={2}>{title}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    {workout.durationMin != null && <Meta icon="clock" text={`~${workout.durationMin} min`} />}
                    {exerciseCount > 0 && <Meta icon="list" text={`${exerciseCount} exercises`} />}
                    {!!workout.difficulty && <StatusPill label={workout.difficulty} tone={difficultyTone(workout.difficulty)} />}
                  </View>
                </View>
              </View>
            </ImageBackground>
          </View>

          {!!workout.description && (
            <Text style={{ color: T.textSub, fontSize: 13, lineHeight: 20, paddingHorizontal: 20, paddingTop: 14 }}>{workout.description}</Text>
          )}

          {/* ── Blocks ── */}
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            {(structureQ.isLoading || (structureQ.data && !blocks)) && <Skeleton rows={3} height={160} borderRadius={R.xl} gap={14} />}
            {structureQ.isError && (
              <EmptyState icon="wifi-off" tone="error" title="Couldn't load exercises" action={{ label: 'Retry', onPress: () => structureQ.refetch() }} />
            )}
            {blocks && blocks.length === 0 && (
              <EmptyState icon="list" title="No exercises yet" subtitle="Your trainer hasn't added exercises to this workout." />
            )}

            {blocks?.map((block, bi) => {
              const openSets = block.exercises.some(x => x.sets.some(s => !s.done));
              return (
                <View key={block.key} style={{ marginBottom: 18 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10, paddingHorizontal: 4 }}>
                    <Text style={{ color: T.text, fontSize: 16, fontWeight: '800' }}>{block.grouped && block.letter ? `${block.letter} · ` : ''}{block.title === block.type ? statusLabel(block.type) : block.title}</Text>
                    <StatusPill label={statusLabel(block.type)} tone={SECTION_TONE[block.type.toLowerCase()] ?? 'neutral'} />
                    {block.grouped && <StatusPill label={`${block.rounds} round${block.rounds === 1 ? '' : 's'}`} tone="neutral" />}
                    <View style={{ flex: 1 }} />
                    {openSets && !locked && (
                      <SmallButton icon="check-circle" label="Complete block" size="sm" onPress={() => onCompleteBlock(bi)} />
                    )}
                  </View>
                  {block.grouped && (
                    <Text style={{ color: T.textFaint, fontSize: 12, marginBottom: 8, paddingHorizontal: 4 }}>
                      Alternate {block.exercises.map(x => x.label).join(' → ')}{block.restSec ? `, ${fmtSeconds(block.restSec)} rest after each round` : ''}
                    </Text>
                  )}
                  <View style={{ gap: 10, ...(block.grouped ? { borderLeftWidth: 2, borderLeftColor: withAlpha(T.violet, 0.5), paddingLeft: 8 } : null) }}>
                    {block.exercises.map((ex, ei) => (
                      <View key={ex.key} ref={r => { layouts.current.ex[`${bi}-${ei}`] = r; }}>
                        <PlayerExerciseCard
                          ex={ex} index={ei} locked={locked}
                          activeSet={active && active.b === bi && active.e === ei ? active.s : null}
                          onFocusSet={s => setActive({ b: bi, e: ei, s })}
                          onToggle={s => toggleSet({ b: bi, e: ei, s })}
                          onChange={(s, patch) => updateSet({ b: bi, e: ei, s }, x => ({ ...x, ...patch }))}
                          onCopyPrev={s => update(bs => bs.map((b, i) => i !== bi ? b : {
                            ...b, exercises: b.exercises.map((x, j) => j !== ei ? x : { ...x, sets: x.sets.map((set, k) => (s === 'all' || s === k ? copyPrev(set, x.timed) : set)) }),
                          }))}
                          onAddSet={() => update(bs => bs.map((b, i) => i !== bi ? b : { ...b, exercises: b.exercises.map((x, j) => (j === ei ? addSet(x) : x)) }))}
                          onRemoveSet={id => { setActive(null); update(bs => bs.map((b, i) => i !== bi ? b : { ...b, exercises: b.exercises.map((x, j) => (j === ei ? removeSet(x, id) : x)) })); }}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
          </View>
        </ScrollView>

        {/* ── Rest timer + sticky bar ── */}
        <RestTimerBar rest={rest} onAdd={() => dispatchRest({ type: 'add', seconds: 15, now: Date.now() })} onSkip={() => dispatchRest({ type: 'skip' })} />
        <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 14), backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.bgInput, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View accessible accessibilityLabel={startedAt ? `Elapsed ${fmtClock(elapsedSec)}, ${counts.done} of ${counts.total} sets done` : 'Not started'} style={{ minWidth: 76 }}>
            <Text style={{ color: T.text, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{startedAt ? fmtClock(elapsedSec) : '0:00'}</Text>
            <Text style={{ color: T.textFaint, fontSize: 11 }}>{counts.done}/{counts.total} sets</Text>
          </View>
          <View style={{ flex: 1 }}>
            {result ? (
              <PrimaryButton label="Done" icon="check" onPress={onFinished ?? onBack} />
            ) : startedAt ? (
              <PrimaryButton label="Finish" icon="flag" onPress={openFinish} disabled={counts.done === 0} />
            ) : (
              <PrimaryButton label="Start workout" icon="play" disabled={!blocks || exerciseCount === 0}
                onPress={() => { start(); const p = blocks ? nextOpenSet(blocks, null) : null; setActive(p); if (p) scrollToExercise(p.b, p.e); }} />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      <FinishSheet
        visible={finishOpen}
        workoutName={title}
        local={blocks ? summarize(blocks) : { sets: 0, exercises: 0, volumeKg: 0 }}
        elapsedMin={Math.max(1, Math.round(elapsedSec / 60))}
        result={result}
        saving={completeM.isPending}
        rpe={rpe} onRpe={setRpe} notes={notes} onNotes={setNotes}
        onSave={save}
        onClose={() => setFinishOpen(false)}
        onDone={() => { setFinishOpen(false); (onFinished ?? onBack)(); }}
      />
    </Screen>
  );
}

function Meta({ icon, text }: { icon: React.ComponentProps<typeof Feather>['name']; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: T.overlay, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Feather name={icon} size={12} color={T.brand} />
      <Text style={{ color: T.text, fontSize: 12, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}
