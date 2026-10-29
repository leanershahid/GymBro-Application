import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { setAuthToken } from './axios';
import { setSession, Session } from './session';

// Keeps the user signed in across app restarts / page reloads. Only the refresh token is
// persisted (SecureStore on phones, localStorage on web); the short-lived access token stays
// in memory and is re-issued from it on start-up (see restoreSession in App.tsx).

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
    if (Platform.OS === 'web') {
      if (value === null) window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, value);
    } else if (value === null) await SecureStore.deleteItemAsync(KEY);
    else await SecureStore.setItemAsync(KEY, value);
  } catch {
    // Storage unavailable (private mode, etc.) — the session just won't survive a restart.
  }
}

export async function loadStoredAuth(): Promise<Stored | null> {
  try {
    const raw = Platform.OS === 'web' ? window.localStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
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
  await write(null);
}
