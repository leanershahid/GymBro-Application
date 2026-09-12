import { ApiResponse } from '../../../api/types';

export type { ApiResponse };

export interface ModuleAccessEntry {
  id: number;
  tenantId: number;
  roleId: number;
  roleName: string;
  module: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  isActive: boolean;
  updatedAt: string;
}

// ─── Upsert payloads ──────────────────────────────────────────────
export interface ModuleAccessPayload {
  tenantId: number;
  roleId: number;
  module: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
}

export interface ModuleEntry {
  module: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
}

export interface BulkModuleAccessPayload {
  tenantId: number;
  roleId: number;
  modules: ModuleEntry[];
}

// ─── Check payload ────────────────────────────────────────────────
export type ModuleAction = 'view' | 'create' | 'edit' | 'delete' | 'export';

export interface CheckAccessPayload {
  roleId: number;
  module: string;
  action: ModuleAction;
}

export interface CheckAccessResult {
  roleId: number;
  module: string;
  action: string;
  isAllowed: boolean;
}

// ─── Matrix ───────────────────────────────────────────────────────
export interface MatrixRoleEntry {
  roleId: number;
  roleName: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
}

export interface ModuleAccessMatrix {
  tenantId: number;
  matrix: Record<string, MatrixRoleEntry[]>;
}
