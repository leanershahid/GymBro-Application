// Types for /api/me/privacy, /api/me/deletion-request, /api/me/data-export(s) and /api/privacy/admin.
// Consents are the safety feature's (/api/consents/me).

export type DeletionStatus = 'pending' | 'cancelled' | 'completed' | 'blocked';
/** The member endpoints report "queued" as "preparing". */
export type ExportStatus = 'queued' | 'preparing' | 'ready' | 'expired' | 'failed';
export type SocialContentMode = 'anonymise' | 'delete';

export interface PrivacyLinks {
  privacyPolicyUrl?: string | null;
  termsUrl?: string | null;
  graceDays: number;
  cancelMembershipOnDeletion: boolean;
  socialContentOnDeletion: SocialContentMode;
}

export interface DeletionIssue {
  /** open_invoices · order_in_progress · active_membership · social_content */
  code: string;
  message: string;
  action?: string | null;
  /** Member screen that fixes it: "billing", "shop/orders", "social". */
  route?: string | null;
}

export interface DeletionCheck { canDelete: boolean; blockers: DeletionIssue[]; warnings: DeletionIssue[] }

export interface DeletionRequest {
  id: number;
  status: DeletionStatus;
  source: 'self' | 'staff';
  requestedAt: string;
  scheduledFor: string;
  cancelledAt?: string | null;
  completedAt?: string | null;
  blockedReason?: string | null;
}

export interface ReauthRequirements { method: 'password' | 'email_code'; twoFactor: boolean; hasEmail: boolean }

export interface DataExport {
  id: number;
  status: ExportStatus;
  requestedAt: string;
  readyAt?: string | null;
  expiresAt?: string | null;
  sizeBytes?: number | null;
}

export interface PrivacyOverview {
  links: PrivacyLinks;
  pendingDeletion?: DeletionRequest | null;
  deletionCheck: DeletionCheck;
  reauth: ReauthRequirements;
  exports: DataExport[];
  nextExportAt?: string | null;
}

export interface RequestDeletionPayload { password?: string; code?: string; twoFactorCode?: string; confirm: boolean }

export interface ExportLink { url: string; expiresAt: string }

export interface PrivacySettings {
  graceDays: number;
  privacyPolicyUrl?: string | null;
  termsUrl?: string | null;
  socialContentOnDeletion: SocialContentMode;
  cancelMembershipOnDeletion: boolean;
}

export interface AdminDeletionRow {
  id: number;
  userId: number;
  memberName: string;
  status: DeletionStatus;
  source: 'self' | 'staff';
  requestedAt: string;
  scheduledFor: string;
  cancelledAt?: string | null;
  completedAt?: string | null;
  blockedReason?: string | null;
  reason?: string | null;
  tables?: Record<string, number> | null;
}

export interface AdminExportRow {
  id: number;
  userId: number;
  memberName: string;
  status: ExportStatus;
  requestedAt: string;
  readyAt?: string | null;
  expiresAt?: string | null;
  error?: string | null;
}

export interface AdminPrivacyRequests { deletions: AdminDeletionRow[]; exports: AdminExportRow[] }

export interface StaffDeletionPayload { reason: string; processNow: boolean }
