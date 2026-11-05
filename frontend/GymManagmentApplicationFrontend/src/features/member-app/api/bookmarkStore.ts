import { useSyncExternalStore } from 'react';
import { onSessionChange } from '../../../api/session';

/**
 * Client-side bookmark state. The API only toggles (POST /workouts/{id}/bookmark → data: null)
 * and has no "is bookmarked" field or list endpoint, so we remember toggles made in this
 * session. Unknown workouts are shown as not saved. Cleared when the user changes.
 */
const saved = new Map<number, boolean>();
const listeners = new Set<() => void>();

/** Forgets every remembered toggle (and re-renders readers). */
export function clearBookmarks() {
  if (!saved.size) return;
  saved.clear();
  listeners.forEach(l => l());
}

// Bookmarks belong to the signed-in user: drop them on sign-out or when another account signs
// in, so the next person on a shared device never sees them (ARCH-126). A token refresh for
// the same user keeps them.
onSessionChange((next, prev) => {
  if (!next || next.userId !== prev?.userId) clearBookmarks();
});

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
