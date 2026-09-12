// Shared color lookup for difficulty/goal-style status labels used across
// exercises, workouts, plans, and member-app training screens.
export const DIFFICULTY_COLOR: Record<string, string> = {
  beginner: '#22C55E',
  intermediate: '#FACC15',
  advanced: '#EF4444',
  elite: '#EF4444',
};

export const DEFAULT_STATUS_COLOR = '#AAAAAA';

export function getDifficultyColor(difficulty: string | null | undefined): string {
  if (!difficulty) return DEFAULT_STATUS_COLOR;
  return DIFFICULTY_COLOR[difficulty.toLowerCase()] ?? DEFAULT_STATUS_COLOR;
}
