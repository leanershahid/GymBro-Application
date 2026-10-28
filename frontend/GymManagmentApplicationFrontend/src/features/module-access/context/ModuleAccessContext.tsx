import React, { createContext, useContext } from 'react';
import { useUserModules } from '../api/userModulesQueries';
import { UserModuleAccessEntry } from '../types/userModules.types';

type Action = 'view' | 'create' | 'edit' | 'delete';

interface ModuleAccessContextValue {
  isLoading: boolean;
  isAdmin: boolean;
  getEntry: (key: string) => UserModuleAccessEntry | undefined;
}

const ModuleAccessContext = createContext<ModuleAccessContextValue | null>(null);

interface ProviderProps {
  userId: number;
  /**
   * Mirrors the backend's default (see IUserModulesService.CanAsync): a user with no explicit
   * row for a module defaults to allowed only if they're an admin/super admin — their access is
   * a privilege dialed down by exception, not granted from zero. Every other role defaults to
   * denied until a module is explicitly turned on for them.
   */
  isAdmin?: boolean;
  children: React.ReactNode;
}

/**
 * Wraps a screen tree (Admin, Trainer or Client) with the signed-in user's module access.
 * This is UX-only hiding — real enforcement is the backend's 403 check (RequireModuleAttribute),
 * not this provider.
 */
export function ModuleAccessProvider({ userId, isAdmin = false, children }: ProviderProps) {
  const { data: modules, isLoading } = useUserModules(userId);

  const value: ModuleAccessContextValue = {
    isLoading,
    isAdmin,
    getEntry: (key: string) => (modules ?? []).find(m => m.key === key),
  };

  return <ModuleAccessContext.Provider value={value}>{children}</ModuleAccessContext.Provider>;
}

function checkAction(
  ctx: ModuleAccessContextValue,
  moduleKey: string,
  action: Action,
): boolean {
  if (ctx.isLoading) return false; // fail-closed while unconfirmed, to avoid a content flash
  const entry = ctx.getEntry(moduleKey);
  if (!entry) return ctx.isAdmin; // no explicit row: admins default-allow, everyone else default-deny
  if (!entry.isEnabled) return false;
  switch (action) {
    case 'view':   return true;
    case 'create': return entry.canAdd;
    case 'edit':   return entry.canEdit;
    case 'delete': return entry.canDelete;
  }
}

/**
 * Returns whether the current user can see `moduleKey` at all.
 * Outside a ModuleAccessProvider, always returns true (e.g. screens not yet wrapped).
 */
export function useModuleAccess(moduleKey: string): boolean {
  const ctx = useContext(ModuleAccessContext);
  if (!ctx) return true;
  return checkAction(ctx, moduleKey, 'view');
}

/**
 * Returns whether the current user can perform `action` (add/edit/delete) within `moduleKey`.
 * Outside a ModuleAccessProvider, always returns true.
 */
export function useModuleCan(moduleKey: string, action: 'create' | 'edit' | 'delete'): boolean {
  const ctx = useContext(ModuleAccessContext);
  if (!ctx) return true;
  return checkAction(ctx, moduleKey, action);
}
