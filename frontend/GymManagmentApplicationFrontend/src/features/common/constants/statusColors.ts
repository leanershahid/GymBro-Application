import { T } from '../../../theme';
import type { PillTone } from '../components/StatusPill';

// Shared color lookup for difficulty/goal-style status labels used across
// exercises, workouts, plans, and member-app training screens.
export const DIFFICULTY_COLOR: Record<string, string> = {
  beginner: T.ok,
  intermediate: T.brandGold,
  advanced: T.err,
  elite: T.err,
};

export const DEFAULT_STATUS_COLOR = T.textSub;

export function getDifficultyColor(difficulty: string | null | undefined): string {
  if (!difficulty) return DEFAULT_STATUS_COLOR;
  return DIFFICULTY_COLOR[difficulty.toLowerCase()] ?? DEFAULT_STATUS_COLOR;
}

/** Difficulty → StatusPill tone (beginner = ok, intermediate = warn, advanced/elite = err). */
export function difficultyTone(difficulty: string | null | undefined): PillTone {
  switch ((difficulty ?? '').toLowerCase()) {
    case 'beginner': return 'ok';
    case 'intermediate': return 'warn';
    case 'advanced': case 'elite': return 'err';
    default: return 'neutral';
  }
}

/** Training goal → StatusPill tone (weight loss = info, muscle gain = brand, endurance = warn). */
export function goalTone(goal: string | null | undefined): PillTone {
  switch ((goal ?? '').toLowerCase().replace(/[\s_-]/g, '')) {
    case 'weightloss': return 'info';
    case 'musclegain': return 'brand';
    case 'endurance': return 'warn';
    default: return 'neutral';
  }
}
