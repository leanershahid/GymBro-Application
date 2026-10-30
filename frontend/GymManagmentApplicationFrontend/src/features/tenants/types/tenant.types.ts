import { ApiResponse } from '../../../api/types';

// ─── Plan enum (matches the API's integer values — Domain/Enums/TenantPlan.cs) ──
export enum TenantPlan {
  Starter    = 0,
  Pro        = 1,
  Enterprise = 2,
  WhiteLabel = 3,
}

/** The API returns the plan as its enum name ("Pro"); map it back to the integer it accepts. */
export function tenantPlanFromName(name: string | null | undefined): TenantPlan {
  const key = (name ?? '').replace(/[\s_-]/g, '').toLowerCase();
  switch (key) {
    case 'pro':        return TenantPlan.Pro;
    case 'enterprise': return TenantPlan.Enterprise;
    case 'whitelabel': return TenantPlan.WhiteLabel;
    default:           return TenantPlan.Starter;
  }
}

export interface Tenant {
  id: number;
  uuid: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  logoUrl: string;
  primaryColor: string;
  timezone: string;
  locale: string;
  currency: string;
  customDomain: string;
  trialEndsAt: string;
  createdAt: string;
}

// ─── Create tenant ────────────────────────────────────────────────
export interface TenantPayload {
  name: string;
  slug: string;
  plan: number;
  logoUrl: string;
  primaryColor: string;
  timezone: string;
  locale: string;
  currency: string;
  customDomain: string;
  trialEndsAt: string;
}

export type TenantCreateResponse = ApiResponse<Tenant>;

// ─── Update tenant (PUT /tenants/{id}) ────────────────────────────
// Slug is fixed after creation. Plan / trial / status are only applied for a super admin.
export interface TenantUpdatePayload {
  name: string;
  logoUrl: string;
  primaryColor: string;
  timezone: string;
  locale: string;
  currency: string;
  customDomain: string;
  plan?: number;
  trialEndsAt?: string;
}

export type TenantListResponse = ApiResponse<Tenant[]>;
