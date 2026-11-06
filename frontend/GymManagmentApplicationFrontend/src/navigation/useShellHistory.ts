import { useEffect, useState } from 'react';
import { BackHandler, Platform } from 'react-native';
import { Place, placeFromUrl } from './paths';
import { createShellHistory, HistoryAdapter, ShellHistory, ShellHistoryHandlers } from './shellHistory';

const WEB = Platform.OS === 'web' && typeof window !== 'undefined' && !!window.history;

const stateIndex = (state: unknown): number => {
  const gb = (state as { gb?: unknown } | null)?.gb;
  return typeof gb === 'number' ? gb : 0;
};

// The query string (e.g. `?preview=member` in dev) is kept on every URL.
const browser: HistoryAdapter = {
  index: () => stateIndex(window.history.state),
  push: (url, i) => window.history.pushState({ gb: i }, '', url + window.location.search),
  replace: (url, i) => window.history.replaceState({ gb: i }, '', url + window.location.search),
  back: () => window.history.back(),
};

/** The place the page URL names (web), else `fallback` — what the shell opens first. */
export function initialPlace(fallback: Place): Place {
  return (WEB && placeFromUrl(window.location.pathname)) || fallback;
}

/**
 * The shell's navigation history: URL + browser Back/Forward on web, the hardware back button on
 * phones. On sign-out (unmount) the URL goes back to "/".
 */
export function useShellHistory(initial: Place, handlers: ShellHistoryHandlers): ShellHistory {
  // The history lives for the shell's lifetime; it calls whichever handlers the last render gave.
  const [history] = useState(() => {
    const latest = { handlers };
    const h = createShellHistory(initial, {
      show: p => latest.handlers.show(p),
      expectsReport: p => latest.handlers.expectsReport(p),
    }, WEB ? browser : null);
    return Object.assign(h, { setHandlers: (next: ShellHistoryHandlers) => { latest.handlers = next; } });
  });
  useEffect(() => { history.setHandlers(handlers); });

  useEffect(() => {
    history.start();
    if (WEB) {
      const onPop = (e: PopStateEvent) => history.popped(stateIndex(e.state), placeFromUrl(window.location.pathname));
      window.addEventListener('popstate', onPop);
      return () => {
        window.removeEventListener('popstate', onPop);
        window.history.replaceState(null, '', '/' + window.location.search);
      };
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => history.back());
    return () => sub.remove();
  }, [history]);

  return history;
}
