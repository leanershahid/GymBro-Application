import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * A function whose identity never changes but always calls the latest `fn` (ARCH-134).
 * Use it for callbacks passed to memoised FlatList rows so a parent re-render doesn't re-render
 * every row. Do not call the result during render.
 */
export function useStableCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const ref = useRef(fn);
  useLayoutEffect(() => { ref.current = fn; });
  return useCallback((...args: A) => ref.current(...args), []);
}
