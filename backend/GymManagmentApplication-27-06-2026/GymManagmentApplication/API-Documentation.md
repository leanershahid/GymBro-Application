# Enterprise Gym Platform — Admin Console API Documentation

> **Base URL:** `https://<host>/api`
> **Version:** 1.0 | **Date:** July 5, 2026
> **Auth:** JWT Bearer token in `Authorization: Bearer <token>` header (currently disabled for development)

---

## Table of Contents

1. [Authentication & Identity](#1-authentication--identity)
2. [SSO (Single Sign-On)](#2-sso-single-sign-on)
3. [Roles & Permissions](#3-roles--permissions)
4. [Biometric Access](#4-biometric-access)
5. [Tenants](#5-tenants)
6. [Branches](#6-branches)
7. [Members](#7-members)
8. [Trainers](#8-trainers)
9. [Leads](#9-leads)
10. [Onboarding](#10-onboarding)
11. [Corporate Accounts](#11-corporate-accounts)
12. [Exercises](#12-exercises)
13. [Workouts](#13-workouts)
14. [Workout Builder](#14-workout-builder)
15. [Workout Plans](#15-workout-plans)
16. [Workout Automation](#16-workout-automation)

---

## Response Envelope

All endpoints return a consistent envelope:

```json
{
  "success": true,
  "message": "Operation successful.",
  "data": { ... },
  "errors": []
}
```

| Field | Type | Description |
|---|---|---|
| `success` | bool | `true` on success, `false` on failure |
| `message` | string | Human-readable status message |
| `data` | object/array | Payload (null on failure) |
| `errors` | string[] | Validation/error details (empty on success) |

---

## 1. Authentication & Identity

**Base route:** `/api/auth`

Handles user registration, login, token management, and password lifecycle.

---

### POST `/api/auth/register`

Register a new user account.

**Access:** Public

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "role": "client",
  "tenantId": 1
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `email` | string | ✅ | User email address |
| `password` | string | ✅ | Account password |
| `firstName` | string | ✅ | First name |
| `lastName` | string | ✅ | Last name |
| `role` | string | ✅ | Role: `admin`, `trainer`, `client` (default: `client`) |
| `tenantId` | ulong | ✅ | Tenant the user belongs to |

**Responses:**
- `200 OK` — Registration successful, returns `AuthResponse`
- `400 Bad Request` — Validation failed
- `409 Conflict` — Email already registered

**Response Data (`AuthResponse`):**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "dGhp...",
  "expiresAt": "2026-07-05T12:00:00Z",
  "role": "client",
  "userId": 42,
  "email": "user@example.com"
}
```

---

### POST `/api/auth/login`

Authenticate and receive JWT tokens.

**Access:** Public

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Responses:**
- `200 OK` — Login successful, returns `AuthResponse`
- `400 Bad Request` — Validation failed
- `401 Unauthorized` — Invalid email or password

---

### POST `/api/auth/logout`

Invalidate the current user session.

**Access:** Authenticated users

**No request body required.** User ID is resolved from the JWT token.

**Responses:**
- `200 OK` — Logged out successfully

---

### POST `/api/auth/refresh-token`

Exchange a refresh token for a new access token.

**Access:** Public

**Request Body:**
```json
{
  "refreshToken": "dGhp..."
}
```

**Responses:**
- `200 OK` — Token refreshed, returns `AuthResponse`
- `401 Unauthorized` — Invalid or expired refresh token

---

### POST `/api/auth/forgot-password`

Trigger a password reset email.

**Access:** Public

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Responses:**
- `200 OK` — Reset email sent (always returns 200 to prevent enumeration)

---

### POST `/api/auth/reset-password`

Reset password using a token from the reset email.

**Access:** Public

**Request Body:**
```json
{
  "token": "reset-token-from-email",
  "newPassword": "NewSecurePass123!"
}
```

**Responses:**
- `200 OK` — Password reset successful
- `400 Bad Request` — Invalid or expired token

---

### PUT `/api/auth/change-password`

Change password for the authenticated user.

**Access:** Authenticated users

**Request Body:**
```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass456!"
}
```

**Responses:**
- `200 OK` — Password changed successfully
- `400 Bad Request` — Current password incorrect

---

### GET `/api/auth/me`

Get the current authenticated user's profile.

**Access:** Authenticated users

**No request body.**

**Response Data (`UserProfileResponse`):**
```json
{
  "userId": 42,
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "admin",
  "isEmailVerified": true
}
```

**Responses:**
- `200 OK` — Returns user profile
- `404 Not Found` — User not found

---

### POST `/api/auth/verify-email`

Verify email address using an OTP.

**Access:** Public

**Request Body:**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Responses:**
- `200 OK` — Email verified successfully
- `400 Bad Request` — Invalid or expired OTP

---

### POST `/api/auth/resend-otp`

Resend email verification OTP.

**Access:** Public

**Request Body:**
```json
{
  "email": "user@example.com",
  "channel": "email"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `email` | string | ✅ | Target email address |
| `channel` | string | ❌ | Delivery channel: `email` or `sms` (default: `email`) |

**Responses:**
- `200 OK` — OTP sent successfully
- `400 Bad Request` — Email not found

---

## 2. SSO (Single Sign-On)

**Base route:** `/api/auth/sso`

Supports Google, Microsoft, and Apple OAuth2 providers per tenant.

---

### POST `/api/auth/sso/init`

Generate an OAuth2 authorization URL for the selected provider.

**Access:** Public

**Request Body:**
```json
{
  "provider": "google",
  "redirectUri": "https://app.example.com/auth/callback"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `provider` | string | ✅ | OAuth provider: `google`, `microsoft`, `apple` |
| `redirectUri` | string | ✅ | Callback URL after authorization |

**Responses:**
- `200 OK` — Returns `{ "authorizationUrl": "https://accounts.google.com/..." }`
- `400 Bad Request` — Validation failed

---

### POST `/api/auth/sso/callback`

Exchange the OAuth2 authorization code for a platform JWT.

**Access:** Public

**Request Body:**
```json
{
  "provider": "google",
  "code": "4/0AX4XfWh...",
  "state": "random-state-string"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `provider` | string | ✅ | OAuth provider |
| `code` | string | ✅ | Authorization code from OAuth callback |
| `state` | string | ✅ | State token from init step (CSRF protection) |

**Responses:**
- `200 OK` — SSO login successful, returns `AuthResponse`
- `400 Bad Request` — Validation failed
- `401 Unauthorized` — SSO authentication failed

---

### GET `/api/auth/sso/providers?tenantId={tenantId}`

List configured SSO providers for a tenant.

**Access:** admin

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `tenantId` | ulong | ✅ | Target tenant ID |

**Responses:**
- `200 OK` — Returns list of configured SSO providers

---

### PUT `/api/auth/sso/providers/{id}`

Configure (add or update) an SSO provider for a tenant.

**Access:** admin

**Path Parameters:**

| Param | Description |
|---|---|
| `id` | Provider identifier, e.g. `google`, `microsoft`, `apple` |

**Request Body:**
```json
{
  "clientId": "your-oauth-client-id",
  "clientSecret": "your-oauth-client-secret",
  "redirectUri": "https://app.example.com/auth/callback",
  "isEnabled": true
}
```

**Responses:**
- `200 OK` — Provider configured
- `400 Bad Request` — Validation failed
- `404 Not Found` — Provider not found

---

### DELETE `/api/auth/sso/providers/{id}`

Remove an SSO provider configuration.

**Access:** admin

**Responses:**
- `200 OK` — SSO provider removed
- `404 Not Found` — Provider not found

---

## 3. Roles & Permissions

**Base routes:** `/api/roles`, `/api/permissions`, `/api/users`

Manage custom roles, permission matrices, and user role assignments.

---

### GET `/api/roles`

List all roles in the system.

**Access:** admin

**Responses:**
- `200 OK` — Returns array of role objects

---

### POST `/api/roles`

Create a new custom role.

**Access:** admin

**Request Body:**
```json
{
  "name": "front-desk",
  "description": "Can manage check-in and basic member support"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | ✅ | Unique role name |
| `description` | string | ❌ | Role description |

**Responses:**
- `201 Created` — Role created, returns role object
- `400 Bad Request` — Validation failed

---

### GET `/api/roles/{id}`

Get a role by ID.

**Access:** admin

**Responses:**
- `200 OK` — Returns role object
- `404 Not Found` — Role not found

---

### PUT `/api/roles/{id}`

Update a role's name or description.

**Access:** admin

**Request Body:**
```json
{
  "name": "front-desk-supervisor",
  "description": "Updated description"
}
```

**Responses:**
- `200 OK` — Role updated
- `404 Not Found` — Role not found

---

### DELETE `/api/roles/{id}`

Delete a role.

**Access:** admin

**Responses:**
- `200 OK` — Role deleted
- `404 Not Found` — Role not found

---

### GET `/api/roles/{id}/permissions`

Get the permission list assigned to a role.

**Access:** admin

**Responses:**
- `200 OK` — Returns array of permission strings

---

### PUT `/api/roles/{id}/permissions`

Update the permissions assigned to a role.

**Access:** admin

**Request Body:**
```json
{
  "permissions": ["members.view", "members.create", "checkin.manage"]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `permissions` | string[] | ✅ | List of permission keys to assign |

**Responses:**
- `200 OK` — Permissions updated
- `400 Bad Request` — Validation failed
- `404 Not Found` — Role not found

---

### GET `/api/permissions`

Get all available permissions in the system.

**Access:** admin

**Responses:**
- `200 OK` — Returns flat list of all permission keys

---

### GET `/api/permissions/matrix`

Get the full role-to-permission matrix.

**Access:** admin

**Responses:**
- `200 OK` — Returns matrix object mapping roles to permission sets

---

### POST `/api/users/{id}/roles`

Assign a role to a user.

**Access:** admin

**Path Parameters:**

| Param | Description |
|---|---|
| `id` | User ID (ulong) |

**Request Body:**
```json
{
  "roleId": "front-desk"
}
```

**Responses:**
- `200 OK` — Role assigned
- `400 Bad Request` — Role not found or validation failed

---

### DELETE `/api/users/{id}/roles/{roleId}`

Revoke a role from a user.

**Access:** admin

**Responses:**
- `200 OK` — Role revoked
- `404 Not Found` — User does not have this role

---

## 4. Biometric Access

**Base route:** `/api/biometric`

Enroll and verify member/staff biometric credentials (face and fingerprint), and view gym entry logs.

---

### POST `/api/biometric/face/enroll`

Enroll a user's face for biometric entry.

**Access:** admin

**Request Body:**
```json
{
  "userId": 42,
  "faceImageBase64": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `userId` | ulong | ✅ | User to enroll |
| `faceImageBase64` | string | ✅ | Base64-encoded face image |

**Responses:**
- `200 OK` — Face enrolled successfully
- `400 Bad Request` — Validation failed

---

### POST `/api/biometric/face/verify`

Verify identity using a face scan against enrolled records.

**Access:** admin

**Request Body:**
```json
{
  "faceImageBase64": "data:image/jpeg;base64,/9j/4AAQ...",
  "tenantId": 1
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `faceImageBase64` | string | ✅ | Base64-encoded face image to verify |
| `tenantId` | ulong | ✅ | Tenant scope for the verification |

**Responses:**
- `200 OK` — Identity verified, returns `{ "verified": true, "userId": 42 }`
- `401 Unauthorized` — Face verification failed

---

### DELETE `/api/biometric/face/{userId}`

Remove all biometric data for a user.

**Access:** admin

**Path Parameters:**

| Param | Description |
|---|---|
| `userId` | User ID (ulong) |

**Responses:**
- `200 OK` — Biometric data removed
- `404 Not Found` — No biometric data found

---

### GET `/api/biometric/entry/logs?tenantId={id}&pageNumber={n}&pageSize={n}`

Retrieve paginated gym entry logs from biometric readers.

**Access:** admin

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `tenantId` | ulong | ✅ | Tenant scope |
| `pageNumber` | int | ❌ | Page number (default: 1) |
| `pageSize` | int | ❌ | Page size (default: 20) |

**Responses:**
- `200 OK` — Returns paginated list of entry log records

---

### POST `/api/biometric/fingerprint/enroll`

Enroll a user's fingerprint.

**Access:** admin

**Request Body:**
```json
{
  "userId": 42,
  "fingerprintData": "base64-encoded-fingerprint-template"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `userId` | ulong | ✅ | User to enroll |
| `fingerprintData` | string | ✅ | Base64-encoded fingerprint template |

**Responses:**
- `200 OK` — Fingerprint enrolled successfully
- `400 Bad Request` — Validation failed

---

### POST `/api/biometric/fingerprint/verify`

Verify identity using a fingerprint scan.

**Access:** admin

**Request Body:**
```json
{
  "fingerprintData": "base64-encoded-fingerprint-template",
  "tenantId": 1
}
```

**Responses:**
- `200 OK` — Fingerprint verified, returns `{ "verified": true, "userId": 42 }`
- `401 Unauthorized` — Fingerprint verification failed

---

## 5. Tenants

**Base route:** `/api/tenants`

Provision and manage gym tenants (used by Super Admins in multi-tenant/franchise deployments).

---

### GET `/api/tenants`

List all tenants.

**Access:** Super Admin

**Responses:**
- `200 OK` — Returns array of tenant objects

---

### POST `/api/tenants`

Create a new tenant.

**Access:** Super Admin

**Request Body:**
```json
{
  "name": "FitZone Gym",
  "slug": "fitzone",
  "plan": "Starter",
  "logoUrl": "https://cdn.example.com/logo.png",
  "primaryColor": "#FF5733",
  "timezone": "America/New_York",
  "locale": "en",
  "currency": "USD",
  "customDomain": "fitzone.gym",
  "trialEndsAt": "2026-08-05T00:00:00Z"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | ✅ | Tenant display name |
| `slug` | string | ✅ | URL-safe unique identifier |
| `plan` | string | ❌ | Subscription plan: `Starter`, `Pro`, `Enterprise` (default: `Starter`) |
| `logoUrl` | string | ❌ | Logo image URL |
| `primaryColor` | string | ❌ | Hex brand color |
| `timezone` | string | ❌ | IANA timezone (default: `UTC`) |
| `locale` | string | ❌ | Locale code (default: `en`) |
| `currency` | string | ❌ | ISO 4217 currency code (default: `USD`) |
| `customDomain` | string | ❌ | White-label custom domain |
| `trialEndsAt` | datetime | ❌ | Trial expiry date |

**Responses:**
- `201 Created` — Tenant created, returns tenant object
- `400 Bad Request` — Validation failed

---

### GET `/api/tenants/{id}`

Get tenant details by ID.

**Access:** Super Admin

**Responses:**
- `200 OK` — Returns tenant object
- `404 Not Found` — Tenant not found

---

### PUT `/api/tenants/{id}`

Update tenant settings (branding, plan, status, etc.).

**Access:** Super Admin

**Request Body:** Same fields as `CreateTenantRequest` but all optional. Additionally:

| Field | Type | Description |
|---|---|---|
| `status` | string | Tenant status: `Active`, `Suspended`, `Trial` |
| `plan` | string | Updated plan |

**Responses:**
- `200 OK` — Tenant updated
- `404 Not Found` — Tenant not found

---

### DELETE `/api/tenants/{id}`

Delete (decommission) a tenant.

**Access:** Super Admin

**Responses:**
- `200 OK` — Tenant deleted
- `404 Not Found` — Tenant not found

---

### GET `/api/tenants/{tenantId}/branches`

List all branches belonging to a tenant.

**Access:** Super Admin, Org Admin

**Responses:**
- `200 OK` — Returns array of branch objects scoped to the tenant

---

## 6. Branches

**Base route:** `/api/branches`

Create and manage physical gym locations under a tenant.

---

### GET `/api/branches`

List all branches.

**Access:** admin

**Responses:**
- `200 OK` — Returns array of branch objects

---

### POST `/api/branches`

Create a new branch.

**Access:** admin

**Request Body:**
```json
{
  "tenantId": 1,
  "name": "Downtown Branch",
  "address": "123 Main St",
  "city": "New York",
  "country": "US",
  "phone": "+1-555-0100",
  "email": "downtown@fitzone.gym"
}
```

**Responses:**
- `201 Created` — Branch created
- `400 Bad Request` — Validation failed

---

### GET `/api/branches/{id}`

Get branch details by ID.

**Access:** admin

**Responses:**
- `200 OK` — Returns branch object
- `404 Not Found` — Branch not found

---

### PUT `/api/branches/{id}`

Update branch information.

**Access:** admin

**Responses:**
- `200 OK` — Branch updated
- `404 Not Found` — Branch not found

---

### DELETE `/api/branches/{id}`

Delete a branch.

**Access:** admin

**Responses:**
- `200 OK` — Branch deleted
- `404 Not Found` — Branch not found

---

## 7. Members

**Base route:** `/api/members`

Full lifecycle management for gym members — profiles, documents, notes, tags, and bulk operations.

---

### GET `/api/members?query={q}&status={s}&pageNumber={n}&pageSize={n}`

List members with optional search and filter.

**Access:** admin, trainer

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `query` | string | ❌ | Full-text search (name, email, phone) |
| `status` | string | ❌ | Filter by membership status |
| `pageNumber` | int | ❌ | Page number (default: 1) |
| `pageSize` | int | ❌ | Page size (default: 20) |

**Responses:**
- `200 OK` — Returns paged list of member objects

---

### POST `/api/members`

Create a new member.

**Access:** admin

**Request Body:**
```json
{
  "tenantId": 1,
  "email": "jane@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "phone": "+1-555-0101",
  "gender": "female",
  "dob": "1995-06-15",
  "avatarUrl": "https://cdn.example.com/avatar.jpg",
  "notes": "Referred by trainer Mark"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `tenantId` | ulong | ✅ | Tenant the member belongs to |
| `email` | string | ✅ | Member email (unique per tenant) |
| `firstName` | string | ✅ | First name |
| `lastName` | string | ✅ | Last name |
| `phone` | string | ❌ | Phone number |
| `gender` | string | ❌ | `male`, `female`, `other` |
| `dob` | date | ❌ | Date of birth (ISO 8601: `YYYY-MM-DD`) |
| `avatarUrl` | string | ❌ | Profile photo URL |
| `notes` | string | ❌ | Internal admin notes |

**Responses:**
- `201 Created` — Member created, returns member object
- `400 Bad Request` — Validation failed

---

### GET `/api/members/{id}`

Get member profile by ID.

**Access:** admin, trainer, client

**Responses:**
- `200 OK` — Returns member object
- `404 Not Found` — Member not found

---

### PUT `/api/members/{id}`

Update member profile.

**Access:** admin, trainer

**Responses:**
- `200 OK` — Member updated
- `404 Not Found` — Member not found

---

### DELETE `/api/members/{id}`

Archive (soft-delete) a member.

**Access:** admin

**Responses:**
- `200 OK` — Member archived
- `404 Not Found` — Member not found

---

### POST `/api/members/bulk`

Bulk import members from a structured list.

**Access:** admin

**Request Body:**
```json
{
  "tenantId": 1,
  "members": [
    { "email": "a@example.com", "firstName": "Alice", "lastName": "A" },
    { "email": "b@example.com", "firstName": "Bob",   "lastName": "B" }
  ]
}
```

**Responses:**
- `200 OK` — Returns import summary with success count and any errors per row

---

### GET `/api/members/{id}/timeline`

Get a member's full activity timeline (check-ins, workouts, payments, notes).

**Access:** admin, trainer, client

**Responses:**
- `200 OK` — Returns ordered list of timeline events

---

### POST `/api/members/{id}/photo`

Upload a member profile photo.

**Access:** admin, trainer, client

**Request:** `multipart/form-data` with file field `photo`

**Responses:**
- `200 OK` — Returns `{ "url": "https://cdn.example.com/photo.jpg" }`

---

### GET `/api/members/{id}/notes`

Get all trainer/admin notes for a member.

**Access:** admin, trainer

**Responses:**
- `200 OK` — Returns list of note objects

---

### POST `/api/members/{id}/notes`

Add a note to a member's record.

**Access:** admin, trainer

**Request Body:**
```json
{
  "content": "Member is progressing well. Increased weights on squats.",
  "isPrivate": false
}
```

**Responses:**
- `200 OK` — Note added, returns note object

---

### GET `/api/members/{id}/documents`

Get uploaded documents for a member (waivers, ID, etc.).

**Access:** admin, trainer, client

**Responses:**
- `200 OK` — Returns list of document objects

---

### POST `/api/members/{id}/documents?documentType={type}`

Upload a document for a member.

**Access:** admin, trainer, client

**Request:** `multipart/form-data` with file field `file`

**Query Params:**

| Param | Type | Description |
|---|---|---|
| `documentType` | string | e.g. `id`, `waiver`, `medical-cert` |

**Responses:**
- `200 OK` — Document uploaded, returns document URL

---

### GET `/api/members/search?query={q}&status={s}&pageNumber={n}&pageSize={n}`

Search members (alias for GET `/api/members` with filter).

**Access:** admin, trainer

**Responses:**
- `200 OK` — Returns paged search results

---

### GET `/api/members/{id}/tags`

Get tags assigned to a member.

**Access:** admin, trainer

**Responses:**
- `200 OK` — Returns list of tag strings

---

### POST `/api/members/{id}/tags`

Assign tags to a member.

**Access:** admin

**Request Body:**
```json
{
  "tags": ["vip", "corporate", "at-risk"]
}
```

**Responses:**
- `200 OK` — Tags assigned

---

## 8. Trainers

**Base route:** `/api/trainers`

Manage trainer profiles, client assignments, schedules, earnings, and performance.

---

### GET `/api/trainers?pageNumber={n}&pageSize={n}`

List all trainers (paginated).

**Access:** admin, trainer, client

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `pageNumber` | int | ❌ | Page number (default: 1) |
| `pageSize` | int | ❌ | Page size (default: 20) |

**Responses:**
- `200 OK` — Returns paged list of trainer objects

---

### POST `/api/trainers`

Create a new trainer profile.

**Access:** admin

**Request Body (summary — see full model below):**
```json
{
  "branchId": 1,
  "trainerCode": "TR-001",
  "displayName": "Mark Johnson",
  "bio": "Certified personal trainer with 8 years experience.",
  "experienceYears": 8,
  "gender": "male",
  "dateOfBirth": "1990-03-20",
  "phone": "+1-555-0200",
  "email": "mark@fitzone.gym",
  "specializations": ["strength", "HIIT"],
  "certifications": [
    {
      "certificateName": "NASM CPT",
      "issuedBy": "NASM",
      "issueDate": "2018-01-15",
      "expiryDate": "2026-01-15"
    }
  ],
  "employment": {
    "employmentType": "full-time",
    "joiningDate": "2022-06-01",
    "designation": "Senior Trainer"
  },
  "salary": {
    "salaryType": "fixed",
    "paymentCycle": "monthly",
    "currency": "USD",
    "basicSalary": 3500.00
  },
  "bookingSettings": {
    "canTakePersonalTraining": true,
    "maxClients": 20,
    "sessionDurationMinutes": 60
  },
  "commissionSettings": {
    "eligibleForMembershipCommission": true,
    "membershipCommissionPercentage": 10.0
  }
}
```

**Key Request Fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `branchId` | ulong | ✅ | Branch the trainer belongs to |
| `trainerCode` | string | ✅ | Unique trainer code |
| `displayName` | string | ❌ | Display name |
| `specializations` | string[] | ❌ | Areas of expertise |
| `certifications` | array | ❌ | Professional certifications |
| `employment` | object | ❌ | Employment type, dates, designation |
| `salary` | object | ❌ | Pay structure |
| `bookingSettings` | object | ❌ | Session capacity and booking rules |
| `commissionSettings` | object | ❌ | Commission eligibility and rates |
| `availability` | array | ❌ | Weekly availability slots |

**Responses:**
- `201 Created` — Trainer created
- `400 Bad Request` — Validation failed

---

### GET `/api/trainers/{id}`

Get trainer profile by ID.

**Access:** admin, trainer, client

**Responses:**
- `200 OK` — Returns trainer object
- `404 Not Found` — Trainer not found

---

### PUT `/api/trainers/{id}`

Update trainer profile.

**Access:** admin, trainer

**Responses:**
- `200 OK` — Trainer updated
- `404 Not Found` — Trainer not found

---

### GET `/api/trainers/{id}/clients`

Get all clients assigned to a trainer.

**Access:** admin, trainer

**Responses:**
- `200 OK` — Returns list of client (member) objects

---

### POST `/api/trainers/{id}/assign`

Assign a client to a trainer.

**Access:** admin

**Request Body:**
```json
{
  "memberId": 42,
  "sessionType": "personal-training",
  "notes": "Focus on weight loss"
}
```

**Responses:**
- `200 OK` — Client assigned

---

### DELETE `/api/trainers/{id}/clients/{cid}`

Remove client assignment from a trainer.

**Access:** admin

**Path Parameters:**

| Param | Description |
|---|---|
| `id` | Trainer ID |
| `cid` | Client (member) ID |

**Responses:**
- `200 OK` — Client unassigned
- `404 Not Found` — Assignment not found

---

### GET `/api/trainers/{id}/schedule`

Get trainer's weekly availability schedule.

**Access:** admin, trainer, client

**Responses:**
- `200 OK` — Returns schedule object with day-by-day availability

---

### PUT `/api/trainers/{id}/schedule`

Update trainer's availability schedule.

**Access:** admin, trainer

**Request Body:**
```json
{
  "slots": [
    { "day": "Monday", "startTime": "09:00", "endTime": "17:00", "isAvailable": true },
    { "day": "Wednesday", "startTime": "09:00", "endTime": "17:00", "isAvailable": true }
  ]
}
```

**Responses:**
- `200 OK` — Schedule updated

---

### GET `/api/trainers/{id}/performance`

Get trainer performance metrics (sessions delivered, client progress, ratings).

**Access:** admin, trainer

**Responses:**
- `200 OK` — Returns performance metrics object

---

### GET `/api/trainers/{id}/earnings?month={m}&year={y}`

Get trainer earnings for a given month/year.

**Access:** admin, trainer

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `month` | int | ❌ | Month (1–12, defaults to current month) |
| `year` | int | ❌ | Year (defaults to current year) |

**Responses:**
- `200 OK` — Returns earnings breakdown object

---

### POST `/api/trainers/auto-assign?clientId={id}&branchId={id}`

Auto-assign the best available trainer to a client at a given branch.

**Access:** admin

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `clientId` | ulong | ✅ | Member ID to assign |
| `branchId` | ulong | ✅ | Branch to scope the search |

**Responses:**
- `200 OK` — Returns assigned trainer object
- `404 Not Found` — No available trainers found

---

## 9. Leads

**Base route:** `/api/leads`

Manage the sales pipeline — track prospects, score them with AI, schedule follow-ups, and convert to members.

---

### GET `/api/leads`

List all leads with optional filters.

**Access:** admin, trainer

**Query Parameters (LeadListRequest):**

| Param | Type | Description |
|---|---|---|
| `tenantId` | ulong | Filter by tenant |
| `status` | string | Lead status filter |
| `source` | string | Lead source filter |
| `pageNumber` | int | Page number (default: 1) |
| `pageSize` | int | Page size (default: 20) |

**Responses:**
- `200 OK` — Returns paged list of lead objects

---

### POST `/api/leads`

Create a new lead.

**Access:** admin, trainer

**Request Body:**
```json
{
  "tenantId": 1,
  "firstName": "Sarah",
  "lastName": "Connor",
  "email": "sarah@example.com",
  "phone": "+1-555-0303",
  "source": "instagram",
  "notes": "Interested in weight loss program"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `tenantId` | ulong | ✅ | Tenant the lead belongs to |
| `firstName` | string | ❌ | First name |
| `lastName` | string | ❌ | Last name |
| `email` | string | ❌ | Email address |
| `phone` | string | ❌ | Phone number |
| `source` | string | ❌ | Lead source (e.g. `instagram`, `referral`, `walk-in`) |
| `notes` | string | ❌ | Internal notes |

**Responses:**
- `201 Created` — Lead created, returns lead object
- `400 Bad Request` — Validation failed

---

### GET `/api/leads/{id}`

Get lead details by ID.

**Access:** admin, trainer

**Responses:**
- `200 OK` — Returns lead object
- `404 Not Found` — Lead not found

---

### PUT `/api/leads/{id}`

Update lead information or status.

**Access:** admin, trainer

**Responses:**
- `200 OK` — Lead updated
- `404 Not Found` — Lead not found

---

### POST `/api/leads/{id}/convert`

Convert a lead into a full member.

**Access:** admin, trainer

**No request body.** The lead's data is used to create the member record.

**Responses:**
- `200 OK` — Lead converted to member, returns new member object
- `404 Not Found` — Lead not found

---

### GET `/api/leads/{id}/score`

Get the AI-generated lead quality score.

**Access:** admin, trainer

**Responses:**
- `200 OK` — Returns score object:
  ```json
  {
    "score": 82,
    "grade": "A",
    "factors": ["email provided", "high engagement", "referral source"]
  }
  ```
- `404 Not Found` — Lead not found

---

### POST `/api/leads/{id}/followup`

Log or schedule a follow-up activity for a lead.

**Access:** admin, trainer

**Request Body:**
```json
{
  "type": "call",
  "notes": "Discussed membership options",
  "scheduledAt": "2026-07-10T10:00:00Z"
}
```

**Responses:**
- `200 OK` — Follow-up recorded

---

### GET `/api/leads/sources?tenantId={id}`

Get lead count breakdown by source for analytics.

**Access:** admin

**Responses:**
- `200 OK` — Returns array of `{ "source": "instagram", "count": 45, "percentage": 32 }`

---

### POST `/api/leads/import`

Bulk import leads from a structured list.

**Access:** admin

**Request Body:**
```json
{
  "tenantId": 1,
  "leads": [
    { "firstName": "Alice", "email": "alice@ex.com", "source": "web" },
    { "firstName": "Bob",   "phone": "+1-555-0404", "source": "referral" }
  ]
}
```

**Responses:**
- `200 OK` — Returns import summary with success count and row-level errors

---

## 10. Onboarding

**Base route:** `/api/onboarding`

Manage member onboarding workflows — templates, step-by-step completion, assessments, and finalization.

---

### POST `/api/onboarding/start`

Start the onboarding flow for a member.

**Access:** admin, trainer

**Request Body:**
```json
{
  "memberId": 42,
  "tenantId": 1,
  "templateId": 5
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `memberId` | ulong | ✅ | Member to onboard |
| `tenantId` | ulong | ✅ | Tenant scope |
| `templateId` | ulong | ❌ | Onboarding template to use (uses default if omitted) |

**Responses:**
- `200 OK` — Onboarding started, returns onboarding session object
- `400 Bad Request` — Validation failed

---

### GET `/api/onboarding/{id}/status`

Get the onboarding progress status for a member.

**Access:** admin, trainer, client

**Path Parameters:**

| Param | Description |
|---|---|
| `id` | Member ID |

**Responses:**
- `200 OK` — Returns onboarding status with completed and pending steps
- `404 Not Found` — No onboarding session found

---

### PUT `/api/onboarding/{id}/step`

Submit data for a specific onboarding step.

**Access:** admin, trainer, client

**Request Body:**
```json
{
  "stepKey": "health-assessment",
  "data": {
    "hasHeartCondition": false,
    "currentActivityLevel": "sedentary",
    "fitnessGoal": "weight-loss"
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `stepKey` | string | ✅ | Step identifier from the template |
| `data` | object | ✅ | Step-specific JSON payload |

**Responses:**
- `200 OK` — Step submitted, returns updated onboarding status
- `404 Not Found` — Step key not found

---

### POST `/api/onboarding/assessments`

Submit a fitness/health assessment for a member.

**Access:** admin, trainer

**Request Body:**
```json
{
  "memberId": 42,
  "templateId": 3,
  "responses": {
    "weight": 80,
    "height": 175,
    "bodyFat": 22
  },
  "notes": "Initial assessment before program start"
}
```

**Responses:**
- `200 OK` — Assessment recorded

---

### GET `/api/onboarding/templates?tenantId={id}`

Get available onboarding templates for a tenant.

**Access:** admin, trainer

**Responses:**
- `200 OK` — Returns list of onboarding templates

---

### POST `/api/onboarding/templates`

Create a custom onboarding template.

**Access:** admin

**Request Body:**
```json
{
  "tenantId": 1,
  "name": "New Member Standard Onboarding",
  "description": "6-step onboarding for all new members",
  "steps": [
    { "stepKey": "personal-info",       "label": "Personal Information", "isRequired": true,  "sortOrder": 1 },
    { "stepKey": "health-assessment",   "label": "Health Assessment",    "isRequired": true,  "sortOrder": 2 },
    { "stepKey": "goal-setting",        "label": "Goal Setting",         "isRequired": true,  "sortOrder": 3 },
    { "stepKey": "waiver-signing",      "label": "Sign Liability Waiver","isRequired": true,  "sortOrder": 4 },
    { "stepKey": "trainer-assignment",  "label": "Trainer Assignment",   "isRequired": false, "sortOrder": 5 },
    { "stepKey": "plan-selection",      "label": "Plan Selection",       "isRequired": true,  "sortOrder": 6 }
  ]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `tenantId` | ulong | ✅ | Owning tenant |
| `name` | string | ✅ | Template name |
| `steps` | array | ✅ | Ordered list of steps |
| `steps[].stepKey` | string | ✅ | Unique step identifier |
| `steps[].isRequired` | bool | ✅ | Whether this step must be completed |
| `steps[].sortOrder` | byte | ✅ | Display order |

**Responses:**
- `200 OK` — Template created

---

### POST `/api/onboarding/{id}/complete`

Mark a member's onboarding as fully completed.

**Access:** admin, trainer

**Responses:**
- `200 OK` — Onboarding completed, returns final status
- `404 Not Found` — Onboarding session not found

---

## 11. Corporate Accounts

**Base route:** `/api/corporate/accounts`

Manage employer/corporate gym memberships including rosters and consolidated billing.

---

### GET `/api/corporate/accounts?pageNumber={n}&pageSize={n}`

List all corporate accounts.

**Access:** admin

**Responses:**
- `200 OK` — Returns paged list of corporate account objects

---

### POST `/api/corporate/accounts`

Create a new corporate account.

**Access:** admin

**Request Body:**
```json
{
  "tenantId": 1,
  "name": "Acme Corp",
  "contactEmail": "hr@acme.com",
  "contactPhone": "+1-555-0500",
  "maxMembers": 100
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `tenantId` | ulong | ✅ | Owning tenant |
| `name` | string | ✅ | Company name |
| `contactEmail` | string | ❌ | HR/admin contact email |
| `contactPhone` | string | ❌ | Contact phone |
| `maxMembers` | uint | ❌ | Maximum employee seats |

**Responses:**
- `201 Created` — Account created
- `400 Bad Request` — Validation failed

---

### GET `/api/corporate/accounts/{id}`

Get corporate account details.

**Access:** admin

**Responses:**
- `200 OK` — Returns corporate account object
- `404 Not Found` — Not found

---

### PUT `/api/corporate/accounts/{id}`

Update a corporate account.

**Access:** admin

**Request Body (all optional):**
```json
{
  "name": "Acme Corp (Updated)",
  "contactEmail": "newhr@acme.com",
  "maxMembers": 150,
  "status": "active"
}
```

**Responses:**
- `200 OK` — Account updated
- `404 Not Found` — Not found

---

### GET `/api/corporate/accounts/{id}/members`

List members enrolled under a corporate account.

**Access:** admin

**Responses:**
- `200 OK` — Returns list of member objects under this account

---

### POST `/api/corporate/accounts/{id}/members`

Add an employee to a corporate account.

**Access:** admin

**Request Body:**
```json
{
  "userId": 42,
  "planId": 5,
  "startsAt": "2026-08-01"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `userId` | ulong | ✅ | User ID to enroll |
| `planId` | ulong | ✅ | Membership plan to assign |
| `startsAt` | date | ✅ | Membership start date |

**Responses:**
- `200 OK` — Member added

---

### DELETE `/api/corporate/accounts/{id}/members/{uid}`

Remove an employee from a corporate account.

**Access:** admin

**Path Parameters:**

| Param | Description |
|---|---|
| `id` | Corporate account ID |
| `uid` | User ID to remove |

**Responses:**
- `200 OK` — Member removed
- `404 Not Found` — Membership not found

---

### GET `/api/corporate/accounts/{id}/billing`

Get consolidated billing summary for a corporate account.

**Access:** admin

**Responses:**
- `200 OK` — Returns billing details (total seats, active, invoices)
- `404 Not Found` — Account not found

---

## 12. Exercises

**Base route:** `/api/exercises`

Manage the shared exercise library — create, tag, upload demo videos with coaching annotations.

---

### GET `/api/exercises`

List exercises with optional filters.

**Access:** All

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `tag` | string | ❌ | Filter by tag |
| `muscleId` | ushort | ❌ | Filter by muscle group ID |
| `equipmentId` | ushort | ❌ | Filter by equipment ID |
| `pageNumber` | int | ❌ | Page number (default: 1) |
| `pageSize` | int | ❌ | Page size (default: 20) |

**Responses:**
- `200 OK` — Returns paged list of exercise objects

---

### POST `/api/exercises`

Create a new exercise in the library.

**Access:** admin, trainer

**Request Body:**
```json
{
  "tenantId": 1,
  "name": "Barbell Back Squat",
  "description": "Compound lower-body movement.",
  "instructions": "1. Rack the bar. 2. Step under. 3. Squat to parallel.",
  "category": "Strength",
  "difficulty": "Intermediate",
  "tags": ["legs", "compound", "barbell"],
  "muscleIds": [3, 4],
  "equipmentIds": [1]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `tenantId` | ulong | ❌ | Tenant scope (null = global) |
| `name` | string | ✅ | Exercise name |
| `description` | string | ❌ | Short description |
| `instructions` | string | ❌ | Step-by-step instructions |
| `category` | string | ❌ | `Strength`, `Cardio`, `Flexibility`, `Balance` |
| `difficulty` | string | ❌ | `Beginner`, `Intermediate`, `Advanced` |
| `tags` | string[] | ❌ | Searchable tags |
| `muscleIds` | ushort[] | ❌ | Target muscle group IDs |
| `equipmentIds` | ushort[] | ❌ | Required equipment IDs |

**Responses:**
- `200 OK` — Exercise created
- `400 Bad Request` — Validation failed

---

### GET `/api/exercises/{id}`

Get exercise details by ID.

**Access:** All

**Responses:**
- `200 OK` — Returns exercise object
- `404 Not Found` — Exercise not found

---

### PUT `/api/exercises/{id}`

Update an exercise.

**Access:** admin, trainer

**Request Body (all optional):**
```json
{
  "name": "Barbell Squat",
  "description": "Updated description",
  "category": "Strength",
  "difficulty": "Advanced",
  "tags": ["legs", "powerlifting"]
}
```

**Responses:**
- `200 OK` — Exercise updated
- `404 Not Found` — Exercise not found

---

### DELETE `/api/exercises/{id}`

Delete an exercise from the library.

**Access:** admin, trainer

**Responses:**
- `200 OK` — Exercise deleted
- `404 Not Found` — Exercise not found

---

### GET `/api/exercises/{id}/alternatives`

Get alternative exercises targeting the same muscle group.

**Access:** All

**Responses:**
- `200 OK` — Returns list of alternative exercise objects

---

### POST `/api/exercises/{id}/video`

Upload a demo video for an exercise.

**Access:** admin, trainer

**Request:** `multipart/form-data` with file field `video`

**Responses:**
- `200 OK` — Returns `{ "url": "https://cdn.example.com/video.mp4" }`
- `404 Not Found` — Exercise not found

---

### POST `/api/exercises/{id}/video/annotate`

Add time-coded coaching annotations to an exercise video.

**Access:** admin, trainer

**Request Body:**
```json
{
  "annotations": [
    { "timeSeconds": 5,  "text": "Keep your chest up" },
    { "timeSeconds": 12, "text": "Drive through your heels" },
    { "timeSeconds": 20, "text": "Lock out at the top" }
  ]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `annotations[].timeSeconds` | int | ✅ | Video timestamp |
| `annotations[].text` | string | ✅ | Coaching cue text |

**Responses:**
- `200 OK` — Annotations saved

---

### GET `/api/exercises/tags`

Get all available exercise tags.

**Access:** All

**Responses:**
- `200 OK` — Returns list of tag strings

---

### GET `/api/exercises/muscles`

Get all muscle group definitions.

**Access:** All

**Responses:**
- `200 OK` — Returns list of `{ "id": 3, "name": "Quadriceps" }`

---

### GET `/api/exercises/equipment`

Get exercises filtered by equipment type.

**Access:** All

**Query Parameters:** Same as `GET /api/exercises`

**Responses:**
- `200 OK` — Returns paged list of exercise objects

---

## 13. Workouts

**Base route:** `/api/workouts`

Create and manage workout sessions — assign to members, track completion, record scores and progress.

---

### GET `/api/workouts`

List workouts with optional filters.

**Access:** All

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `memberId` | ulong | ❌ | Filter by assigned member |
| `trainerId` | ulong | ❌ | Filter by creating trainer |
| `category` | string | ❌ | Workout category |
| `difficulty` | string | ❌ | `Beginner`, `Intermediate`, `Advanced` |
| `pageNumber` | int | ❌ | Page number (default: 1) |
| `pageSize` | int | ❌ | Page size (default: 20) |

**Responses:**
- `200 OK` — Returns paged list of workout objects

---

### POST `/api/workouts`

Create a new workout.

**Access:** admin, trainer

**Request Body:**
```json
{
  "tenantId": 1,
  "name": "Upper Body Strength Day A",
  "description": "Bench, rows, and shoulder work.",
  "category": "Strength",
  "goal": "MuscleGain",
  "difficulty": "Intermediate",
  "durationMin": 60,
  "isPublic": true,
  "tags": ["upper-body", "push-pull"]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `tenantId` | ulong | ✅ | Tenant scope |
| `name` | string | ✅ | Workout name |
| `category` | string | ❌ | Category label |
| `goal` | string | ❌ | `General`, `WeightLoss`, `MuscleGain`, `Endurance` |
| `difficulty` | string | ❌ | `Beginner`, `Intermediate`, `Advanced` |
| `durationMin` | ushort | ❌ | Estimated duration in minutes |
| `isPublic` | bool | ❌ | Visible to all members if true |
| `tags` | string[] | ❌ | Searchable tags |

**Responses:**
- `200 OK` — Workout created
- `400 Bad Request` — Validation failed

---

### GET `/api/workouts/{id}`

Get workout details by ID.

**Access:** All

**Responses:**
- `200 OK` — Returns workout object with exercises
- `404 Not Found` — Workout not found

---

### PUT `/api/workouts/{id}`

Update a workout.

**Access:** admin, trainer

**Responses:**
- `200 OK` — Workout updated
- `404 Not Found` — Workout not found

---

### DELETE `/api/workouts/{id}`

Delete a workout.

**Access:** admin, trainer

**Responses:**
- `200 OK` — Workout deleted
- `404 Not Found` — Workout not found

---

### POST `/api/workouts/{id}/clone`

Clone a workout to create a new editable copy.

**Access:** admin, trainer

**Responses:**
- `200 OK` — Returns cloned workout object
- `404 Not Found` — Workout not found

---

### POST `/api/workouts/assign`

Assign a workout to one or more members.

**Access:** admin, trainer

**Request Body:**
```json
{
  "workoutId": 10,
  "memberIds": [42, 43, 44],
  "trainerId": 5,
  "assignedAt": "2026-07-06",
  "dueDate": "2026-07-13",
  "notes": "Focus on form over weight"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `workoutId` | ulong | ✅ | Workout to assign |
| `memberIds` | ulong[] | ✅ | Target members |
| `trainerId` | ulong | ❌ | Assigning trainer |
| `assignedAt` | date | ✅ | Assignment date |
| `dueDate` | date | ❌ | Completion deadline |

**Responses:**
- `200 OK` — Workout assigned

---

### GET `/api/workouts/{id}/progress?clientId={id}`

Get workout progress data for a specific member.

**Access:** admin, trainer, client

**Responses:**
- `200 OK` — Returns progress object (sets completed, weight lifted, etc.)
- `404 Not Found` — No progress data found

---

### POST `/api/workouts/{id}/complete`

Log a completed workout session with all set data.

**Access:** admin, trainer, client

**Request Body:**
```json
{
  "clientId": 42,
  "startedAt": "2026-07-06T09:00:00Z",
  "endedAt": "2026-07-06T10:05:00Z",
  "calories": 420,
  "notes": "Felt strong today",
  "moodBefore": 7,
  "moodAfter": 9,
  "fatigueLevel": 6,
  "sets": [
    { "exerciseId": 1, "setNo": 1, "reps": 10, "weightKg": 80.0, "rpe": 7 },
    { "exerciseId": 1, "setNo": 2, "reps": 8,  "weightKg": 85.0, "rpe": 8 }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `clientId` | ulong | Member completing the workout |
| `startedAt` / `endedAt` | datetime | Session timestamps |
| `calories` | ushort | Estimated calories burned |
| `moodBefore` / `moodAfter` | byte | Mood score 1–10 |
| `fatigueLevel` | byte | Fatigue score 1–10 |
| `sets[].exerciseId` | ulong | Exercise performed |
| `sets[].reps` | ushort | Reps completed |
| `sets[].weightKg` | decimal | Weight used (kg) |
| `sets[].rpe` | byte | Rate of Perceived Exertion 1–10 |

**Responses:**
- `200 OK` — Workout logged
- `400 Bad Request` — Validation failed

---

### GET `/api/workouts/{id}/score?clientId={id}`

Get the performance score for a completed workout.

**Access:** admin, trainer, client

**Responses:**
- `200 OK` — Returns score object
- `404 Not Found` — No score found

---

### POST `/api/workouts/{id}/share`

Share a workout (makes it publicly visible or sends to a network).

**Access:** admin, trainer, client

**Responses:**
- `200 OK` — Workout shared

---

### POST `/api/workouts/{id}/bookmark`

Toggle bookmark on a workout for the current user.

**Access:** admin, trainer, client

**Responses:**
- `200 OK` — Bookmark toggled

---

## 14. Workout Builder

**Base route:** `/api/workouts`

Advanced workout structure tools — build circuits, supersets, dropsets, pyramids, and configure tempo/rest/difficulty on any workout.

> All endpoints operate on an existing workout identified by `{id}`.

---

### POST `/api/workouts/{id}/circuits`

Add a circuit block to a workout.

**Access:** admin, trainer

**Request Body:**
```json
{
  "name": "Leg Circuit A",
  "rounds": 4,
  "restBetweenRoundsSec": 60,
  "exercises": [
    { "exerciseId": 1, "reps": 12, "restSec": 20 },
    { "exerciseId": 2, "reps": 10, "restSec": 20 }
  ]
}
```

**Responses:**
- `200 OK` — Circuit added

---

### PUT `/api/workouts/{id}/circuits/{cid}`

Update an existing circuit block.

**Access:** admin, trainer

**Path Parameters:**

| Param | Description |
|---|---|
| `id` | Workout ID |
| `cid` | Circuit ID |

**Responses:**
- `200 OK` — Circuit updated
- `404 Not Found` — Circuit not found

---

### POST `/api/workouts/{id}/supersets`

Add a superset (paired exercises performed back-to-back) to a workout.

**Access:** admin, trainer

**Request Body:**
```json
{
  "exercises": [
    { "exerciseId": 3, "sets": 3, "reps": 10 },
    { "exerciseId": 4, "sets": 3, "reps": 12 }
  ],
  "restBetweenSetsSec": 45
}
```

**Responses:**
- `200 OK` — Superset added

---

### POST `/api/workouts/{id}/dropsets`

Add a dropset configuration to a workout.

**Access:** admin, trainer

**Request Body:**
```json
{
  "exerciseId": 5,
  "drops": [
    { "weightKg": 80, "reps": 8 },
    { "weightKg": 60, "reps": 10 },
    { "weightKg": 40, "reps": 12 }
  ]
}
```

**Responses:**
- `200 OK` — Dropset added

---

### POST `/api/workouts/{id}/pyramids`

Add a pyramid set structure to a workout.

**Access:** admin, trainer

**Request Body:**
```json
{
  "exerciseId": 1,
  "type": "ascending",
  "sets": [
    { "reps": 12, "weightKg": 60 },
    { "reps": 10, "weightKg": 70 },
    { "reps": 8,  "weightKg": 80 },
    { "reps": 6,  "weightKg": 90 }
  ]
}
```

**Responses:**
- `200 OK` — Pyramid added

---

### PUT `/api/workouts/{id}/tempo`

Configure lifting tempo for exercises in the workout.

**Access:** admin, trainer

**Request Body:**
```json
{
  "exerciseId": 1,
  "eccentricSec": 3,
  "pauseSec": 1,
  "concentricSec": 1,
  "topPauseSec": 0
}
```

**Responses:**
- `200 OK` — Tempo configured

---

### PUT `/api/workouts/{id}/rest-intervals`

Set rest interval rules for the workout.

**Access:** admin, trainer

**Request Body:**
```json
{
  "betweenSetsSec": 90,
  "betweenExercisesSec": 120,
  "afterWarmupSec": 60
}
```

**Responses:**
- `200 OK` — Rest intervals configured

---

### POST `/api/workouts/{id}/timer`

Attach a timer/interval configuration (e.g. AMRAP, EMOM, Tabata).

**Access:** admin, trainer

**Request Body:**
```json
{
  "timerType": "EMOM",
  "durationMin": 20,
  "intervalSec": 60,
  "workSec": 45,
  "restSec": 15
}
```

**Responses:**
- `200 OK` — Timer configured

---

### PUT `/api/workouts/{id}/difficulty`

Set the auto-adjustment difficulty level for the workout.

**Access:** admin, trainer

**Request Body:**
```json
{
  "difficulty": "Advanced",
  "autoAdjust": true,
  "adjustmentRules": {
    "increaseWeightAfterSuccessfulSets": 2,
    "increaseWeightByKg": 2.5
  }
}
```

**Responses:**
- `200 OK` — Difficulty configured

---

## 15. Workout Plans

**Base route:** `/api/plans`

Multi-week structured training programs with progression trees, branch logic, and member assignment.

---

### GET `/api/plans`

List workout plans.

**Access:** All

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `tenantId` | ulong | ❌ | Filter by tenant |
| `goal` | string | ❌ | Filter by goal: `General`, `WeightLoss`, `MuscleGain`, `Endurance` |
| `pageNumber` | int | ❌ | Page number (default: 1) |
| `pageSize` | int | ❌ | Page size (default: 20) |

**Responses:**
- `200 OK` — Returns paged list of plan objects

---

### POST `/api/plans`

Create a new multi-week training plan.

**Access:** admin, trainer

**Request Body:**
```json
{
  "tenantId": 1,
  "name": "12-Week Strength Builder",
  "description": "Progressive overload program for intermediate lifters.",
  "durationWeeks": 12,
  "goal": "MuscleGain",
  "difficulty": "Intermediate"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `tenantId` | ulong | ✅ | Owning tenant |
| `name` | string | ✅ | Plan name |
| `durationWeeks` | byte | ✅ | Plan length in weeks |
| `goal` | string | ❌ | Training goal |
| `difficulty` | string | ❌ | Difficulty level |

**Responses:**
- `200 OK` — Plan created
- `400 Bad Request` — Validation failed

---

### GET `/api/plans/{id}`

Get plan details by ID.

**Access:** All

**Responses:**
- `200 OK` — Returns plan object
- `404 Not Found` — Plan not found

---

### PUT `/api/plans/{id}`

Update a plan's metadata.

**Access:** admin, trainer

**Request Body (all optional):**
```json
{
  "name": "12-Week Hypertrophy",
  "durationWeeks": 12,
  "goal": "MuscleGain",
  "difficulty": "Advanced",
  "isActive": true
}
```

**Responses:**
- `200 OK` — Plan updated
- `404 Not Found` — Plan not found

---

### DELETE `/api/plans/{id}`

Delete a workout plan.

**Access:** admin

**Responses:**
- `200 OK` — Plan deleted
- `404 Not Found` — Plan not found

---

### GET `/api/plans/{id}/tree`

Get the progression tree structure of a plan (branches, conditions, next plans).

**Access:** All

**Responses:**
- `200 OK` — Returns tree/graph structure with all branches
- `404 Not Found` — Plan not found

---

### POST `/api/plans/{id}/branch`

Add a conditional branch (next plan logic) to the progression tree.

**Access:** admin, trainer

**Request Body:**
```json
{
  "name": "Advanced Route",
  "condition": { "completionRate": { "gte": 90 } },
  "nextPlanId": 8,
  "sortOrder": 1
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | ✅ | Branch label |
| `condition` | JSON | ✅ | JSON rule that triggers this branch |
| `nextPlanId` | ulong | ❌ | Plan to transition to when condition is met |
| `sortOrder` | byte | ✅ | Evaluation priority order |

**Responses:**
- `200 OK` — Branch added

---

### PUT `/api/plans/{id}/progression`

Update the auto-progression rules for a plan.

**Access:** admin, trainer

**Request Body:**
```json
{
  "rules": {
    "autoAdvanceOnCompletion": true,
    "minimumWeeksRequired": 4,
    "evaluationFrequencyWeeks": 2
  }
}
```

**Responses:**
- `200 OK` — Progression rules updated
- `404 Not Found` — Plan not found

---

### POST `/api/plans/{id}/assign`

Assign a workout plan to one or more members.

**Access:** admin, trainer

**Request Body:**
```json
{
  "memberIds": [42, 43],
  "trainerId": 5,
  "startDate": "2026-08-01"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `memberIds` | ulong[] | ✅ | Target members |
| `trainerId` | ulong | ❌ | Responsible trainer |
| `startDate` | date | ✅ | Plan start date |

**Responses:**
- `200 OK` — Plan assigned

---

### GET `/api/plans/{id}/members`

List all members assigned to a plan.

**Access:** admin, trainer

**Responses:**
- `200 OK` — Returns list of member assignments

---

### GET `/api/plans/{id}/analytics`

Get performance analytics for a plan (completion rates, average scores, drop-off points).

**Access:** admin, trainer

**Responses:**
- `200 OK` — Returns analytics object
- `404 Not Found` — Plan not found

---

## 16. Workout Automation

**Base route:** `/api/workout-automation`

Create event-driven rules that automatically assign or adjust workout plans, and monitor their execution logs.

---

### GET `/api/workout-automation/rules?tenantId={id}`

List all automation rules for a tenant.

**Access:** admin, trainer

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `tenantId` | ulong | ✅ | Tenant scope |

**Responses:**
- `200 OK` — Returns list of automation rule objects

---

### POST `/api/workout-automation/rules`

Create a new workout automation rule.

**Access:** admin, trainer

**Request Body:**
```json
{
  "tenantId": 1,
  "name": "Auto-assign beginner plan on signup",
  "triggerEvent": "member.created",
  "conditions": {
    "memberTag": "beginner"
  },
  "actions": {
    "assignPlanId": 3,
    "startOffsetDays": 0
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `tenantId` | ulong | ✅ | Owning tenant |
| `name` | string | ✅ | Rule name |
| `triggerEvent` | string | ✅ | Event that fires the rule (e.g. `member.created`, `plan.completed`, `checkin.missed`) |
| `conditions` | JSON | ❌ | Optional filter conditions (JSON object) |
| `actions` | JSON | ✅ | Actions to execute when triggered (JSON object) |

**Common `triggerEvent` values:**

| Event | Description |
|---|---|
| `member.created` | New member registered |
| `plan.completed` | Member completed a plan |
| `checkin.missed` | Member missed scheduled check-in |
| `workout.completed` | Member completed a workout session |
| `subscription.expired` | Membership subscription expired |

**Responses:**
- `200 OK` — Rule created
- `400 Bad Request` — Validation failed

---

### PUT `/api/workout-automation/rules/{id}`

Update an automation rule.

**Access:** admin, trainer

**Request Body (all optional):**
```json
{
  "name": "Updated rule name",
  "triggerEvent": "plan.completed",
  "conditions": { "completionRate": { "gte": 85 } },
  "actions": { "assignPlanId": 5 },
  "isActive": true
}
```

**Responses:**
- `200 OK` — Rule updated
- `404 Not Found` — Rule not found

---

### DELETE `/api/workout-automation/rules/{id}`

Delete an automation rule.

**Access:** admin, trainer

**Responses:**
- `200 OK` — Rule deleted
- `404 Not Found` — Rule not found

---

### POST `/api/workout-automation/trigger`

Manually trigger an automation rule (for testing or one-off execution).

**Access:** admin, trainer

**Request Body:**
```json
{
  "ruleId": 7,
  "targetUserId": 42,
  "context": {
    "reason": "manual-test"
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `ruleId` | ulong | ✅ | Rule to execute |
| `targetUserId` | ulong | ❌ | Member to run the rule for |
| `context` | JSON | ❌ | Additional context passed to the rule |

**Responses:**
- `200 OK` — Rule triggered, returns execution result
- `400 Bad Request` — Validation failed

---

### GET `/api/workout-automation/logs`

Get automation execution logs.

**Access:** admin, trainer

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `ruleId` | ulong | ❌ | Filter by specific rule |
| `pageNumber` | int | ❌ | Page number (default: 1) |
| `pageSize` | int | ❌ | Page size (default: 20) |

**Responses:**
- `200 OK` — Returns paged list of execution log entries:
  ```json
  [
    {
      "id": 100,
      "ruleId": 7,
      "ruleName": "Auto-assign beginner plan on signup",
      "targetUserId": 42,
      "status": "success",
      "executedAt": "2026-07-05T09:00:00Z",
      "details": "Assigned plan #3 to member #42"
    }
  ]
  ```

---

## HTTP Status Code Reference

| Code | Meaning |
|---|---|
| `200 OK` | Request succeeded |
| `201 Created` | Resource created |
| `400 Bad Request` | Validation error or bad input |
| `401 Unauthorized` | Authentication required or failed |
| `403 Forbidden` | Authenticated but insufficient permissions |
| `404 Not Found` | Resource does not exist |
| `409 Conflict` | Resource conflict (e.g. duplicate email) |
| `500 Internal Server Error` | Unhandled server error |

---

## Pagination

All list endpoints that support pagination follow this pattern:

**Query Parameters:**
- `pageNumber` (int, default: 1)
- `pageSize` (int, default: 20)

**Response envelope for paged results:**
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pageNumber": 1,
    "pageSize": 20,
    "totalCount": 150,
    "totalPages": 8
  }
}
```

---

## Roles Reference

| Role | Description |
|---|---|
| `admin` | Full access within the tenant |
| `trainer` | Access to assigned members, workouts, schedules |
| `client` | Read-only access to own data |
| Super Admin | Cross-tenant access (platform-level) |

Custom roles can be created via [Roles & Permissions](#3-roles--permissions) and granted fine-grained access down to individual endpoints.

---

*Documentation generated from source — July 5, 2026*
