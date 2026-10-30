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
  needsNewTrainer: boolean;
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

// ─── Detail (GET /api/members/{id}) ──────────────────────────────
// NOTE: the backend's MemberResponse never fills `trainerId` on GET (only on create) — the
// assigned trainer is resolved separately from the trainers' client lists (see memberApi).
export interface MemberDetail extends Member {
  branchName: string | null;
}

// ─── Update (PUT /api/members/{id}) ──────────────────────────────
// Mirrors backend UpdateMemberRequest exactly. A null/omitted field is left unchanged by the
// API, so a field can be cleared only by sending "" (phone, notes) — dob can't be cleared.
// Email is not editable. branchId is honoured for admins/delegated staff only.
export interface UpdateMemberPayload {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  gender?: string | null;
  dob?: string | null;
  avatarUrl?: string | null;
  notes?: string | null;
  branchId?: number | null;
}

/** GET /api/members/{id}/notes — newest first. `trainerId` is the author's user id. */
export interface MemberNote {
  id: number;
  note: string;
  trainerId: number;
  createdAt: string;
}

/** GET /api/members/{id}/documents */
export interface MemberDocument {
  id: number;
  fileName: string;
  url: string;
  documentType: string | null;
  uploadedAt: string;
}

/** GET /api/subscriptions item (gym memberships). */
export interface MemberSubscription {
  id: number;
  tenantId: number;
  memberId: number;
  planId: number;
  planName: string;
  status: string; // Active | Frozen | Cancelled | Expired
  startDate: string;
  endDate: string | null;
  frozenFrom: string | null;
  frozenUntil: string | null;
  nextRenewalDate: string | null;
  price: number;
  currency: string;
  createdAt: string;
}

/** GET /api/attendance item. */
export interface MemberAttendanceRecord {
  id: number;
  userId: number;
  userName: string | null;
  branchId: number;
  branchName: string | null;
  method: string;
  checkInAt: string;
  checkOutAt: string | null;
  durationMin: number | null;
  distanceM: number | null;
}

/** A trainer currently assigned to the member (resolved from GET /trainers/{id}/clients). */
export interface AssignedTrainer {
  trainerId: number;
  displayName: string;
  assignedAt: string;
}

/** Client-side filtered list + how much of the gym-wide log was scanned. */
export interface ScannedList<T> {
  items: T[];
  scanned: number;
  total: number;
}
