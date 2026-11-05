import { Platform } from 'react-native';
import { forgetLegacyWebKey, sessionStore } from '../../../utils/storage';
import { AccessList } from '../types/access.types';

// The last access list, kept like the refresh token (utils/storage sessionStore: SecureStore on
// phones, which is encrypted; sessionStorage on web). It is shown straight away on the next start, so a slow or failed fetch
// never leaves the app empty. Tagged with the user it belongs to, and cleared on sign-out.
// SecureStore values should stay under ~2 KB, so on phones the JSON is split across chunks.
// The list is re-fetched on focus/poll; storage is only rewritten when it actually changed (ARCH-123).

const KEY = 'gymbro.access';
const CHUNK = 1800;

interface Stored {
  userId: number;
  access: AccessList;
}

const chunked = Platform.OS !== 'web';

async function read(): Promise<string | null> {
  if (!chunked) return sessionStore.getItem(KEY);
  const count = Number(await sessionStore.getItem(`${KEY}.n`));
  if (!count) return null;
  const parts = await Promise.all(Array.from({ length: count }, (_, i) => sessionStore.getItem(`${KEY}.${i}`)));
  return parts.some(p => p === null) ? null : parts.join('');
}

async function write(value: string | null) {
  if (!chunked) {
    forgetLegacyWebKey(KEY);
    if (value === null) await sessionStore.removeItem(KEY);
    else await sessionStore.setItem(KEY, value);
    return;
  }
  const old = Number(await sessionStore.getItem(`${KEY}.n`)) || 0;
  const parts = value === null ? [] : Array.from({ length: Math.ceil(value.length / CHUNK) }, (_, i) => value.slice(i * CHUNK, (i + 1) * CHUNK));
  await sessionStore.removeItem(`${KEY}.n`);
  await Promise.all(parts.map((p, i) => sessionStore.setItem(`${KEY}.${i}`, p)));
  await Promise.all(Array.from({ length: Math.max(0, old - parts.length) }, (_, i) => sessionStore.removeItem(`${KEY}.${parts.length + i}`)));
  // The count goes last, so an interrupted write reads back as nothing rather than half a list.
  if (parts.length) await sessionStore.setItem(`${KEY}.n`, String(parts.length));
}

/** What this process last wrote (or read), so an unchanged poll result skips the storage write. */
let lastWritten: string | null | undefined;

export async function loadStoredAccess(userId: number): Promise<AccessList | null> {
  try {
    const raw = await read();
    lastWritten = raw;
    const stored = raw ? (JSON.parse(raw) as Stored) : null;
    return stored?.userId === userId ? stored.access : null;
  } catch {
    return null;
  }
}

export async function storeAccess(userId: number, access: AccessList | null) {
  try {
    const value = access ? JSON.stringify({ userId, access } satisfies Stored) : null;
    if (value === lastWritten) return;
    await write(value);
    lastWritten = value;
  } catch {
    // Storage unavailable (private mode, size limit, …) — the list is just fetched again next time.
  }
}

export const clearStoredAccess = () => storeAccess(0, null);
