import { useEffect, useState } from 'react';
import type { AreaLocation, OpenRequest } from '../features/access/types/access.types';
import { pathKey } from './paths';

/**
 * Applies each new open request while rendering (React's "adjust state when a prop changes"
 * pattern), so the area's new screen and its report land in the same commit as the request.
 */
export function useOpenRequest(open: OpenRequest | undefined, apply: (path: string[]) => void) {
  const [seen, setSeen] = useState(open);
  if (open !== seen) {
    setSeen(open);
    if (open) apply(open.path);
  }
}

/** Reports the area's location to the shell whenever it changes, and after every open request. */
export function useReportLocation(loc: AreaLocation, open: OpenRequest | undefined, onRouteChange?: (loc: AreaLocation) => void) {
  const key = `${loc.module}|${pathKey(loc.path)}`;
  // `loc` is described by `key`; `open` re-reports so the shell knows the request was handled.
  useEffect(() => { onRouteChange?.(loc); }, [key, open]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** How a nested stack (inside a shop) tells its area where it is. */
export type PathChange = (path: string[], replace?: boolean) => void;

/**
 * Reports a nested stack's path whenever it changes. `takeReplace` says (once) whether the change
 * replaced the top screen rather than pushing one.
 */
export function useReportPath(path: string[], onPathChange?: PathChange, takeReplace?: () => boolean) {
  const key = pathKey(path);
  useEffect(() => { onPathChange?.(path, takeReplace?.() ?? false); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}
