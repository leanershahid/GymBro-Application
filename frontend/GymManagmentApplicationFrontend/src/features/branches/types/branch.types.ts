import { ApiResponse } from '../../../api/types';

export interface Branch {
  id: number;
  tenantId: number;
  parentId: number | null;
  name: string;
  code: string;
  status: string;
  address: string;
  city: string;
  state: string;
  country: string;
  zip: string;
  phone: string;
  email: string;
  timezone: string;
  capacity: number;
  logoUrl: string;
  createdAt: string;
}

export type BranchListResponse = ApiResponse<Branch[]>;

// ─── Create branch ────────────────────────────────────────────────
export interface BranchPayload {
  tenantId: number;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  country: string;
  zip: string;
  phone: string;
  email: string;
  timezone: string;
  capacity: number;
  logoUrl: string;
}

export type BranchCreateResponse = ApiResponse<Branch>;

// ─── Update branch (PUT /branches/{id}) ───────────────────────────
// Code and tenant are fixed after creation; status has its own toggle on the list.
export type BranchUpdatePayload = Omit<BranchPayload, 'tenantId' | 'code'>;
export type BranchResponse = ApiResponse<Branch>;
