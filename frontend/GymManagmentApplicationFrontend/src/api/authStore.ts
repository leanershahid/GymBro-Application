import { Platform } from 'react-native';
import { setAuthToken } from './axios';
import { setSession, Session } from './session';
import { forgetLegacyWebKey, sessionStore } from '../utils/storage';

// Keeps the user signed in across app restarts / page reloads. Only the refresh token is
// persisted; the short-lived access token stays in memory and is re-issued from it on
// start-up (see restoreSession in App.tsx).
//  - Phones: SecureStore (encrypted) — sign-in survives app restarts.
//  - Web: sessionStorage (ARCH-008) — survives reloads of the tab, not closing it or opening a
//    new tab. Trade-off documented in utils/storage.ts; the long-term fix is an HttpOnly cookie.

const KEY = 'gymbro.auth';

interface Stored {
  refreshToken: string;
  session: Session;
}

export interface AuthPayload {
  accessToken: string;
  refreshToken: string;
  role: string;
  userId: number;
  tenantId: number;
  branchId: number | null;
}

async function write(value: string | null) {
  try {
    if (value === null) await sessionStore.removeItem(KEY);
    else await sessionStore.setItem(KEY, value);
  } catch {
    // Storage unavailable (private mode, etc.) — the session just won't survive a restart.
  }
}

/** Older web builds kept the refresh token in localStorage: move it once, then delete it there. */
function takeLegacyWebAuth(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw !== null) window.localStorage.removeItem(KEY);
    return raw;
  } catch {
    return null;
  }
}

export async function loadStoredAuth(): Promise<Stored | null> {
  try {
    const raw = (await sessionStore.getItem(KEY)) ?? takeLegacyWebAuth();
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

let refreshToken: string | null = null;
export const currentRefreshToken = () => refreshToken;

/** Makes a sign-in/refresh result the active session and persists it. */
export async function applyAuth(data: AuthPayload) {
  const session: Session = {
    userId: data.userId,
    role: data.role,
    tenantId: data.tenantId,
    branchId: data.branchId ?? null,
  };
  setAuthToken(data.accessToken);
  setSession(session);
  refreshToken = data.refreshToken;
  await write(JSON.stringify({ refreshToken: data.refreshToken, session } satisfies Stored));
}

export async function clearAuth() {
  setAuthToken(null);
  setSession(null);
  refreshToken = null;
  forgetLegacyWebKey(KEY);
  await write(null);
}
