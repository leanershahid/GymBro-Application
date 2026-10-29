export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
/** Free text on the API (no enum); these are the suggested presets. */
export const LEAD_SOURCE_PRESETS = ['walk-in', 'referral', 'instagram', 'web', 'event', 'other'] as const;
export type LeadSource = string;

export interface Lead {
  id: number;
  tenantId: number;
  branchId?: number | null;
  memberId?: number | null;
  aiScore?: number | null;
  conversionProb?: number | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  source: LeadSource | null;
  /** The API returns the enum name ("New", "Contacted", …) — compare case-insensitively. */
  status: string;
  notes: string | null;
  createdAt: string;
}

export interface LeadPayload {
  tenantId: number;
  /** Optional; defaults to the signed-in user's branch. */
  branchId?: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  source?: LeadSource;
  notes?: string;
}

export interface LeadScore {
  score: number;
  grade: string;
  factors: string[];
}

export interface LeadListResponse {
  success: boolean;
  message: string;
  data: {
    items: Lead[];
    pageNumber: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
  } | null;
  errors: string[] | null;
}

export interface LeadCreateResponse {
  success: boolean;
  message: string;
  data: Lead | null;
  errors: string[] | null;
}

export interface LeadSourceBreakdown {
  source: string;
  count: number;
  percentage: number;
}
