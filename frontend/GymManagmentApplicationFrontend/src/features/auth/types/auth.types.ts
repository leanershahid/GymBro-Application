import { ApiResponse } from '../../../api/types';

export interface LoginPayload {
  email: string;
  password: string;
  /** "Remember this device" token from an earlier two-step sign-in. */
  deviceToken?: string | null;
}

export interface AuthData extends TwoFactorLoginFields {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  role: string;
  userId: number;
  tenantId: number;
  branchId: number | null;
  email: string;
}

export type LoginResponse = ApiResponse<AuthData>;

export interface UserProfile {
  userId: number;
  tenantId: number;
  branchId: number | null;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isEmailVerified: boolean;
  phone: string | null;
  avatarUrl: string | null;
}

export type MeResponse = ApiResponse<UserProfile>;

// ─── Two-step sign-in (roadmap feature 10) ──────────────────────────────────
// POST /auth/login answers `requiresTwoFactor: true` + a challenge (and no tokens) when the
// account has 2FA on; the app then finishes with POST /auth/2fa/verify. All fields are optional
// so older responses (and older servers) still type-check.

export type TwoFactorMethod = 'totp' | 'email' | 'recovery';

export interface TwoFactorLoginFields {
  requiresTwoFactor?: boolean;
  challengeToken?: string | null;
  challengeExpiresAt?: string | null;
  methods?: TwoFactorMethod[] | null;
  /** From 2fa/verify with rememberDevice: kept on the device, sent with the next login. */
  deviceToken?: string | null;
  /** The gym requires 2FA of this user and it isn't set up yet. */
  twoFactorSetupRequired?: boolean;
  /** Grace period over: setup must be done before the app opens. */
  twoFactorSetupBlocking?: boolean;
  twoFactorGraceEndsAt?: string | null;
}

export interface TwoFactorVerifyPayload {
  challengeToken: string;
  code: string;
  method: TwoFactorMethod;
  rememberDevice: boolean;
}

export interface TwoFactorSetup {
  secret: string;
  secretGrouped: string;
  otpAuthUri: string;
  issuer: string;
  account: string;
}

export interface TwoFactorRecoveryCodes {
  recoveryCodes: string[];
}

export interface TwoFactorStatus {
  enabled: boolean;
  enabledAt: string | null;
  recoveryCodesRemaining: number;
  trustedDevices: number;
  required: boolean;
  graceEndsAt: string | null;
  setupRequiredNow: boolean;
  methods: TwoFactorMethod[];
}

export interface TwoFactorPolicy {
  requireForAdmins: boolean;
  requireForStaff: boolean;
  gracePeriodDays: number;
}
