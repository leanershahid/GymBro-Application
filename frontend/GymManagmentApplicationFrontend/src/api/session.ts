// In-memory session for the signed-in user, set at login alongside the JWT (see axios.ts).
// The backend derives tenant/branch from the token, so these values are for UI decisions
// (which screens to show, default branch) — never a security boundary.

export interface Session {
  userId: number;
  role: string;
  tenantId: number;
  branchId: number | null;
}

let current: Session | null = null;

export function setSession(session: Session | null) {
  current = session;
}

export function getSession(): Session | null {
  return current;
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
