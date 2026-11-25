import { describe, expect, it } from '@jest/globals';
import {
  addSetRow, blankRow, dayCopyTargets, exerciseToDraft, groupIntoSuperset, laterWeeks, moveExerciseToBlock, moveItem,
  newBlock, newExercise, nextSetType, parseReps, removeSetRow, repsText, toStructure, trainingDaysPerWeek, validateBlocks,
  weekCopyOptions, dayTitle, goalIndex, humanizeEnum,
} from '../builder/builderUtils';
import { withDay } from '../api/trainingQueries';
import { codedBody, workoutInUseFrom } from '../api/trainingApi';
import { adminFromPath, adminPath, ownerOf } from '../../dashboard/admin/adminRoutes';
import { trainerModuleOf, trainerRouteFromPath, trainerRouteToPath } from '../../trainer-app/trainerRoutes';
import type { BuilderDay, PlanBuilder } from '../api/training.types';

const day = (w: number, d: number, patch: Partial<BuilderDay> = {}): BuilderDay => ({
  dayId: null, weekNumber: w, dayNumber: d, title: null, notes: null, isRestDay: false, workoutId: null, workoutName: null,
  ownsWorkout: false, sectionCount: 0, exerciseCount: 0, exerciseNames: [], hasSuperset: false, estimatedMinutes: null, ...patch,
});

describe('set table rows', () => {
  it('"+ Set" copies the previous row with a new key', () => {
    const first = { ...blankRow(), reps: '8-12', kg: '60', rpe: '8', rest: '90' };
    const rows = addSetRow([first]);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ reps: '8-12', kg: '60', rpe: '8', rest: '90', type: 'normal' });
    expect(rows[1].key).not.toBe(first.key);
  });

  it('a warm-up row is copied as a working set; empty tables get a default row', () => {
    expect(addSetRow([{ ...blankRow(), type: 'warmup' }])[1].type).toBe('normal');
    expect(addSetRow([])).toHaveLength(1);
  });

  it('never goes past 20 sets or below one', () => {
    let rows = [blankRow()];
    for (let i = 0; i < 30; i++) rows = addSetRow(rows);
    expect(rows).toHaveLength(20);
    const one = [blankRow()];
    expect(removeSetRow(one, one[0].key)).toBe(one);
    expect(removeSetRow(rows, rows[3].key)).toHaveLength(19);
  });

  it('cycles set types and parses reps', () => {
    expect(nextSetType('normal')).toBe('warmup');
    expect(nextSetType('failure')).toBe('normal');
    expect(parseReps('8-12')).toEqual({ min: 8, max: 12 });
    expect(parseReps(' 10 ')).toEqual({ min: 10, max: 10 });
    expect(parseReps('')).toEqual({ min: null, max: null });
    expect(parseReps('AMRAP')).toBeNull();
    expect(repsText(8, 12)).toBe('8-12');
    expect(repsText(5, 5)).toBe('5');
  });
});

describe('day editor draft', () => {
  it('builds rows from old sets/reps when there are no set targets, keeping free-text reps', () => {
    const d = exerciseToDraft({ exerciseId: 1, exerciseName: 'Squat', sets: 3, reps: 'AMRAP', durationSeconds: null, restSeconds: 60 });
    expect(d.rows).toHaveLength(3);
    expect(d.legacyReps).toBe('AMRAP');
    const s = toStructure([newBlock('Main', [d])], 9, 'Legs');
    expect(s.sections[0].exercises[0]).toMatchObject({ sets: 3, reps: 'AMRAP', restSeconds: 60 });
  });

  it('sends per-set targets', () => {
    const e = newExercise(2, 'Bench');
    e.rows[0] = { ...e.rows[0], reps: '6-8', kg: '62.5', rpe: '8' };
    const s = toStructure([newBlock('Main', [e])], 1, null);
    const ex = s.sections[0].exercises[0];
    expect(ex.sets).toBe(3);
    expect(ex.reps).toBe('6-8');
    expect(ex.setTargets?.[0]).toMatchObject({ setNo: 1, repsMin: 6, repsMax: 8, weightKg: 62.5, rpe: 8, durationSec: null });
  });

  it('validates the server ranges', () => {
    const e = newExercise(2, 'Bench');
    e.rows[0] = { ...e.rows[0], reps: '12-8', rpe: '11' };
    const problems = validateBlocks([newBlock('Main', [e])]);
    expect(problems.some(p => p.includes('lower reps'))).toBe(true);
    expect(problems.some(p => p.includes('RPE'))).toBe(true);
    expect(validateBlocks([newBlock('Main', [newExercise(1, 'Squat')])])).toEqual([]);
  });

  it('groups selected exercises into a superset where the first one was', () => {
    const a = newExercise(1, 'A'); const b = newExercise(2, 'B'); const c = newExercise(3, 'C');
    const blocks = [newBlock('Main', [a]), newBlock('Main', [b, c])];
    const out = groupIntoSuperset(blocks, new Set([a.key, c.key]));
    expect(out).toHaveLength(2);
    expect(out[0].type).toBe('Superset');
    expect(out[0].exercises.map(e => e.name)).toEqual(['A', 'C']);
    expect(out[1].exercises.map(e => e.name)).toEqual(['B']);
    expect(groupIntoSuperset(blocks, new Set([a.key]))).toBe(blocks);
  });

  it('moves an exercise to another block and drops the emptied block', () => {
    const a = newExercise(1, 'A'); const b = newExercise(2, 'B');
    const blocks = [newBlock('Main', [a]), newBlock('Superset', [b])];
    const out = moveExerciseToBlock(blocks, a.key, blocks[1].key);
    expect(out).toHaveLength(1);
    expect(out[0].exercises.map(e => e.name)).toEqual(['B', 'A']);
    expect(moveExerciseToBlock(blocks, b.key, 'new').map(x => x.exercises.length)).toEqual([1, 1]);
    expect(moveItem([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
  });
});

describe('copy targets', () => {
  it('turns selected day keys into sorted targets without the source', () => {
    expect(dayCopyTargets(['2-3', '1-5', 'x', '1-1', '1-5', '3-8'], { week: 1, day: 1 })).toEqual([{ week: 1, day: 5 }, { week: 2, day: 3 }]);
  });

  it('offers the other weeks plus new ones up to 52', () => {
    expect(weekCopyOptions(3, 2, 1)).toEqual([{ week: 1, isNew: false }, { week: 3, isNew: false }, { week: 4, isNew: true }]);
    expect(weekCopyOptions(52, 1, 4).filter(o => o.isNew)).toEqual([]);
    expect(laterWeeks(4, 1)).toEqual([2, 3, 4]);
    expect(laterWeeks(4, 4)).toEqual([]);
  });
});

describe('builder data', () => {
  const plan = (): PlanBuilder => ({
    planId: 1, name: 'P', description: null, goal: 'General', difficulty: 'Beginner', durationWeeks: 1, daysPerWeekHint: 3, isTemplate: true,
    isActive: true, sourcePlanId: null, ownerClientId: null, ownerClientName: null, createdBy: 1, canEdit: true, clientAssignment: null,
    weeks: [{ weekNumber: 1, notes: null, days: [1, 2, 3, 4, 5, 6, 7].map(d => day(1, d)) }],
  });

  it('patches one day and counts training days', () => {
    const b = withDay(plan(), day(1, 2, { dayId: 5, exerciseCount: 4, title: 'Push' }));
    expect(b.weeks[0].days[1]).toMatchObject({ dayId: 5, title: 'Push' });
    expect(trainingDaysPerWeek(b)).toBe(1);
    expect(trainingDaysPerWeek(plan())).toBe(3);
    expect(dayTitle(day(1, 4))).toBe('Day 4');
  });

  it('maps enums', () => {
    expect(goalIndex('MuscleGain')).toBe(1);
    expect(goalIndex(null)).toBe(4);
    expect(humanizeEnum('WeightLoss')).toBe('Weight loss');
  });

  it('reads coded conflicts from a 200 envelope', () => {
    const body = { success: false, message: 'x', data: { planDays: 2, assignments: 0, logs: 1 }, errors: null, code: 'WORKOUT_IN_USE' };
    expect(workoutInUseFrom(body)).toEqual({ planDays: 2, assignments: 0, logs: 1 });
    expect(codedBody({ success: true }, 'WORKOUT_IN_USE')).toBeNull();
  });
});

describe('plan builder routes', () => {
  it('admin: plans, a plan, a member copy and the workout editor', () => {
    expect(adminFromPath(['plan-builder', '4'])).toEqual({ screen: 'plan-builder', id: 4, sub: [] });
    expect(adminFromPath(['plan-builder'])).toBeNull();
    expect(adminFromPath(['plan-client', '901'])).toEqual({ screen: 'plan-client', id: 901, sub: [] });
    expect(adminFromPath(['workout-editor', '7'])).toEqual({ screen: 'workout-editor', id: 7, sub: [] });
    expect(adminPath({ screen: 'plan-client', id: 901, sub: [] })).toEqual(['plan-client', '901']);
    expect(ownerOf('plan-builder')).toBe('plans');
    expect(ownerOf('plan-client')).toBe('plans');
    expect(ownerOf('workout-editor')).toBe('workouts');
  });

  it('trainer: plan-builder and client-plan', () => {
    expect(trainerRouteFromPath(['plan-builder', '3'])).toEqual({ id: 'plan-builder', planId: 3 });
    expect(trainerRouteFromPath(['client-plan', '12'])).toEqual({ id: 'client-plan', assignmentId: 12 });
    expect(trainerRouteFromPath(['client-plan'])).toBeNull();
    expect(trainerRouteToPath({ id: 'plan-builder', planId: 3 })).toEqual(['plan-builder', '3']);
    expect(trainerRouteToPath({ id: 'client-plan', assignmentId: 12 })).toEqual(['client-plan', '12']);
    expect(trainerModuleOf({ id: 'plan-builder', planId: 3 })).toBe('builder');
    expect(trainerModuleOf({ id: 'client-plan', assignmentId: 12 })).toBe('clients');
  });
});
