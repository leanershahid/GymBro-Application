export type MemberGender = 'male' | 'female' | 'other';

export interface Member {
  id: number;
  tenantId: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  gender: MemberGender | null;
  dob: string | null;
  avatarUrl: string | null;
  notes: string | null;
  status: string;
  // New fields — returned from the API when trainer assignment is performed
  trainerId: number | null;
  branchId: number | null;
  createdAt: string;
}

export interface MemberPayload {
  tenantId: number;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  gender?: MemberGender;
  dob?: string;
  avatarUrl?: string;
  notes?: string;
  // Optional: auto-assign trainer on creation
  trainerId?: number;
  branchId?: number;
}

export interface MemberListResponse {
  success: boolean;
  message: string;
  data: {
    items: Member[];
    pageNumber: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
  } | null;
  errors: string[] | null;
}

export interface MemberCreateResponse {
  success: boolean;
  message: string;
  data: Member | null;
  errors: string[] | null;
}
