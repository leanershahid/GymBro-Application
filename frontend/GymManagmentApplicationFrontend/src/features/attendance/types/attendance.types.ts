export interface AttendanceSettings {
  faceEnabled: boolean;
  fingerprintEnabled: boolean;
  defaultRadiusM: number;
  maxAccuracyM: number;
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
}

export interface MyAttendanceStatus {
  locationEnabled: boolean;
  openVisit: AttendanceRecord | null;
  branches: BranchGeofence[];
  visitsThisMonth: number;
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
}
