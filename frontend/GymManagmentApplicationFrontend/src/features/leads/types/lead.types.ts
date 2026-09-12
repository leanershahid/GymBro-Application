export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
export type LeadSource = 'instagram' | 'referral' | 'walk-in' | 'web' | 'event' | 'other';

export interface Lead {
  id: number;
  tenantId: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  source: LeadSource | null;
  status: LeadStatus;
  notes: string | null;
  createdAt: string;
}

export interface LeadPayload {
  tenantId: number;
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
