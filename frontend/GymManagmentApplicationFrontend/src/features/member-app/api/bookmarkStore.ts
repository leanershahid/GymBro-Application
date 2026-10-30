import { useSyncExternalStore } from 'react';

/**
 * Client-side bookmark state. The API only toggles (POST /workouts/{id}/bookmark → data: null)
 * and has no "is bookmarked" field or list endpoint, so we remember toggles made in this
 * session. Unknown workouts are shown as not saved.
 */
const saved = new Map<number, boolean>();
const listeners = new Set<() => void>();

export function isBookmarked(id: number): boolean {
  return saved.get(id) ?? false;
}

export function setBookmarked(id: number, value: boolean) {
  saved.set(id, value);
  listeners.forEach(l => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function useIsBookmarked(id: number): boolean {
  return useSyncExternalStore(subscribe, () => isBookmarked(id), () => isBookmarked(id));
}

/** Reads the new state from a toggle response if the API ever returns one (boolean or { bookmarked }). */
export function bookmarkStateFrom(data: unknown): boolean | null {
  if (typeof data === 'boolean') return data;
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    for (const k of ['bookmarked', 'isBookmarked', 'saved']) if (typeof d[k] === 'boolean') return d[k] as boolean;
  }
  return null;
}
