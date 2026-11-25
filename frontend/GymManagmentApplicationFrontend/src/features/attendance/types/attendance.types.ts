export interface AttendanceSettings {
  /** Face scans at an access device (scanner) count as attendance. */
  faceEnabled: boolean;
  fingerprintEnabled: boolean;
  defaultRadiusM: number;
  maxAccuracyM: number;
  /** Self check-in needs location AND a live selfie matching the member's reference photo. Off by default. */
  faceCheckEnabled: boolean;
  /** Minimum similarity 80–99. */
  faceMatchThreshold: number;
  /** 0–90 days; 0 = check-in selfies aren't kept. */
  keepCheckInSelfiesDays: number;
}

export interface BranchGeofence {
  branchId: number;
  name: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
  /** Effective radius (branch's own or the gym default); null when no location is set. */
  radiusM: number | null;
  hasOwnRadius: boolean;
  enabled: boolean;
  isConfigured: boolean;
  isActive: boolean;
}

export interface AttendanceSettingsResponse {
  settings: AttendanceSettings;
  branches: BranchGeofence[];
  /** Read-only: AWS Rekognition is configured on the server (face check-in can be turned on). */
  faceServiceConfigured: boolean;
  /** Where faces are compared: 'local' (this server), 'aws' (AWS Rekognition) or 'none'. */
  faceProvider?: FaceProvider;
  /** Read-only: face photos can be stored privately. */
  privateStorageConfigured: boolean;
}

export interface SetBranchGeofencePayload {
  enabled: boolean;
  lat?: number;
  lng?: number;
  /** null/undefined = use the gym default radius */
  radiusM?: number | null;
}

export interface AttendanceRecord {
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
  /** Self check-in with a face check: true = the selfie matched; null/undefined = no face check. */
  faceVerified?: boolean | null;
  /** Similarity 0–100 of the matching selfie. */
  faceScore?: number | null;
  faceAttemptId?: number | null;
  hasFaceSelfie?: boolean;
}

export interface MyAttendanceStatus {
  locationEnabled: boolean;
  openVisit: AttendanceRecord | null;
  branches: BranchGeofence[];
  visitsThisMonth: number;
  /** The gym needs a selfie too (members only). */
  faceCheckRequired?: boolean;
  faceEnrolled?: boolean;
}

export interface LocationFix {
  lat: number;
  lng: number;
  accuracyM?: number;
  branchId?: number;
}

export interface CheckInResult {
  checkedIn: boolean;
  message: string;
  visit: AttendanceRecord | null;
  distanceM: number | null;
  nearestBranch: string | null;
  /** Desk check-in stopped by the safety gate (no waiver / health check); retry with override. */
  safetyBlocked?: boolean;
  /** What the gate found missing: waiver, health, health_expired, clearance, emergency_contact. */
  safetyMissing?: string[] | null;
  /** Location passed and the gym needs a selfie: send it with checkInWithFace. */
  faceRequired?: boolean;
}

// ── Face check-in ───────────────────────────────────────────────────────

export type FaceEnrollmentStatus = 'active' | 'reset_required';
export type FaceProvider = 'local' | 'aws' | 'none';
export type FaceAttemptOutcome = 'matched' | 'mismatch' | 'not_clear' | 'unavailable' | 'locked';

/** GET /attendance/face/me */
export interface MyFaceStatus {
  required: boolean;
  enrolled: boolean;
  status: FaceEnrollmentStatus | null;
  enrolledAt: string | null;
  source: 'self' | 'desk' | null;
  consentGranted: boolean;
  /** Signed, short-lived link to the member's own reference photo. */
  photoUrl: string | null;
  keepCheckInSelfiesDays: number;
  faceProvider?: FaceProvider;
}

export interface FaceAttempt {
  id: number;
  userId: number;
  userName: string | null;
  branchId: number | null;
  branchName: string | null;
  at: string;
  outcome: FaceAttemptOutcome;
  similarity: number | null;
  threshold: number;
  detail: string | null;
  hasSelfie: boolean;
  attendanceId: number | null;
}

/** GET /attendance/face/members/{id} */
export interface MemberFaceStatus {
  userId: number;
  faceCheckEnabled: boolean;
  enrolled: boolean;
  status: FaceEnrollmentStatus | null;
  enrolledAt: string | null;
  source: 'self' | 'desk' | null;
  enrolledByName: string | null;
  consentGranted: boolean;
  photoUrl: string | null;
  recentAttempts: FaceAttempt[];
  keepCheckInSelfiesDays: number;
  faceProvider?: FaceProvider;
}

export interface FaceAttemptPhotos {
  attemptId: number;
  selfieUrl: string | null;
  referenceUrl: string | null;
  similarity: number | null;
  outcome: FaceAttemptOutcome;
  at: string;
}

/** A live capture from the front camera. */
export interface CapturedSelfie {
  uri: string;
  mimeType: string;
  /** ISO time of capture (sent as capturedAt). */
  capturedAt: string;
}
