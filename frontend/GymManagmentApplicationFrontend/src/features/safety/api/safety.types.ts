// Types for /api/safety and /api/consents (waivers, health check, emergency contact, consents).
// Mirrors Application/Safety/SafetyDtos.cs.

export type HealthStatus = 'missing' | 'current' | 'expired' | 'needs_clearance' | 'cleared';
export type WaiverStatus = 'signed' | 'resign_required' | 'unsigned';
/** What blocks booking / self check-in. */
export type SafetyMissing = 'waiver' | 'health' | 'health_expired' | 'clearance' | 'emergency_contact';
export type SafetyStep = 'waiver' | 'health' | 'emergency';

export type ConsentType = 'health_data' | 'marketing_email' | 'marketing_push' | 'photo_media' | 'terms' | 'privacy';

export interface EmergencyContact {
  name: string;
  relationship: string | null;
  phone: string;
  /** 'legacy' = read from the old free-text profile field; saving turns it into 'profile'. */
  source: 'profile' | 'legacy';
  updatedAt: string | null;
}

export interface EmergencyContactPayload {
  name: string;
  relationship?: string | null;
  phone: string;
}

export interface WaiverStatusRow {
  waiverId: number;
  title: string;
  latestVersionId: number;
  latestVersion: number;
  signedVersion: number | null;
  signedAt: string | null;
  signatureId: number | null;
  status: WaiverStatus;
  ok: boolean;
}

export interface HealthStatusInfo {
  status: HealthStatus;
  screeningId: number | null;
  submittedAt: string | null;
  expiresAt: string | null;
  needsClearance: boolean;
  clearedAt: string | null;
  ok: boolean;
}

export interface SafetyCompliance {
  userId: number;
  gatingEnabled: boolean;
  waivers: WaiverStatusRow[];
  waiverOk: boolean;
  health: HealthStatusInfo;
  hasHealthDataConsent: boolean;
  emergencyContact: EmergencyContact | null;
  emergencyOk: boolean;
  missing: SafetyMissing[];
  canBook: boolean;
  stepsDone: number;
  stepsTotal: number;
  checklistComplete: boolean;
}

export interface WaiverToSign {
  waiverId: number;
  versionId: number;
  version: number;
  title: string;
  body: string;
  requiresResign: boolean;
  previouslySignedVersion: number | null;
  publishedAt: string;
}

export interface WaiverSignature {
  id: number;
  userId: number;
  memberName: string | null;
  waiverId: number;
  waiverVersionId: number;
  version: number;
  title: string;
  signedName: string;
  signedAt: string;
  ip: string | null;
  userAgent: string | null;
  bodyHash: string;
  /** Only on the signed-copy endpoint. */
  body: string | null;
}

export interface HealthQuestion { key: string; text: string; help: string | null }

export interface HealthQuestionnaire {
  formVersion: string;
  validDays: number;
  questions: HealthQuestion[];
}

export interface HealthAnswer { key: string; question: string; answer: boolean }

export interface HealthScreening {
  id: number;
  userId: number;
  formVersion: string;
  answers: HealthAnswer[];
  yesCount: number;
  conditions: string | null;
  medications: string | null;
  injuries: string | null;
  pregnancy: string | null;
  needsClearance: boolean;
  submittedAt: string;
  expiresAt: string;
  expired: boolean;
  clearedAt: string | null;
  clearanceNote: string | null;
}

export interface SubmitHealthPayload {
  answers: boolean[];
  conditions?: string;
  medications?: string;
  injuries?: string;
  pregnancy?: string;
  grantHealthDataConsent: boolean;
}

export interface ConsentState {
  type: ConsentType;
  granted: boolean;
  version: string | null;
  at: string | null;
  source: string | null;
}

export interface ConsentHistoryRow {
  id: number;
  type: ConsentType;
  granted: boolean;
  version: string;
  at: string;
  source: string;
}

export interface Consents { current: ConsentState[]; history: ConsentHistoryRow[] }

export interface SafetyOverride {
  id: number;
  context: string;
  missing: SafetyMissing[];
  reason: string | null;
  overriddenByUserId: number;
  overriddenByName: string | null;
  at: string;
}

export interface MemberSafety {
  compliance: SafetyCompliance;
  signatures: WaiverSignature[];
  canViewHealthAnswers: boolean;
  recentOverrides: SafetyOverride[];
  consents: ConsentState[];
}

export interface SafetySettings {
  gatingEnabled: boolean;
  healthValidDays: number;
  blockUntilCleared: boolean;
  requireEmergencyContact: boolean;
}

export interface AdminWaiverVersion {
  id: number;
  version: number;
  title: string;
  requiresResign: boolean;
  publishedAt: string;
  signatureCount: number;
}

export interface AdminWaiver {
  id: number;
  title: string;
  isActive: boolean;
  latestVersion: number;
  latestVersionId: number | null;
  latestBody: string;
  versions: AdminWaiverVersion[];
  createdAt: string;
}

export interface WaiverTemplate { title: string; body: string; isPlaceholder: boolean }
