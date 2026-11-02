import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { getSession } from '../../../api/session';

// Recent shop searches, best effort: localStorage on web, SecureStore on phones (small JSON,
// well under its ~2 KB limit). Any storage failure just means no recent searches.

const MAX = 6;
const key = () => `gymbro.shop.recent.${getSession()?.userId ?? 0}`;

export async function loadRecent(): Promise<string[]> {
  try {
    const raw = Platform.OS === 'web' ? window.localStorage.getItem(key()) : await SecureStore.getItemAsync(key());
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((s): s is string => typeof s === 'string').slice(0, MAX) : [];
  } catch {
    return [];
  }
}

async function save(list: string[]) {
  try {
    const raw = JSON.stringify(list);
    if (Platform.OS === 'web') window.localStorage.setItem(key(), raw);
    else await SecureStore.setItemAsync(key(), raw);
  } catch {
    // Storage unavailable — recent searches simply aren't kept.
  }
}

export async function pushRecent(term: string): Promise<string[]> {
  const t = term.trim();
  const list = await loadRecent();
  if (!t) return list;
  const next = [t, ...list.filter(s => s.toLowerCase() !== t.toLowerCase())].slice(0, MAX);
  await save(next);
  return next;
}

export async function clearRecent(): Promise<string[]> {
  await save([]);
  return [];
}
