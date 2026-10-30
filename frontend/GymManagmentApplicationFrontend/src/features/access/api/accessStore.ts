import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { AccessList } from '../types/access.types';

// The last access list, kept like the refresh token (SecureStore on phones, which is encrypted;
// localStorage on web). It is shown straight away on the next start, so a slow or failed fetch
// never leaves the app empty. Tagged with the user it belongs to, and cleared on sign-out.
// SecureStore values should stay under ~2 KB, so on phones the JSON is split across chunks.

const KEY = 'gymbro.access';
const CHUNK = 1800;

interface Stored {
  userId: number;
  access: AccessList;
}

async function read(): Promise<string | null> {
  if (Platform.OS === 'web') return window.localStorage.getItem(KEY);
  const count = Number(await SecureStore.getItemAsync(`${KEY}.n`));
  if (!count) return null;
  const parts = await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${KEY}.${i}`)));
  return parts.some(p => p === null) ? null : parts.join('');
}

async function write(value: string | null) {
  if (Platform.OS === 'web') {
    if (value === null) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, value);
    return;
  }
  const old = Number(await SecureStore.getItemAsync(`${KEY}.n`)) || 0;
  const parts = value === null ? [] : Array.from({ length: Math.ceil(value.length / CHUNK) }, (_, i) => value.slice(i * CHUNK, (i + 1) * CHUNK));
  await SecureStore.deleteItemAsync(`${KEY}.n`);
  await Promise.all(parts.map((p, i) => SecureStore.setItemAsync(`${KEY}.${i}`, p)));
  await Promise.all(Array.from({ length: Math.max(0, old - parts.length) }, (_, i) => SecureStore.deleteItemAsync(`${KEY}.${parts.length + i}`)));
  // The count goes last, so an interrupted write reads back as nothing rather than half a list.
  if (parts.length) await SecureStore.setItemAsync(`${KEY}.n`, String(parts.length));
}

export async function loadStoredAccess(userId: number): Promise<AccessList | null> {
  try {
    const raw = await read();
    const stored = raw ? (JSON.parse(raw) as Stored) : null;
    return stored?.userId === userId ? stored.access : null;
  } catch {
    return null;
  }
}

export async function storeAccess(userId: number, access: AccessList | null) {
  try {
    await write(access ? JSON.stringify({ userId, access } satisfies Stored) : null);
  } catch {
    // Storage unavailable (private mode, size limit, …) — the list is just fetched again next time.
  }
}

export const clearStoredAccess = () => storeAccess(0, null);
