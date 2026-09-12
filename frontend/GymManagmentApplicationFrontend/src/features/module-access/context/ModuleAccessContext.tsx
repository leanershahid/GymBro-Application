import React, { createContext, useContext } from 'react';
import { useUserModules } from '../api/userModulesQueries';

interface ModuleAccessContextValue {
  isLoading: boolean;
  hasModule: (key: string) => boolean;
}

const ModuleAccessContext = createContext<ModuleAccessContextValue | null>(null);

interface ProviderProps {
  userId: number;
  children: React.ReactNode;
}

/**
 * Wraps a Trainer/Client screen tree with their enabled feature modules.
 * This is UX-only hiding — real enforcement is the backend's 403 check
 * (RequireModuleAttribute), not this provider.
 */
export function ModuleAccessProvider({ userId, children }: ProviderProps) {
  const { data: modules, isLoading } = useUserModules(userId);

  const value: ModuleAccessContextValue = {
    isLoading,
    hasModule: (key: string) => (modules ?? []).some(m => m.key === key && m.isEnabled),
  };

  return <ModuleAccessContext.Provider value={value}>{children}</ModuleAccessContext.Provider>;
}

/**
 * Returns whether the current user can access `moduleKey`.
 * Outside a ModuleAccessProvider (e.g. the Admin tree), always returns true —
 * module gating only applies to Trainer/Client.
 * While the user's module list is still loading, returns false (fail-closed)
 * to avoid flashing gated content before it's confirmed enabled.
 */
export function useModuleAccess(moduleKey: string): boolean {
  const ctx = useContext(ModuleAccessContext);
  if (!ctx) return true;
  if (ctx.isLoading) return false;
  return ctx.hasModule(moduleKey);
}
