import { ApiResponse } from '../../../api/types';

// ─── Plan enum (matches API integer values) ───────────────────────
export enum TenantPlan {
  Starter  = 0,
  Basic    = 1,
  Pro      = 2,
  Enterprise = 3,
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

export type TenantListResponse = ApiResponse<Tenant[]>;
