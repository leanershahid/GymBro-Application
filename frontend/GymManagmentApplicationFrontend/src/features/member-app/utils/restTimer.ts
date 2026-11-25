/**
 * Rest timer as a pure reducer (unit-tested). Time comes in with each action (`now`, ms), so the
 * countdown follows the wall clock even when ticks are late (backgrounded tab, slow phone).
 */
export interface RestState {
  status: 'idle' | 'running' | 'finished';
  /** Seconds the rest was set to (grows with +15 s) */
  total: number;
  /** Epoch ms when the rest ends */
  endsAt: number;
  /** Whole seconds left */
  remaining: number;
  /** What it was started for, e.g. "Bench press · set 2" */
  label: string | null;
}

export type RestAction =
  | { type: 'start'; seconds: number; now: number; label?: string | null }
  | { type: 'tick'; now: number }
  | { type: 'add'; seconds: number; now: number }
  | { type: 'skip' }
  | { type: 'dismiss' };

export const REST_IDLE: RestState = { status: 'idle', total: 0, endsAt: 0, remaining: 0, label: null };

const left = (endsAt: number, now: number) => Math.max(0, Math.ceil((endsAt - now) / 1000));

export function restReducer(state: RestState, action: RestAction): RestState {
  switch (action.type) {
    case 'start': {
      const seconds = Math.min(3600, Math.round(action.seconds));
      if (!(seconds > 0)) return REST_IDLE;
      return { status: 'running', total: seconds, endsAt: action.now + seconds * 1000, remaining: seconds, label: action.label ?? null };
    }
    case 'tick': {
      if (state.status !== 'running') return state;
      const remaining = left(state.endsAt, action.now);
      if (remaining === state.remaining && remaining > 0) return state;
      return remaining === 0 ? { ...state, remaining: 0, status: 'finished' } : { ...state, remaining };
    }
    case 'add': {
      if (state.status === 'idle') return state;
      const base = state.status === 'finished' ? action.now : state.endsAt;
      const endsAt = base + action.seconds * 1000;
      const remaining = left(endsAt, action.now);
      if (remaining === 0) return { ...state, endsAt, remaining: 0, status: 'finished' };
      return { ...state, status: 'running', endsAt, remaining, total: Math.max(remaining, state.total + action.seconds) };
    }
    case 'skip':
    case 'dismiss':
      return REST_IDLE;
    default:
      return state;
  }
}

/** 0…1 of the rest already done (for the progress bar). */
export const restProgress = (s: RestState) => (s.total > 0 ? 1 - s.remaining / s.total : 0);
