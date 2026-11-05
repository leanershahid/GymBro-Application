import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Key/value storage with one web/native split, instead of each store branching on Platform.OS
 * (ARCH-124). All methods are async and may throw; callers decide what a failure means.
 *
 *  - `sessionStore` — for session-bound data (the refresh token, the cached access list).
 *    Phones: SecureStore (Keychain / Keystore, encrypted, survives restarts).
 *    Web: **sessionStorage** — survives reloads of the tab but not closing it, and is never shared
 *    with other tabs. This is a deliberate trade-off (ARCH-008): a refresh token in localStorage
 *    lived for weeks and could be read by any script on the origin at any time; sessionStorage
 *    narrows that window to the open tab. The proper fix is an HttpOnly refresh cookie set by the
 *    API; until then, web users sign in again per tab / browser session.
 *  - `prefsStore` — small, non-secret per-device preferences (recent searches…).
 *    Phones: SecureStore (the only key/value store installed). Web: localStorage.
 *
 * SecureStore values should stay under ~2 KB; chunk larger values (see accessStore.ts).
 */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const secureNative: KeyValueStore = {
  getItem: key => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: key => SecureStore.deleteItemAsync(key),
};

function webStore(pick: () => Storage | undefined): KeyValueStore {
  const store = () => {
    const s = typeof window === 'undefined' ? undefined : pick();
    if (!s) throw new Error('Web storage unavailable.');
    return s;
  };
  return {
    getItem: async key => store().getItem(key),
    setItem: async (key, value) => { store().setItem(key, value); },
    removeItem: async key => { store().removeItem(key); },
  };
}

const isWeb = Platform.OS === 'web';

export const sessionStore: KeyValueStore = isWeb ? webStore(() => window.sessionStorage) : secureNative;
export const prefsStore: KeyValueStore = isWeb ? webStore(() => window.localStorage) : secureNative;

/** Removes a key that older builds kept in web localStorage (no-op on phones). */
export function forgetLegacyWebKey(key: string) {
  if (!isWeb || typeof window === 'undefined') return;
  try { window.localStorage.removeItem(key); } catch { /* storage blocked */ }
}
