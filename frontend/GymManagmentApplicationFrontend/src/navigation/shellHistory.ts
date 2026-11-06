import { Place, placeToUrl, samePlace } from './paths';

/** The browser's history, as the shell history uses it (absent on phones). */
export interface HistoryAdapter {
  /** Index stored in the current browser entry (0 when it has none). */
  index(): number;
  push(url: string, index: number): void;
  replace(url: string, index: number): void;
  back(): void;
}

export interface ShellHistoryHandlers {
  /** Show this place (the shell sends the area an open request). */
  show: (p: Place) => void;
  /** Whether a hosted area will report where it is after `show` (false for More / no access). */
  expectsReport: (p: Place) => boolean;
}

/** After the first report following an open, later reports this soon still refine that entry. */
const GRACE_MS = 300;
/** Phones keep this many entries (the browser keeps its own). */
const NATIVE_MAX = 50;

export type ShellHistory = ReturnType<typeof createShellHistory>;

/**
 * The places visited, one entry per screen (ARCH-057/058/113). Areas keep their own screen state
 * and report every change; this turns the reports into history entries — browser history entries
 * (and the URL) on web, a list walked by the Android back button on phones.
 *
 * - a report right after an open replaces that entry (the area canonicalised the path);
 * - a report of the previous entry is an in-app Back, so it steps back instead of pushing;
 * - `replace` reports (checkout → confirmation, new product → saved) replace the entry.
 */
export function createShellHistory(
  initial: Place,
  handlers: ShellHistoryHandlers,
  web: HistoryAdapter | null,
  now: () => number = Date.now,
) {
  const entries: (Place | undefined)[] = [];
  let idx = web ? web.index() : 0;
  entries[idx] = initial;
  // null: not waiting; 0: until the area's first report; > 0: end of the grace window.
  let awaiting: number | null = handlers.expectsReport(initial) ? 0 : null;

  const cur = () => entries[idx] as Place;
  const write = (kind: 'push' | 'replace') => web?.[kind](placeToUrl(cur()), idx);
  const expect = (p: Place) => { awaiting = handlers.expectsReport(p) ? 0 : null; };

  const pushEntry = (p: Place) => {
    entries.length = idx + 1;
    entries.push(p);
    idx += 1;
    if (!web && entries.length > NATIVE_MAX) { entries.shift(); idx -= 1; }
    write('push');
  };

  const showAt = (i: number) => {
    idx = i;
    expect(cur());
    handlers.show(cur());
  };

  return {
    /** Writes the current entry's URL (on mount). */
    start() { write('replace'); },
    current: cur,

    /** Shell-initiated navigation: a tab, a More row, Profile. */
    go(p: Place) {
      if (!samePlace(p, cur())) pushEntry(p);
      expect(p);
      handlers.show(p);
    },

    /** A hosted area says where it is. */
    report(p: Place, replace = false) {
      if (awaiting !== null && (awaiting === 0 || now() <= awaiting)) {
        awaiting = now() + GRACE_MS;
        replace = true;
      } else {
        awaiting = null;
      }
      if (samePlace(cur(), p)) return;
      if (replace) { entries[idx] = p; write('replace'); return; }
      const prev = entries[idx - 1];
      if (prev && samePlace(prev, p)) {          // an in-app Back
        idx -= 1;
        web?.back();                             // its popstate is recognised as ours in `popped`
        return;
      }
      pushEntry(p);
    },

    /** Android back button. False on the first entry, so the OS leaves the app. */
    back(): boolean {
      if (!entries[idx - 1]) return false;
      showAt(idx - 1);
      return true;
    },

    /** Browser Back/Forward reached entry `i`, whose URL names `p` (null: not one of ours). */
    popped(i: number, p: Place | null) {
      if (!p) return;
      if (i === idx && samePlace(cur(), p)) return;   // the step our own in-app Back made
      entries[i] = p;                                  // entries from before a reload are unknown
      showAt(i);
    },
  };
}
