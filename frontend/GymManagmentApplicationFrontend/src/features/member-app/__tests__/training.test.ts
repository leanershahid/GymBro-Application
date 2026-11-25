import { describe, expect, it } from '@jest/globals';
import type { CalendarEntry, LastPerformance, LoggedSet, WeekStripDay, WorkoutStructure } from '../../training/api/training.types';
import {
  addSet, buildCompleteSets, buildPlayer, checkedSet, completeBlock, copyPrev, estimateMinutes, executionOrder, fmtClock,
  lastHint, nextOpenSet, prefillFromTarget, removeSet, restAfter, stepValue, summarize,
} from '../utils/playerModel';
import { REST_IDLE, restReducer } from '../utils/restTimer';
import {
  dayActions, dayRows, groupHistoryByWeek, moveTargets, planWeekOf, planWeekRange, stripChip, undoDateOf,
} from '../utils/planCalendar';
import { memberModuleOf, memberRouteFromPath, memberRouteToPath } from '../memberRoutes';

const set = (setNo: number, reps: number | null, weightKg: number | null, extra: Partial<LoggedSet> = {}): LoggedSet => ({
  id: setNo, exerciseId: 11, exerciseName: 'Bench Press', workoutExerciseId: null, setNo, setType: 'normal', reps, weightKg,
  rpe: null, durationSec: null, distanceM: null, completed: true, ...extra,
});

const STRUCTURE: WorkoutStructure = {
  workoutId: 601, workoutName: 'Push',
  sections: [
    { name: 'Bench', type: 'Main', rounds: 1, restSeconds: null, exercises: [{
      workoutExerciseId: 1, exerciseId: 11, exerciseName: 'Bench Press', sets: 4, reps: '6-8', durationSeconds: null, restSeconds: 120,
      setTargets: [
        { type: 'warmup', repsMin: 10, repsMax: 10, weightKg: 40, restSec: 60 },
        { repsMin: 6, repsMax: 8, weightKg: 62.5, restSec: 120 },
        { repsMin: 6, repsMax: 8, weightKg: 62.5, restSec: 120 },
      ],
    }] },
    { name: 'Finisher', type: 'Superset', rounds: 2, restSeconds: 90, exercises: [
      { workoutExerciseId: 2, exerciseId: 12, exerciseName: 'Incline DB', sets: null, reps: '10', durationSeconds: null, restSeconds: 0, weightSuggestion: '22 kg' },
      { workoutExerciseId: 3, exerciseId: 13, exerciseName: 'Cable Fly', sets: null, reps: '12-15', durationSeconds: null, restSeconds: 0 },
    ] },
    { name: 'Core', type: 'Cooldown', rounds: 1, restSeconds: null, exercises: [
      { workoutExerciseId: 4, exerciseId: 34, exerciseName: 'Plank', sets: 2, reps: null, durationSeconds: 45, restSeconds: 30 },
    ] },
    { name: 'Empty', type: 'Main', rounds: 1, restSeconds: null, exercises: [] },
  ],
};

const LAST: LastPerformance = {
  exerciseId: 11, exerciseName: 'Bench Press', logId: 1, performedAt: '2026-11-01T07:00:00Z',
  sets: [set(1, 10, 40, { setType: 'warmup' }), set(2, 8, 60), set(3, 7, 60)], bestSet: set(2, 8, 60),
};

describe('workout player model', () => {
  const blocks = buildPlayer(STRUCTURE, { 11: LAST });

  it('builds blocks in order, drops empty ones and labels supersets A1/A2', () => {
    expect(blocks.map(b => b.title)).toEqual(['Bench', 'Finisher', 'Core']);
    expect(blocks[1].grouped).toBe(true);
    expect(blocks[1].exercises.map(e => e.label)).toEqual(['A1', 'A2']);
    expect(blocks[0].exercises[0].label).toBeNull();
    expect(blocks[1].exercises[0].sets).toHaveLength(2); // rounds
  });

  it('prefills from set targets, else the sets/reps fields', () => {
    const bench = blocks[0].exercises[0];
    expect(bench.sets.map(s => [s.setType, s.reps, s.weight])).toEqual([['warmup', '10', '40'], ['normal', '6', '62.5'], ['normal', '6', '62.5']]);
    expect(blocks[1].exercises[0].sets[0]).toMatchObject({ reps: '10', weight: '22' });
    expect(blocks[1].exercises[1].sets[0].reps).toBe('12');
    expect(blocks[2].exercises[0]).toMatchObject({ timed: true });
    expect(blocks[2].exercises[0].sets[0].reps).toBe('45');
    expect(prefillFromTarget(STRUCTURE.sections[1].exercises[1], null, false)).toEqual({ reps: '12', weight: '' });
  });

  it('lines last time up with the rows (warm-ups with warm-ups) and copies it', () => {
    const bench = blocks[0].exercises[0];
    expect(lastHint(bench.last)).toBe('Last: 60 kg × 8');
    expect(bench.sets[0].prev?.weightKg).toBe(40);
    expect(bench.sets[1].prev?.reps).toBe(8);
    expect(bench.sets[2].prev?.reps).toBe(7);
    expect(copyPrev(bench.sets[1], false)).toMatchObject({ reps: '8', weight: '60' });
    // An empty row takes last time's values when checked; no reps at all → can't check.
    expect(checkedSet({ ...bench.sets[1], reps: '', weight: '' }, false)).toMatchObject({ reps: '8', weight: '60', done: true });
    expect(checkedSet({ ...blocks[1].exercises[0].sets[0], reps: '' }, false)).toBeNull();
  });

  it('goes round-robin through a superset and rests at the end of a round', () => {
    expect(executionOrder(blocks[1])).toEqual([[0, 0], [1, 0], [0, 1], [1, 1]]);
    expect(nextOpenSet(blocks, { b: 1, e: 0, s: 0 })).toEqual({ b: 1, e: 1, s: 0 });
    expect(restAfter(blocks[1], 0, 0)).toBe(0);
    expect(restAfter(blocks[1], 1, 0)).toBe(90);
    expect(restAfter(blocks[0], 0, 0)).toBe(60);
    expect(restAfter(blocks[0], 0, 1)).toBe(120);
    expect(nextOpenSet(blocks, null)).toEqual({ b: 0, e: 0, s: 0 });
  });

  it('completes a block, adds/removes sets and builds the payload', () => {
    const done = completeBlock(blocks[0]);
    expect(done.exercises[0].sets.every(s => s.done)).toBe(true);
    const withExtra = addSet(blocks[0].exercises[0]);
    expect(withExtra.sets).toHaveLength(4);
    expect(withExtra.sets[3]).toMatchObject({ extra: true, reps: '6', weight: '62.5', done: false });
    expect(removeSet(withExtra, withExtra.sets[3].id).sets).toHaveLength(3);

    const all = [done, blocks[1], completeBlock(blocks[2])];
    const sets = buildCompleteSets(all);
    expect(sets).toHaveLength(5);
    expect(sets[0]).toMatchObject({ exerciseId: 11, workoutExerciseId: 1, setNo: 1, setType: 'warmup', reps: 10, weightKg: 40, completed: true });
    expect(sets[4]).toMatchObject({ exerciseId: 34, reps: null, durationSec: 45 });
    expect(summarize(all)).toEqual({ sets: 5, exercises: 2, volumeKg: 10 * 40 + 6 * 62.5 * 2 });
  });

  it('formats and steps numbers', () => {
    expect(stepValue('60', 2.5)).toBe('62.5');
    expect(stepValue('', -1)).toBe('0');
    expect(fmtClock(65)).toBe('1:05');
    expect(fmtClock(3725)).toBe('1:02:05');
    expect(estimateMinutes(STRUCTURE)).toBeGreaterThan(0);
  });
});

describe('rest timer reducer', () => {
  it('counts down from the wall clock, adds time and finishes', () => {
    let s = restReducer(REST_IDLE, { type: 'start', seconds: 60, now: 0 });
    expect(s).toMatchObject({ status: 'running', remaining: 60, total: 60 });
    s = restReducer(s, { type: 'tick', now: 20_500 });
    expect(s.remaining).toBe(40);
    s = restReducer(s, { type: 'add', seconds: 15, now: 20_500 });
    expect(s).toMatchObject({ remaining: 55, total: 75 });
    s = restReducer(s, { type: 'tick', now: 75_000 });
    expect(s).toMatchObject({ status: 'finished', remaining: 0 });
    expect(restReducer(s, { type: 'skip' })).toEqual(REST_IDLE);
    expect(restReducer(REST_IDLE, { type: 'start', seconds: 0, now: 0 })).toEqual(REST_IDLE);
    expect(restReducer(REST_IDLE, { type: 'tick', now: 5 })).toBe(REST_IDLE);
  });
});

const strip = (p: Partial<WeekStripDay>): WeekStripDay => ({
  date: '2026-11-02', weekday: 'Monday', isToday: false, inPlan: true, weekNumber: 2, dayNumber: 1, title: 'Push', isRestDay: false,
  workoutId: 601, done: false, skipped: false, moved: false, movedToDate: null, movedFromDate: null, status: 'scheduled', ...p,
});

const entry = (p: Partial<CalendarEntry>): CalendarEntry => ({
  date: '2026-11-06', weekNumber: 2, dayNumber: 5, dayId: 1, title: 'Upper', isRestDay: false, workoutId: 604, status: 'scheduled',
  isToday: false, movedToDate: null, movedFromDate: null, completedLogId: null, ...p,
});

describe('week strip and plan calendar', () => {
  it('maps strip days to chips', () => {
    expect(stripChip(strip({}))).toMatchObject({ weekday: 'Mon', title: 'Push', state: 'planned', canOpen: true, dayOfMonth: 2 });
    expect(stripChip(strip({ done: true, status: 'done' }))).toMatchObject({ state: 'done', canOpen: true });
    expect(stripChip(strip({ skipped: true, status: 'skipped' })).state).toBe('skipped');
    expect(stripChip(strip({ isRestDay: true, workoutId: null, status: 'rest', title: null }))).toMatchObject({ state: 'rest', title: 'Rest', canOpen: false });
    expect(stripChip(strip({ moved: true, status: 'moved', movedToDate: '2026-11-04' }))).toMatchObject({ state: 'moved', canOpen: false });
    expect(stripChip(strip({ inPlan: false, status: 'none' }))).toMatchObject({ state: 'off', canOpen: false });
    expect(stripChip(strip({ isToday: true })).a11y).toContain('today');
  });

  it('works out plan weeks and day rows', () => {
    expect(planWeekRange('2026-10-27', 2)).toEqual({ from: '2026-11-03', to: '2026-11-09' });
    expect(planWeekOf('2026-10-27', '2026-11-06', 8)).toBe(2);
    expect(planWeekOf('2026-10-27', '2027-06-01', 8)).toBe(8);
    const rows = dayRows([entry({ date: '2026-11-04' }), entry({ date: '2026-11-04', movedFromDate: '2026-11-03' })], '2026-11-03', '2026-11-05', '2026-11-04');
    expect(rows).toHaveLength(3);
    expect(rows[1].entries.map(e => e.movedFromDate)).toEqual([null, '2026-11-03']);
    expect(rows[1].isToday).toBe(true);
    expect(rows[0].isPast).toBe(true);
  });

  it('only allows changing today or later, never rest or done days', () => {
    const t = '2026-11-06';
    expect(dayActions(entry({}), t)).toEqual(['open', 'skip', 'move']);
    expect(dayActions(entry({ date: '2026-11-05', status: 'missed' }), t)).toEqual(['open']);
    expect(dayActions(entry({ status: 'done' }), t)).toEqual(['open']);
    expect(dayActions(entry({ isRestDay: true, workoutId: null, status: 'rest' }), t)).toEqual([]);
    expect(dayActions(entry({ status: 'skipped' }), t)).toEqual(['open', 'undo']);
    const movedIn = entry({ date: '2026-11-08', movedFromDate: '2026-11-06' });
    expect(dayActions(movedIn, t)).toContain('undo');
    expect(undoDateOf(movedIn)).toBe('2026-11-06');
    const targets = moveTargets(t, '2026-10-27', '2026-11-08', t);
    expect(targets[0]).toBe('2026-11-07');
    expect(targets.at(-1)).toBe('2026-11-15');
    expect(targets).not.toContain(t);
  });

  it('groups history by week with totals', () => {
    const item = (logId: number, startedAt: string, volumeKg: number) => ({
      logId, workoutId: 1, workoutName: 'W', startedAt, endedAt: null, durationMin: 50, sessionRpe: null, sets: 10, exercises: 3,
      volumeKg, recordCount: 0, planAssignmentId: null, weekNumber: null, dayNumber: null, notes: null,
    });
    const weeks = groupHistoryByWeek([item(1, '2026-11-03T10:00:00', 1000), item(2, '2026-11-05T10:00:00', 500), item(3, '2026-10-28T10:00:00', 800)], '2026-11-06');
    expect(weeks.map(w => w.label)).toEqual(['This week', 'Last week']);
    expect(weeks[0]).toMatchObject({ volumeKg: 1500, minutes: 100 });
    expect(weeks[0].items.map(i => i.logId)).toEqual([2, 1]);
  });
});

describe('member training routes', () => {
  it('parses and prints the new routes', () => {
    expect(memberRouteFromPath(['plan-week', '9001'])).toEqual({ id: 'plan-week', assignmentId: 9001 });
    expect(memberRouteFromPath(['plan-week', '9001', '3'])).toEqual({ id: 'plan-week', assignmentId: 9001, week: 3 });
    expect(memberRouteFromPath(['plan-week'])).toBeNull();
    expect(memberRouteFromPath(['history'])).toEqual({ id: 'history' });
    expect(memberRouteFromPath(['history', '42'])).toEqual({ id: 'history-log', logId: 42 });
    expect(memberRouteFromPath(['records'])).toEqual({ id: 'records' });
    expect(memberRouteToPath({ id: 'history-log', logId: 42 })).toEqual(['history', '42']);
    expect(memberRouteToPath({ id: 'plan-week', assignmentId: 9001, week: 2 })).toEqual(['plan-week', '9001', '2']);
    expect(memberModuleOf({ id: 'records' })).toBe('progress');
    expect(memberModuleOf({ id: 'plan-week', assignmentId: 1 })).toBe('train');
  });

  it('keeps workout/{id} and carries the plan / assignment context', () => {
    expect(memberRouteFromPath(['workout', '7'])).toEqual({ id: 'workout', workoutId: 7 });
    const plan = memberRouteFromPath(['workout', '601', 'plan', '9001', '2', '1', '2026-11-06']);
    expect(plan).toEqual({ id: 'workout', workoutId: 601, ctx: { kind: 'plan', planAssignmentId: 9001, week: 2, day: 1, date: '2026-11-06' } });
    expect(memberRouteToPath(plan!)).toEqual(['workout', '601', 'plan', '9001', '2', '1', '2026-11-06']);
    expect(memberRouteFromPath(['workout', '3', 'assignment', '7301'])).toEqual({ id: 'workout', workoutId: 3, ctx: { kind: 'assignment', assignmentId: 7301 } });
    expect(memberRouteFromPath(['workout', '3', 'plan', '9001', '2', '9'])).toEqual({ id: 'workout', workoutId: 3 });
    expect(memberRouteFromPath(['plans', '5'])).toEqual({ id: 'plans', planId: 5 });
  });
});
