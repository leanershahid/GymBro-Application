import { useSyncExternalStore } from 'react';

// In-memory session for the signed-in user, set at login alongside the JWT (see axios.ts).
// The backend derives tenant/branch from the token, so these values are for UI decisions
// (which screens to show, default branch) — never a security boundary.
//
// Components should read it with useSession() so they re-render when it changes (ARCH-125);
// getSession() is for non-React code (API calls, query keys built inside a queryFn).
// Per-user in-memory caches register with onSessionChange() to clear themselves on sign-out.

export interface Session {
  userId: number;
  role: string;
  tenantId: number;
  branchId: number | null;
}

let current: Session | null = null;
const listeners = new Set<(next: Session | null, prev: Session | null) => void>();

export function setSession(session: Session | null) {
  const prev = current;
  current = session;
  if (prev !== session) listeners.forEach(l => l(session, prev));
}

export function getSession(): Session | null {
  return current;
}

/** Called after every session change (sign-in, refresh, sign-out). Returns an unsubscribe. */
export function onSessionChange(listener: (next: Session | null, prev: Session | null) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const subscribe = (l: () => void) => onSessionChange(() => l());

/** The current session, re-rendering the component when it changes. */
export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, getSession, getSession);
}

// The signed-in user's gym. Sent where an API still accepts a tenantId; the server
// ignores it for everyone but super admins.
export const currentTenantId = () => current?.tenantId ?? 0;

export const isSuperAdmin = (role?: string) => role === 'superadmin';

// Built-in roles with full gym access in the admin app.
export const isAdminRole = (role?: string) => role === 'admin' || role === 'superadmin';

// 'staff' and admin-defined custom roles: admin app, filtered by the role/module matrix.
export const isDelegatedRole = (role?: string) =>
  !!role && !['superadmin', 'admin', 'trainer', 'client'].includes(role);
