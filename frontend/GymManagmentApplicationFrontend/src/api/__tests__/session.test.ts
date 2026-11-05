import { afterEach, describe, expect, it } from '@jest/globals';
import { getSession, onSessionChange, setSession } from '../session';
import { isBookmarked, setBookmarked } from '../../features/member-app/api/bookmarkStore';

const user = (userId: number) => ({ userId, role: 'client', tenantId: 1, branchId: null });

afterEach(() => setSession(null));

describe('session', () => {
  it('notifies listeners with next and previous session', () => {
    const calls: [number | undefined, number | undefined][] = [];
    const off = onSessionChange((next, prev) => calls.push([next?.userId, prev?.userId]));
    const a = user(1);
    setSession(a);
    setSession(a); // same object: no notification
    setSession(null);
    off();
    setSession(user(2));
    expect(calls).toEqual([[1, undefined], [undefined, 1]]);
    expect(getSession()?.userId).toBe(2);
  });
});

describe('bookmarkStore', () => {
  it('keeps bookmarks across a token refresh for the same user', () => {
    setSession(user(7));
    setBookmarked(42, true);
    setSession(user(7));
    expect(isBookmarked(42)).toBe(true);
  });

  it('forgets bookmarks on sign-out and on a different user', () => {
    setSession(user(7));
    setBookmarked(42, true);
    setSession(null);
    expect(isBookmarked(42)).toBe(false);

    setSession(user(7));
    setBookmarked(43, true);
    setSession(user(8));
    expect(isBookmarked(43)).toBe(false);
  });
});
