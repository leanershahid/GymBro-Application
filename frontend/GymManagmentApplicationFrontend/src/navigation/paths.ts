import type { AccessApp } from '../features/access/types/access.types';

/**
 * Places and their web URLs (ARCH-058). A place is an area (admin / trainer / member, or the
 * shell's More screen) plus the route path inside it, e.g. member + ['workout', '12'] ⇄
 * `/member/workout/12`. Each area owns the meaning of its path (see its *Routes.ts file).
 */
export const MORE = 'more' as const;
export type ShellArea = AccessApp | typeof MORE;

export interface Place {
  area: ShellArea;
  /** Route segments inside the area; [] = the area's landing screen. */
  path: string[];
}

const AREAS: readonly string[] = ['admin', 'trainer', 'member'];

export const pathKey = (path: readonly string[]) => path.join('/');

export const samePlace = (a: Place, b: Place) => a.area === b.area && pathKey(a.path) === pathKey(b.path);

export function placeToUrl(p: Place): string {
  return '/' + [p.area, ...p.path].map(encodeURIComponent).join('/');
}

const decode = (s: string) => {
  try { return decodeURIComponent(s); } catch { return s; }
};

/** The place a URL path names, or null when it names none (e.g. "/"). */
export function placeFromUrl(pathname: string): Place | null {
  const [area, ...path] = pathname.split('/').filter(Boolean).map(decode);
  if (area === MORE) return { area: MORE, path: [] };
  if (area && AREAS.includes(area)) return { area: area as AccessApp, path };
  return null;
}

/** A positive integer id segment, or null. */
export function idSegment(s: string | undefined): number | null {
  if (!s || !/^\d{1,15}$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}

/**
 * A pushed-screen stack moved to show `target` on top: screens above an existing copy of it are
 * closed (Back), otherwise it is pushed (Forward / deep link); no target closes them all.
 */
export function syncStack<E>(stack: E[], target: E | null, key: (e: E) => string): E[] {
  if (!target) return stack.length ? [] : stack;
  const k = key(target);
  const i = stack.findIndex(e => key(e) === k);
  if (i === stack.length - 1) return stack;
  return i >= 0 ? stack.slice(0, i + 1) : [...stack, target];
}
