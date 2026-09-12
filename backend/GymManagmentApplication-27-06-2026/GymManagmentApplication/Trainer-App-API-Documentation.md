# Enterprise Gym Platform — Trainer App API Documentation

> **Base URL:** `https://<host>/api`
> **Version:** 1.0 | **Date:** July 5, 2026
> **Auth:** JWT Bearer token — `Authorization: Bearer <token>`
> **Scope:** Trainer / Coaching Staff experience only. Admin and Member endpoints are documented separately.

---

## Implementation Status Legend

| Badge | Meaning |
|---|---|
| ✅ Implemented | Controller and service exist in the current codebase |
| 🔜 Planned | Defined in the PRD; full API contract specified; not yet built |

> **Data Boundary Rule:** All trainer-scoped endpoints are filtered server-side to the authenticated trainer's own assignments. A trainer can never view or modify clients, sessions, earnings, or schedules outside their own scope.

---

## Response Envelope

All REST endpoints return a consistent wrapper:

```json
{
  "success": true,
  "message": "Operation successful.",
  "data": { },
  "errors": []
}
```

---

## Table of Contents

1. [Account & Authentication](#1-account--authentication)
2. [Trainer Profile & Schedule](#2-trainer-profile--schedule)
3. [Client Management](#3-client-management)
4. [Workout & Plan Building](#4-workout--plan-building)
5. [AI-Assisted Coaching Tools](#5-ai-assisted-coaching-tools)
6. [Personal Training Sessions](#6-personal-training-sessions)
7. [Classes & Group Session Delivery](#7-classes--group-session-delivery)
8. [Live & Realtime Coaching](#8-live--realtime-coaching)
9. [Communication & Notifications](#9-communication--notifications)
10. [Gamification & Community Participation](#10-gamification--community-participation)

---

## 1. Account & Authentication

**Base route:** `/api/auth` | `/api/auth/sso` | `/api/permissions`

Trainers authenticate as staff accounts (`role: trainer`) and view their own assigned permissions.

---

### ✅ POST `/api/auth/login`

Authenticate with email and password.

**Access:** Public

**Request Body:**
```json
{
  "email": "mark.trainer@fitzone.gym",
  "password": "StaffPass123!"
}
```

**Response Data:**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "dGhp...",
  "expiresAt": "2026-07-05T18:00:00Z",
  "role": "trainer",
  "userId": 5,
  "email": "mark.trainer@fitzone.gym"
}
```

**Responses:**
- `200 OK` — Login successful
- `401 Unauthorized` — Invalid credentials

---

### ✅ POST `/api/auth/logout`

Invalidate the current trainer session.

**Access:** Authenticated trainer

**No body required.** User ID resolved from JWT.

**Responses:**
- `200 OK` — Logged out

---

### ✅ POST `/api/auth/refresh-token`

Exchange a refresh token for a new access token.

**Access:** Public

**Request Body:**
```json
{
  "refreshToken": "dGhp..."
}
```

**Responses:**
- `200 OK` — Returns new `AuthResponse`
- `401 Unauthorized` — Refresh token expired or invalid

---

### ✅ PUT `/api/auth/change-password`

Change own password while authenticated.

**Access:** Authenticated trainer

**Request Body:**
```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass456!"
}
```

**Responses:**
- `200 OK` — Password changed
- `400 Bad Request` — Current password incorrect

---

### ✅ GET `/api/auth/me`

Get the authenticated trainer's own account profile.

**Access:** Authenticated trainer

**Response Data:**
```json
{
  "userId": 5,
  "email": "mark.trainer@fitzone.gym",
  "firstName": "Mark",
  "lastName": "Johnson",
  "role": "trainer",
  "isEmailVerified": true
}
```

---

### ✅ POST `/api/auth/sso/init`

Initiate SSO login for trainers on tenants with staff SSO enabled.

**Access:** Public

**Request Body:**
```json
{
  "provider": "microsoft",
  "redirectUri": "https://trainer.gymname.com/auth/callback"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `provider` | string | ✅ | `google`, `microsoft`, `apple` |
| `redirectUri` | string | ✅ | OAuth callback URL |

**Response:** `{ "authorizationUrl": "https://login.microsoftonline.com/..." }`

---

### ✅ POST `/api/auth/sso/callback`

Complete the SSO flow and receive platform tokens.

**Access:** Public

**Request Body:**
```json
{
  "provider": "microsoft",
  "code": "0.AT4A...",
  "state": "state-token"
}
```

**Responses:**
- `200 OK` — Returns `AuthResponse` with `role: trainer`
- `401 Unauthorized` — SSO authentication failed

---

### ✅ POST `/api/auth/forgot-password`

Trigger a password reset email for a trainer.

**Access:** Public

**Request Body:**
```json
{
  "email": "mark.trainer@fitzone.gym"
}
```

**Responses:**
- `200 OK` — Reset email sent (always 200 to prevent enumeration)

---

### ✅ POST `/api/auth/reset-password`

Reset password using the token from the reset email.

**Access:** Public

**Request Body:**
```json
{
  "token": "reset-token-from-email",
  "newPassword": "NewSecurePass123!"
}
```

**Responses:**
- `200 OK` — Password reset
- `400 Bad Request` — Invalid or expired token

---

### ✅ GET `/api/permissions/matrix`

View the full permissions matrix to understand what the trainer role can access.

**Access:** Authenticated trainer (read-only view)

**Response Data:**
```json
{
  "trainer": [
    "workouts.create", "workouts.edit.own", "plans.create",
    "members.view.assigned", "members.notes.add",
    "exercises.propose", "pt-sessions.manage.own",
    "classes.view.own", "earnings.view.own"
  ]
}
```

> Trainers can view this matrix read-only. Role assignments are admin-managed only.

---

## 2. Trainer Profile & Schedule

**Base route:** `/api/trainers`

Trainers view and edit their own professional profile, set weekly availability, and access their performance and earnings data.

---

### ✅ GET `/api/trainers/{id}`

Get own trainer profile.

**Access:** Authenticated trainer (own profile)

**Response Data:**
```json
{
  "id": 1,
  "userId": 5,
  "branchId": 2,
  "trainerCode": "TR-001",
  "displayName": "Mark Johnson",
  "bio": "Certified personal trainer with 8 years experience.",
  "experienceYears": 8,
  "gender": "male",
  "dateOfBirth": "1990-03-20",
  "phone": "+1-555-0200",
  "email": "mark.trainer@fitzone.gym",
  "specializations": ["strength", "HIIT"],
  "certifications": [
    { "certificateName": "NASM CPT", "issuedBy": "NASM", "issueDate": "2018-01-15", "expiryDate": "2026-01-15" }
  ],
  "employment": { "employmentType": "full-time", "designation": "Senior Trainer" },
  "bookingSettings": { "canTakePersonalTraining": true, "maxClients": 20, "sessionDurationMinutes": 60 },
  "rating": 4.8,
  "isAvailable": true,
  "createdAt": "2022-06-01T00:00:00Z"
}
```

**Responses:**
- `200 OK` — Returns trainer profile
- `404 Not Found` — Trainer not found

---

### ✅ PUT `/api/trainers/{id}`

Update own trainer profile — bio, contact details, availability flag.

**Access:** Authenticated trainer (own profile)

**Request Body (all fields optional):**
```json
{
  "displayName": "Mark J. Johnson",
  "bio": "8+ years specializing in strength and functional training.",
  "phone": "+1-555-0201",
  "email": "markj@fitzone.gym",
  "profileImage": "https://cdn.example.com/trainers/5/photo.jpg",
  "isAvailable": true
}
```

| Field | Type | Description |
|---|---|---|
| `displayName` | string | Displayed name in member-facing views |
| `bio` | string | Professional biography |
| `phone` | string | Contact phone |
| `email` | string | Contact email |
| `profileImage` | string | URL to profile photo |
| `isAvailable` | bool | Whether the trainer is accepting new clients/bookings |

**Responses:**
- `200 OK` — Profile updated
- `404 Not Found` — Trainer not found

---

### ✅ GET `/api/trainers/{id}/schedule`

Get the trainer's current weekly availability schedule.

**Access:** Authenticated trainer (own schedule)

**Response Data:**
```json
[
  { "dayOfWeek": 1, "startTime": "09:00:00", "endTime": "17:00:00", "isActive": true  },
  { "dayOfWeek": 2, "startTime": "09:00:00", "endTime": "13:00:00", "isActive": true  },
  { "dayOfWeek": 3, "startTime": "09:00:00", "endTime": "17:00:00", "isActive": true  },
  { "dayOfWeek": 5, "startTime": "09:00:00", "endTime": "17:00:00", "isActive": true  }
]
```

> `dayOfWeek` uses ISO convention: `1` = Monday … `7` = Sunday.

---

### ✅ PUT `/api/trainers/{id}/schedule`

Set or replace the trainer's weekly availability slots.

**Access:** Authenticated trainer (own schedule)

**Request Body:**
```json
{
  "slots": [
    { "dayOfWeek": 1, "startTime": "09:00:00", "endTime": "17:00:00", "isActive": true  },
    { "dayOfWeek": 2, "startTime": "09:00:00", "endTime": "13:00:00", "isActive": true  },
    { "dayOfWeek": 2, "startTime": "14:00:00", "endTime": "18:00:00", "isActive": false },
    { "dayOfWeek": 3, "startTime": "09:00:00", "endTime": "17:00:00", "isActive": true  }
  ]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `slots[].dayOfWeek` | byte | ✅ | 1 (Monday) – 7 (Sunday) |
| `slots[].startTime` | time | ✅ | Slot start time (`HH:mm:ss`) |
| `slots[].endTime` | time | ✅ | Slot end time (`HH:mm:ss`) |
| `slots[].isActive` | bool | ✅ | `false` = blocked/unavailable |

**Responses:**
- `200 OK` — Schedule updated

> To block off an afternoon: submit that time range with `isActive: false`.

---

### ✅ GET `/api/trainers/{id}/performance`

View own performance metrics.

**Access:** Authenticated trainer (own data)

**Response Data:**
```json
{
  "trainerId": 1,
  "totalClients": 18,
  "totalSessions": 312,
  "rating": 4.8
}
```

| Field | Description |
|---|---|
| `totalClients` | Current number of assigned active clients |
| `totalSessions` | All-time sessions delivered |
| `rating` | Average member-submitted rating (1–5) |

---

### ✅ GET `/api/trainers/{id}/earnings?month={m}&year={y}`

View own commission and earnings breakdown for a specific month.

**Access:** Authenticated trainer (own earnings)

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `month` | int | ❌ | Month 1–12 (defaults to current month) |
| `year` | int | ❌ | Year (defaults to current year) |

**Response Data:**
```json
{
  "trainerId": 1,
  "month": 7,
  "year": 2026,
  "totalEarnings": 4250.00,
  "commissionEarned": 750.00
}
```

| Field | Description |
|---|---|
| `totalEarnings` | Base salary + all commission for the period |
| `commissionEarned` | Commission portion (PT, memberships, supplements) |

---

## 3. Client Management

**Base route:** `/api/trainers` | `/api/members`

Trainers view only the clients assigned to them. They can add private notes, review documents, and manage client assignments.

---

### ✅ GET `/api/trainers/{id}/clients`

Get the full list of clients currently assigned to this trainer.

**Access:** Authenticated trainer (own clients only)

**Response Data:**
```json
[
  {
    "assignmentId": 10,
    "clientId": 42,
    "status": "Active",
    "assignedAt": "2026-03-01T00:00:00Z"
  },
  {
    "assignmentId": 11,
    "clientId": 55,
    "status": "Active",
    "assignedAt": "2026-05-15T00:00:00Z"
  }
]
```

| Field | Description |
|---|---|
| `assignmentId` | Trainer-client assignment record ID |
| `clientId` | Member's user ID — use to call `/api/members/{id}` for full profile |
| `status` | `Active`, `Paused`, `Completed` |

---

### ✅ GET `/api/members/{id}`

View an assigned client's full profile.

**Access:** Authenticated trainer (assigned clients only)

**Response Data:**
```json
{
  "id": 42,
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@example.com",
  "phone": "+1-555-0101",
  "gender": "female",
  "dob": "1995-06-15",
  "status": "Active",
  "trainerId": 1,
  "branchId": 2,
  "createdAt": "2026-01-10T00:00:00Z"
}
```

---

### ✅ GET `/api/members/{id}/timeline`

View a client's full activity timeline — check-ins, completed workouts, plan changes, payments.

**Access:** Authenticated trainer (assigned clients only)

**Response Data:**
```json
[
  {
    "eventType": "WorkoutCompleted",
    "description": "Completed Upper Body Strength Day A",
    "occurredAt": "2026-07-04T10:30:00Z"
  },
  {
    "eventType": "CheckIn",
    "description": "Checked in at Downtown Branch",
    "occurredAt": "2026-07-04T09:55:00Z"
  },
  {
    "eventType": "PlanAssigned",
    "description": "Assigned to 12-Week Strength Builder",
    "occurredAt": "2026-06-01T08:00:00Z"
  }
]
```

---

### ✅ GET `/api/members/{id}/notes`

View all trainer notes on a client.

**Access:** Authenticated trainer (assigned clients only)

**Response Data:**
```json
[
  {
    "id": 1,
    "note": "Client reports left knee discomfort. Avoid lunges and deep squats for now.",
    "trainerId": 1,
    "createdAt": "2026-07-03T11:00:00Z"
  }
]
```

---

### ✅ POST `/api/members/{id}/notes`

Add a trainer note to a client's record.

**Access:** Authenticated trainer (assigned clients only)

**Request Body:**
```json
{
  "note": "Increased bench press to 85kg today — great form. Ready to progress next session.",
  "trainerId": 1
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `note` | string | ✅ | Note content (visible to all assigned trainers) |
| `trainerId` | ulong | ✅ | Authoring trainer ID |

**Responses:**
- `200 OK` — Note added, returns note object

---

### ✅ GET `/api/members/{id}/documents`

View a client's uploaded documents (medical clearance, PAR-Q, consent forms).

**Access:** Authenticated trainer (assigned clients only)

**Response Data:**
```json
[
  {
    "id": 3,
    "fileName": "parq-form.pdf",
    "url": "https://cdn.example.com/docs/parq-form.pdf",
    "documentType": "parq",
    "uploadedAt": "2026-01-10T09:00:00Z"
  }
]
```

---

### ✅ POST `/api/trainers/{id}/assign`

Accept a manually assigned client (or confirm an auto-assignment).

**Access:** Authenticated trainer (own assignment)

**Request Body:**
```json
{
  "clientId": 42,
  "branchId": 2,
  "notes": "Client referred by front desk — focused on weight loss"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `clientId` | ulong | ✅ | Member ID to assign |
| `branchId` | ulong | ✅ | Branch where sessions will take place |
| `notes` | string | ❌ | Initial assignment notes |

**Responses:**
- `200 OK` — Client assigned, returns assignment object

---

### ✅ DELETE `/api/trainers/{id}/clients/{cid}`

Remove (unassign) a client from the trainer's roster.

**Access:** Authenticated trainer (own assignments) | admin

**Path Parameters:**

| Param | Description |
|---|---|
| `id` | Trainer ID |
| `cid` | Client (member) ID |

**Responses:**
- `200 OK` — Client unassigned
- `404 Not Found` — Assignment not found

---

### ✅ POST `/api/trainers/auto-assign?clientId={id}&branchId={id}`

Request the system to auto-assign the best available trainer at a branch for a client.

**Access:** admin (triggered on behalf of trainer)

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `clientId` | ulong | ✅ | Member to assign |
| `branchId` | ulong | ✅ | Branch to scope the search |

**Responses:**
- `200 OK` — Returns the trainer who was auto-assigned
- `404 Not Found` — No available trainers found at this branch

---

## 4. Workout & Plan Building

**Base route:** `/api/exercises` | `/api/workouts` | `/api/plans`

Trainers build workouts and multi-week plans for their clients using the exercise library and advanced builder tools.

---

### ✅ GET `/api/exercises`

Browse the exercise library.

**Access:** Authenticated trainer

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `tag` | string | Filter by tag (e.g. `legs`, `push`, `pull`) |
| `muscleId` | ushort | Filter by muscle group ID |
| `equipmentId` | ushort | Filter by equipment ID |
| `pageNumber` | int | Page (default: 1) |
| `pageSize` | int | Items per page (default: 20) |

**Response Data:**
```json
{
  "items": [
    {
      "id": 1,
      "name": "Barbell Back Squat",
      "category": "Strength",
      "difficulty": "Intermediate",
      "tags": ["legs", "compound"],
      "videoUrl": "https://cdn.example.com/exercises/squat.mp4"
    }
  ],
  "totalCount": 240,
  "pageNumber": 1,
  "pageSize": 20
}
```

---

### ✅ POST `/api/exercises`

Propose a new custom exercise for the library.

**Access:** Authenticated trainer

> New exercises submitted by trainers require admin approval before being published to the shared library.

**Request Body:**
```json
{
  "tenantId": 1,
  "name": "Landmine Press",
  "description": "Shoulder-friendly pressing variation using a landmine attachment.",
  "instructions": "1. Load one end of barbell. 2. Press from shoulder height. 3. Control descent.",
  "category": "Strength",
  "difficulty": "Intermediate",
  "tags": ["shoulders", "press", "unilateral"],
  "muscleIds": [6, 7],
  "equipmentIds": [2]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | ✅ | Exercise name |
| `category` | string | ❌ | `Strength`, `Cardio`, `Flexibility`, `Balance` |
| `difficulty` | string | ❌ | `Beginner`, `Intermediate`, `Advanced` |
| `tags` | string[] | ❌ | Searchable tags |
| `muscleIds` | ushort[] | ❌ | Target muscle groups |
| `equipmentIds` | ushort[] | ❌ | Required equipment |

**Responses:**
- `200 OK` — Exercise created (status: `pending_review`)

---

### ✅ POST `/api/exercises/{id}/video`

Upload a demo video for an exercise.

**Access:** Authenticated trainer

**Request:** `multipart/form-data` — field name: `video`

**Response:** `{ "url": "https://cdn.example.com/exercises/101/demo.mp4" }`

---

### ✅ POST `/api/exercises/{id}/video/annotate`

Add time-coded coaching annotations to an exercise video.

**Access:** Authenticated trainer

**Request Body:**
```json
{
  "annotations": [
    { "timeSeconds": 4,  "text": "Grip slightly wider than shoulder-width" },
    { "timeSeconds": 10, "text": "Press at a 45° angle, not straight up" }
  ]
}
```

**Responses:**
- `200 OK` — Annotations saved

---

### ✅ POST `/api/workouts`

Create a new workout for a client.

**Access:** Authenticated trainer

**Request Body:**
```json
{
  "tenantId": 1,
  "name": "Client Jane — Upper Body Day A",
  "description": "Chest and back hypertrophy focus",
  "category": "Strength",
  "goal": "MuscleGain",
  "difficulty": "Intermediate",
  "durationMin": 60,
  "isPublic": false,
  "tags": ["upper-body", "hypertrophy"]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `tenantId` | ulong | ✅ | Tenant scope |
| `name` | string | ✅ | Workout name |
| `goal` | string | ❌ | `General`, `WeightLoss`, `MuscleGain`, `Endurance` |
| `difficulty` | string | ❌ | `Beginner`, `Intermediate`, `Advanced` |
| `isPublic` | bool | ❌ | `false` = private to trainer and assigned clients |

**Responses:**
- `200 OK` — Workout created, returns workout object

---

### ✅ PUT `/api/workouts/{id}`

Edit an existing workout.

**Access:** Authenticated trainer (own workouts)

**Request Body (all optional):**
```json
{
  "name": "Client Jane — Upper Body Day A (v2)",
  "difficulty": "Advanced",
  "durationMin": 70,
  "isPublic": false
}
```

---

### ✅ DELETE `/api/workouts/{id}`

Delete a workout.

**Access:** Authenticated trainer (own workouts)

**Responses:**
- `200 OK` — Workout deleted
- `404 Not Found` — Workout not found

---

### ✅ POST `/api/workouts/{id}/clone`

Clone an existing workout as a new editable copy for another client.

**Access:** Authenticated trainer

**Responses:**
- `200 OK` — Returns cloned workout object with new ID
- `404 Not Found` — Source workout not found

---

### ✅ POST `/api/workouts/assign`

Assign a workout to one or more clients.

**Access:** Authenticated trainer

**Request Body:**
```json
{
  "workoutId": 10,
  "memberIds": [42, 55],
  "trainerId": 1,
  "assignedAt": "2026-07-07",
  "dueDate": "2026-07-14",
  "notes": "Focus on full range of motion, not weight"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `workoutId` | ulong | ✅ | Workout to assign |
| `memberIds` | ulong[] | ✅ | Target clients (must be own assigned clients) |
| `assignedAt` | date | ✅ | Assignment date |
| `dueDate` | date | ❌ | Completion deadline |

**Responses:**
- `200 OK` — Workout assigned

---

### ✅ GET `/api/workouts/{id}/progress?clientId={id}`

Check a client's progress on a specific workout.

**Access:** Authenticated trainer (own clients)

**Response Data:**
```json
{
  "workoutId": 10,
  "clientId": 42,
  "sessionsCompleted": 5,
  "totalVolumeKg": 8400,
  "lastCompletedAt": "2026-07-04T10:30:00Z",
  "progressByExercise": [
    { "exerciseId": 1, "name": "Bench Press", "maxWeightKg": 82.5, "trend": "improving" }
  ]
}
```

---

### ✅ POST `/api/workouts/{id}/circuits`

Add a circuit block to a workout.

**Access:** Authenticated trainer

**Request Body:**
```json
{
  "name": "Conditioning Finisher",
  "rounds": 4,
  "restSeconds": 60,
  "exerciseIds": [3, 7, 12]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | ❌ | Circuit label |
| `rounds` | byte | ✅ | Number of rounds (default: 3) |
| `restSeconds` | ushort | ❌ | Rest between rounds in seconds |
| `exerciseIds` | ulong[] | ✅ | Exercises to include in the circuit |

---

### ✅ PUT `/api/workouts/{id}/circuits/{cid}`

Update an existing circuit block.

**Access:** Authenticated trainer

**Request Body (all optional):**
```json
{
  "name": "Conditioning Finisher v2",
  "rounds": 5,
  "restSeconds": 45
}
```

---

### ✅ POST `/api/workouts/{id}/supersets`

Add a superset to a workout.

**Access:** Authenticated trainer

**Request Body:**
```json
{
  "exerciseIds": [1, 4],
  "restSeconds": 60,
  "sets": 4
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `exerciseIds` | ulong[] | ✅ | Exactly 2 exercises paired back-to-back |
| `sets` | byte | ✅ | Number of sets (default: 3) |
| `restSeconds` | ushort | ❌ | Rest between paired sets |

---

### ✅ POST `/api/workouts/{id}/dropsets`

Add a dropset to a workout.

**Access:** Authenticated trainer

**Request Body:**
```json
{
  "exerciseId": 5,
  "steps": [
    { "weight": "80kg",  "reps": 8  },
    { "weight": "60kg",  "reps": 10 },
    { "weight": "40kg",  "reps": 12 }
  ]
}
```

---

### ✅ POST `/api/workouts/{id}/pyramids`

Add a pyramid set structure to a workout.

**Access:** Authenticated trainer

**Request Body:**
```json
{
  "exerciseId": 1,
  "direction": "ascending",
  "steps": [
    { "weight": "60kg", "reps": 12 },
    { "weight": "70kg", "reps": 10 },
    { "weight": "80kg", "reps": 8  },
    { "weight": "90kg", "reps": 6  }
  ]
}
```

| Field | Description |
|---|---|
| `direction` | `ascending` (light → heavy) or `descending` (heavy → light) |

---

### ✅ PUT `/api/workouts/{id}/tempo`

Configure lifting tempo for exercises in the workout.

**Access:** Authenticated trainer

**Request Body:**
```json
{
  "exerciseIds": [1, 4],
  "tempo": "3-1-1-0"
}
```

| Field | Description |
|---|---|
| `tempo` | Format: `eccentric-pause-concentric-topPause` in seconds |

---

### ✅ PUT `/api/workouts/{id}/rest-intervals`

Set rest interval rules across the whole workout.

**Access:** Authenticated trainer

**Request Body:**
```json
{
  "defaultRestSeconds": 90,
  "sectionOverrides": {
    "circuits": 45,
    "supersets": 60
  }
}
```

---

### ✅ POST `/api/workouts/{id}/timer`

Attach a timer protocol (EMOM, AMRAP, Tabata, etc.) to a workout.

**Access:** Authenticated trainer

**Request Body:**
```json
{
  "timerType": "EMOM",
  "workSeconds": 40,
  "restSeconds": 20,
  "rounds": 20
}
```

| `timerType` values | Description |
|---|---|
| `standard` | Rest-between-sets format |
| `EMOM` | Every Minute On the Minute |
| `AMRAP` | As Many Rounds As Possible |
| `tabata` | 20s work / 10s rest intervals |

---

### ✅ PUT `/api/workouts/{id}/difficulty`

Set difficulty and auto-adjustment rules for a workout.

**Access:** Authenticated trainer

**Request Body:**
```json
{
  "mode": "auto",
  "baseDifficulty": "Intermediate",
  "autoAdjust": true,
  "progressionThresholdPercent": 90
}
```

| Field | Description |
|---|---|
| `mode` | `manual` or `auto` |
| `autoAdjust` | Automatically progress when client exceeds threshold |
| `progressionThresholdPercent` | % completion rate that triggers progression |

---

### ✅ POST `/api/plans`

Create a multi-week training plan.

**Access:** Authenticated trainer

**Request Body:**
```json
{
  "tenantId": 1,
  "name": "6-Week Strength Foundation",
  "description": "Progressive overload for intermediate lifters.",
  "durationWeeks": 6,
  "goal": "MuscleGain",
  "difficulty": "Intermediate"
}
```

**Responses:**
- `200 OK` — Plan created

---

### ✅ PUT `/api/plans/{id}`

Update a plan's metadata.

**Access:** Authenticated trainer (own plans)

**Request Body (all optional):**
```json
{
  "name": "6-Week Strength Foundation (Rev 2)",
  "durationWeeks": 8,
  "difficulty": "Advanced",
  "isActive": true
}
```

---

### ✅ DELETE `/api/plans/{id}`

Delete a plan.

**Access:** admin only (trainers cannot delete shared plans)

---

### ✅ POST `/api/plans/{id}/branch`

Add a conditional progression branch to a plan's tree.

**Access:** Authenticated trainer

**Request Body:**
```json
{
  "name": "Advanced Route",
  "condition": { "completionRate": { "gte": 90 } },
  "nextPlanId": 8,
  "sortOrder": 1
}
```

---

### ✅ PUT `/api/plans/{id}/progression`

Update auto-progression rules for a plan.

**Access:** Authenticated trainer

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

---

### ✅ POST `/api/plans/{id}/assign`

Assign a plan to one or more clients.

**Access:** Authenticated trainer

**Request Body:**
```json
{
  "memberIds": [42, 55],
  "trainerId": 1,
  "startDate": "2026-08-01"
}
```

**Responses:**
- `200 OK` — Plan assigned

---

### ✅ GET `/api/plans/{id}/members`

List all clients currently assigned to a specific plan.

**Access:** Authenticated trainer (own clients)

---

### ✅ GET `/api/plans/{id}/analytics`

View plan performance analytics — completion rates, drop-off points, average scores.

**Access:** Authenticated trainer

**Response Data:**
```json
{
  "planId": 3,
  "totalAssigned": 8,
  "completionRate": 75.0,
  "averageSessionScore": 82.5,
  "dropOffWeek": 4,
  "clientBreakdown": [
    { "clientId": 42, "completedWeeks": 6, "status": "on-track" },
    { "clientId": 55, "completedWeeks": 3, "status": "behind" }
  ]
}
```

---

## 5. AI-Assisted Coaching Tools

**Base route:** `/api/ai`

> 🔜 All endpoints in this section are **planned**.

AI acts as a coaching co-pilot — generating draft plans, flagging injury/fatigue risk, reviewing form, and surfacing churn signals. Trainers always retain final judgment before anything is assigned to a client.

---

### 🔜 POST `/api/ai/workouts/generate`

Generate a draft AI workout for a client as a starting point for trainer editing.

**Access:** Authenticated trainer

> Response is always marked `status: "draft"`. The trainer must review and explicitly assign it.

**Request Body:**
```json
{
  "userId": 42,
  "goal": "MuscleGain",
  "fitnessLevel": "Intermediate",
  "availableEquipment": ["barbell", "dumbbells", "cables"],
  "durationMin": 60,
  "focusArea": "upper",
  "injuries": []
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `userId` | ulong | ✅ | Client the workout is generated for |
| `goal` | string | ✅ | `WeightLoss`, `MuscleGain`, `Endurance`, `General` |
| `fitnessLevel` | string | ✅ | `Beginner`, `Intermediate`, `Advanced` |
| `availableEquipment` | string[] | ❌ | Equipment available at the session location |
| `durationMin` | int | ❌ | Target session duration |
| `focusArea` | string | ❌ | `full-body`, `upper`, `lower`, `core` |
| `injuries` | string[] | ❌ | Known injuries to programme around |

**Response Data:**
```json
{
  "draftWorkoutId": 201,
  "status": "draft",
  "name": "AI Upper Body — Jane D.",
  "durationMin": 60,
  "exercises": [
    { "exerciseId": 1, "name": "Bench Press",      "sets": 4, "reps": 8,  "restSec": 90 },
    { "exerciseId": 4, "name": "Barbell Row",       "sets": 4, "reps": 8,  "restSec": 90 },
    { "exerciseId": 7, "name": "Overhead Press",    "sets": 3, "reps": 10, "restSec": 75 },
    { "exerciseId": 9, "name": "Cable Bicep Curl",  "sets": 3, "reps": 12, "restSec": 60 }
  ],
  "generatedAt": "2026-07-06T10:00:00Z"
}
```

---

### 🔜 POST `/api/ai/injury/detect`

Detect injury or overtraining risk signals from a client's recent session logs and biometric data.

**Access:** Authenticated trainer

**Request Body:**
```json
{
  "userId": 42,
  "lookbackDays": 14
}
```

**Response Data:**
```json
{
  "userId": 42,
  "riskLevel": "moderate",
  "flags": [
    {
      "signal": "Elevated fatigue across last 5 sessions",
      "detail": "Average fatigue score 7.8/10 — above safe threshold of 7.0",
      "recommendation": "Consider a deload week before next heavy session"
    },
    {
      "signal": "Reduced ROM on squat pattern",
      "detail": "Video form score dropped 15% over 7 days",
      "recommendation": "Review hip mobility and check for lower-back strain"
    }
  ],
  "overallRiskScore": 62,
  "generatedAt": "2026-07-06T10:00:00Z"
}
```

| `riskLevel` values | Description |
|---|---|
| `low` | No flags; safe to proceed normally |
| `moderate` | One or more caution signals — review before heavy session |
| `high` | Strong overtraining or injury signals — consider rest or assessment |

---

### 🔜 GET `/api/ai/posture/corrections/{sessionId}`

Review posture and form correction results from a client's tracked session.

**Access:** Authenticated trainer (own clients only)

**Response Data:**
```json
{
  "sessionId": "sess_xyz123",
  "clientId": 42,
  "exerciseId": 1,
  "exerciseName": "Barbell Back Squat",
  "totalReps": 24,
  "averageFormScore": 81,
  "corrections": [
    {
      "repNumber": 3,
      "issue": "Knee cave on ascent",
      "severity": "medium",
      "correction": "Push knees out in line with toes",
      "confidence": 0.91
    },
    {
      "repNumber": 7,
      "issue": "Forward lean excessive",
      "severity": "low",
      "correction": "Improve ankle mobility or elevate heels slightly",
      "confidence": 0.78
    }
  ],
  "sessionVideoUrl": "https://cdn.example.com/sessions/sess_xyz123/review.mp4"
}
```

---

### 🔜 POST `/api/ai/form/score`

Submit a client's recorded exercise video for AI form scoring.

**Access:** Authenticated trainer

**Request:** `multipart/form-data` — field name: `video`

**Additional Body Fields:**
```json
{
  "userId": 42,
  "exerciseId": 1
}
```

**Response Data:**
```json
{
  "overallScore": 78,
  "grade": "B+",
  "feedback": [
    { "issue": "Knee cave on ascent",   "severity": "medium", "correction": "Push knees out" },
    { "issue": "Bar path inconsistent", "severity": "low",    "correction": "Focus on a consistent bar path" }
  ],
  "annotatedVideoUrl": "https://cdn.example.com/form-review/42/squat-review.mp4"
}
```

---

### 🔜 POST `/api/ai/predict/churn`

Get AI-predicted churn risk score for a specific client.

**Access:** Authenticated trainer (own clients only)

**Request Body:**
```json
{
  "userId": 42
}
```

**Response Data:**
```json
{
  "userId": 42,
  "churnRiskScore": 72,
  "riskLevel": "high",
  "signals": [
    "No check-in in 12 days",
    "Last 3 workouts marked incomplete",
    "Class bookings dropped by 80% vs prior 30 days"
  ],
  "recommendedAction": "Reach out personally — consider offering a complimentary session",
  "generatedAt": "2026-07-06T10:00:00Z"
}
```

| `riskLevel` values | Churn risk score range |
|---|---|
| `low` | 0–30 |
| `medium` | 31–60 |
| `high` | 61–100 |

---

## 6. Personal Training Sessions

**Base route:** `/api/pt-sessions`

> 🔜 All endpoints in this section are **planned**.

Trainers manage the full lifecycle of 1:1 PT sessions — viewing upcoming bookings, marking sessions complete with notes, and tracking client packages.

---

### 🔜 GET `/api/pt-sessions?trainerId={id}`

List all upcoming and past PT sessions for the trainer.

**Access:** Authenticated trainer (own sessions only)

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `trainerId` | ulong | ✅ | Authenticated trainer's ID |
| `status` | string | ❌ | `scheduled`, `completed`, `cancelled` |
| `fromDate` | date | ❌ | Start of date range |
| `toDate` | date | ❌ | End of date range |
| `pageNumber` | int | ❌ | Page (default: 1) |
| `pageSize` | int | ❌ | Items per page (default: 20) |

**Response Data:**
```json
[
  {
    "sessionId": 200,
    "clientId": 42,
    "clientName": "Jane Doe",
    "scheduledAt": "2026-07-08T10:00:00Z",
    "durationMin": 60,
    "status": "scheduled",
    "location": "Downtown Branch — Studio 2",
    "notes": null
  },
  {
    "sessionId": 195,
    "clientId": 55,
    "clientName": "Bob Smith",
    "scheduledAt": "2026-07-06T09:00:00Z",
    "durationMin": 60,
    "status": "completed",
    "notes": "Great session — PR on deadlift at 120kg."
  }
]
```

---

### 🔜 GET `/api/pt-sessions/{id}`

Get full details of a specific PT session.

**Access:** Authenticated trainer (own sessions)

**Response Data:**
```json
{
  "sessionId": 200,
  "clientId": 42,
  "clientName": "Jane Doe",
  "trainerId": 1,
  "branchId": 2,
  "scheduledAt": "2026-07-08T10:00:00Z",
  "durationMin": 60,
  "status": "scheduled",
  "workoutId": 10,
  "workoutName": "Client Jane — Upper Body Day A",
  "packageId": 15,
  "packageSessionsRemaining": 7
}
```

---

### 🔜 PUT `/api/pt-sessions/{id}`

Update a scheduled PT session (reschedule, change location, or update assigned workout).

**Access:** Authenticated trainer (own sessions)

**Request Body (all optional):**
```json
{
  "scheduledAt": "2026-07-09T10:00:00Z",
  "durationMin": 75,
  "workoutId": 11,
  "location": "Downtown Branch — Studio 1",
  "notes": "Rescheduled at client request"
}
```

**Responses:**
- `200 OK` — Session updated
- `400 Bad Request` — Schedule conflict detected
- `404 Not Found` — Session not found

---

### 🔜 POST `/api/pt-sessions/{id}/complete`

Mark a PT session as completed and log session outcome.

**Access:** Authenticated trainer (own sessions)

**Request Body:**
```json
{
  "completedAt": "2026-07-08T11:05:00Z",
  "durationActualMin": 65,
  "notes": "Client hit a new squat PR at 90kg. Increased program difficulty for next session.",
  "clientMood": 9,
  "trainerRating": 5
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `completedAt` | datetime | ✅ | Actual session end time |
| `durationActualMin` | int | ❌ | Actual session duration |
| `notes` | string | ❌ | Session notes (persisted to client record) |
| `clientMood` | byte | ❌ | Trainer-observed client mood 1–10 |

**Responses:**
- `200 OK` — Session marked complete, package session count decremented
- `404 Not Found` — Session not found

---

### 🔜 POST `/api/pt-sessions/{id}/notes`

Add additional notes to a session after it has been completed.

**Access:** Authenticated trainer (own sessions)

**Request Body:**
```json
{
  "notes": "Follow up: book next session before end of week. Client mentioned knee discomfort — flag for medical clearance check."
}
```

**Responses:**
- `200 OK` — Notes added

---

### 🔜 DELETE `/api/pt-sessions/{id}`

Cancel a scheduled PT session.

**Access:** Authenticated trainer (own sessions)

**Request Body:**
```json
{
  "reason": "Trainer unavailable — rescheduled to July 9"
}
```

**Responses:**
- `200 OK` — Session cancelled
- `400 Bad Request` — Cancellation window has passed

---

### 🔜 GET `/api/pt-sessions/packages?clientId={id}`

View active PT session packages for a client.

**Access:** Authenticated trainer (own clients)

**Response Data:**
```json
[
  {
    "packageId": 15,
    "name": "10-Session PT Pack",
    "totalSessions": 10,
    "sessionsUsed": 3,
    "sessionsRemaining": 7,
    "purchasedAt": "2026-06-01T00:00:00Z",
    "expiresAt": "2026-12-01T00:00:00Z"
  }
]
```

---

## 7. Classes & Group Session Delivery

**Base route:** `/api/classes` | `/api/attendance`

> 🔜 All endpoints in this section are **planned**.

Trainers view only the classes they are assigned to run — rosters, waitlists, and check-in management.

---

### 🔜 GET `/api/classes?trainerId={id}`

Get the trainer's own class schedule.

**Access:** Authenticated trainer (own classes only)

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `trainerId` | ulong | ✅ | Authenticated trainer's ID |
| `fromDate` | date | ❌ | Start of date range |
| `toDate` | date | ❌ | End of date range |
| `status` | string | ❌ | `upcoming`, `completed`, `cancelled` |

**Response Data:**
```json
[
  {
    "classId": 101,
    "name": "Morning Spin",
    "classType": "spin",
    "branchId": 2,
    "branchName": "Downtown Branch",
    "startsAt": "2026-07-07T07:00:00Z",
    "endsAt": "2026-07-07T08:00:00Z",
    "capacity": 20,
    "enrolledCount": 17,
    "waitlistCount": 3,
    "status": "upcoming"
  }
]
```

---

### 🔜 GET `/api/classes/{id}`

Get full details of a specific class.

**Access:** Authenticated trainer (own classes)

**Response Data:**
```json
{
  "classId": 101,
  "name": "Morning Spin",
  "classType": "spin",
  "trainerId": 1,
  "branchId": 2,
  "startsAt": "2026-07-07T07:00:00Z",
  "endsAt": "2026-07-07T08:00:00Z",
  "capacity": 20,
  "enrolledCount": 17,
  "waitlistCount": 3,
  "location": "Spin Studio — Ground Floor",
  "notes": "Bring water and a towel"
}
```

---

### 🔜 GET `/api/classes/{id}/roster`

Get the confirmed attendance roster for a class before or after it runs.

**Access:** Authenticated trainer (own classes)

**Response Data:**
```json
[
  { "userId": 42, "displayName": "Jane Doe",  "status": "confirmed", "isNewMember": true  },
  { "userId": 55, "displayName": "Bob Smith", "status": "confirmed", "isNewMember": false },
  { "userId": 78, "displayName": "Sara M.",   "status": "confirmed", "isNewMember": false }
]
```

> `isNewMember: true` flags members attending this class type for the first time — useful for introductions.

---

### 🔜 GET `/api/classes/{id}/waitlist`

View the waitlist for a full class.

**Access:** Authenticated trainer (own classes)

**Response Data:**
```json
[
  { "waitlistId": 55, "userId": 99, "displayName": "Alex R.", "position": 1, "joinedAt": "2026-07-06T08:00:00Z" },
  { "waitlistId": 56, "userId": 80, "displayName": "Chris T.","position": 2, "joinedAt": "2026-07-06T09:30:00Z" }
]
```

---

### 🔜 POST `/api/attendance/check-in`

Mark a member as attended for a class (manual check-in by trainer at the door).

**Access:** Authenticated trainer (own classes)

**Request Body:**
```json
{
  "userId": 42,
  "classId": 101,
  "branchId": 2,
  "checkedInAt": "2026-07-07T06:58:00Z"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `userId` | ulong | ✅ | Member being checked in |
| `classId` | ulong | ✅ | Class being attended |
| `branchId` | ulong | ✅ | Location |
| `checkedInAt` | datetime | ❌ | Defaults to server time if omitted |

**Responses:**
- `200 OK` — Check-in recorded
- `400 Bad Request` — Member not on roster, or outside check-in window
- `409 Conflict` — Member already checked in

---

### 🔜 POST `/api/classes/{id}/complete`

Mark a class as delivered and log any session notes or incidents.

**Access:** Authenticated trainer (own classes)

**Request Body:**
```json
{
  "actualStartedAt": "2026-07-07T07:02:00Z",
  "actualEndedAt": "2026-07-07T07:58:00Z",
  "attendanceCount": 15,
  "notes": "Good energy. New member Jane was introduced to the format.",
  "incidents": []
}
```

**Responses:**
- `200 OK` — Class marked complete

---

## 8. Live & Realtime Coaching

**WebSocket base:** `wss://<host>/ws`

> 🔜 All endpoints in this section are **planned**.

Low-latency WebSocket channels for trainers hosting live virtual sessions, monitoring posture feeds, and watching client workout progress in real time.

---

### Connection Pattern

1. Authenticate via REST — get a valid JWT access token
2. Connect to WebSocket with token as query param:
   ```
   wss://api.example.com/ws/<channel>?token=<accessToken>
   ```
3. Exchange JSON message frames
4. Respond to server `ping` frames with `pong` to maintain connection
5. Close with a standard WebSocket close frame when done

---

### 🔜 WS `/ws/live-coaching?token={token}&sessionId={sessionId}`

Host a live virtual PT session — send coaching cues and receive client progress in real time.

**Access:** Authenticated trainer (own session)

**Connection:**
- Establish after confirming a PT session is scheduled and active.
- `sessionId` is the PT session ID from `GET /api/pt-sessions`.

---

**Trainer → Server message types:**

| `type` | Payload | Description |
|---|---|---|
| `session.start` | `{ "sessionId": "..." }` | Signal the session has begun |
| `coaching.cue` | `{ "text": "...", "audioUrl": "..." }` | Send a live coaching instruction to the client |
| `session.end` | `{ "notes": "...", "completedAt": "..." }` | End the session |
| `heartbeat` | `{ "timestamp": "..." }` | Keepalive ping |

**Example `coaching.cue` outbound frame:**
```json
{
  "type": "coaching.cue",
  "data": {
    "text": "Good depth! Push through your heels on the way up.",
    "audioUrl": null
  }
}
```

---

**Server → Trainer message types:**

| `type` | Description |
|---|---|
| `client.joined` | Client connected to the session |
| `client.left` | Client disconnected |
| `workout.progress` | Live set log from client (see below) |
| `posture.correction` | Posture issue detected by AI during client's exercise |
| `session.ended` | Session closed |

**Example `workout.progress` inbound frame:**
```json
{
  "type": "workout.progress",
  "data": {
    "clientId": 42,
    "exerciseId": 1,
    "exerciseName": "Barbell Squat",
    "setNo": 3,
    "reps": 8,
    "weightKg": 85.0,
    "rpe": 8,
    "formScore": 79,
    "loggedAt": "2026-07-08T10:22:15Z"
  }
}
```

---

### 🔜 WS `/ws/posture-feed?token={token}&sessionId={sessionId}`

Monitor a client's live posture and form corrections during a tracked session.

**Access:** Authenticated trainer (own clients only)

**Connection:** Client must have an active posture session started via `POST /api/ai/posture/realtime` on their device.

---

**Server → Trainer message types:**

| `type` | Description |
|---|---|
| `posture.ok` | No issues — form is correct |
| `posture.correction` | Issue detected — real-time correction data |
| `posture.rep_counted` | A valid rep was logged with its form score |
| `session.summary` | Sent when the posture session ends |

**Example `posture.correction` frame:**
```json
{
  "type": "posture.correction",
  "data": {
    "clientId": 42,
    "exerciseId": 1,
    "repNumber": 5,
    "issue": "Knee cave on ascent",
    "severity": "medium",
    "correction": "Push knees out in line with toes",
    "affectedJoint": "knee",
    "confidence": 0.91,
    "timestamp": "2026-07-06T09:12:44Z"
  }
}
```

**Example `posture.rep_counted` frame:**
```json
{
  "type": "posture.rep_counted",
  "data": {
    "clientId": 42,
    "exerciseId": 1,
    "repNumber": 6,
    "formScore": 84,
    "timestamp": "2026-07-06T09:12:50Z"
  }
}
```

**Example `session.summary` frame:**
```json
{
  "type": "session.summary",
  "data": {
    "clientId": 42,
    "exerciseId": 1,
    "totalReps": 24,
    "averageFormScore": 81,
    "corrections": 3,
    "sessionDurationSec": 380
  }
}
```

---

### 🔜 WS `/ws/workout-session/{sessionId}?token={token}`

Watch a client's in-progress workout session in real time as they log sets.

**Access:** Authenticated trainer (own clients only)

**Server → Trainer message types:**

| `type` | Description |
|---|---|
| `sync.state` | Full current session state (sent on trainer connect) |
| `set.logged` | Client just logged a set |
| `session.paused` | Client paused their session |
| `session.completed` | Client finished the workout |

**Example `sync.state` frame (on trainer connect):**
```json
{
  "type": "sync.state",
  "data": {
    "sessionId": "sess_abc123",
    "clientId": 42,
    "workoutId": 10,
    "workoutName": "Client Jane — Upper Body Day A",
    "startedAt": "2026-07-08T10:00:00Z",
    "elapsedSec": 1800,
    "currentExerciseIndex": 2,
    "setsLogged": [
      { "exerciseId": 1, "setNo": 1, "reps": 8,  "weightKg": 80.0, "rpe": 7 },
      { "exerciseId": 1, "setNo": 2, "reps": 8,  "weightKg": 82.5, "rpe": 8 },
      { "exerciseId": 4, "setNo": 1, "reps": 8,  "weightKg": 60.0, "rpe": 6 }
    ]
  }
}
```

**Example `set.logged` frame:**
```json
{
  "type": "set.logged",
  "data": {
    "clientId": 42,
    "exerciseId": 4,
    "exerciseName": "Barbell Row",
    "setNo": 2,
    "reps": 8,
    "weightKg": 62.5,
    "rpe": 7,
    "loggedAt": "2026-07-08T10:32:00Z"
  }
}
```

---

## 9. Communication & Notifications

**Base route:** `/api/notifications` | `/api/preferences`

> 🔜 All endpoints in this section are **planned**.

Trainers receive instant alerts for bookings, cancellations, and client activity, and can message clients directly for coaching communication.

---

### 🔜 GET `/api/notifications/{userId}`

Get the trainer's notification inbox.

**Access:** Authenticated trainer (own inbox)

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `isRead` | bool | Filter by read/unread |
| `type` | string | `booking`, `cancellation`, `assignment`, `client-alert`, `system` |
| `pageNumber` | int | Page (default: 1) |
| `pageSize` | int | Items per page (default: 20) |

**Response Data:**
```json
{
  "unreadCount": 2,
  "notifications": [
    {
      "id": 700,
      "type": "cancellation",
      "title": "Session Cancelled — Jane Doe",
      "body": "Jane Doe cancelled her PT session on July 8 at 10:00 AM.",
      "isRead": false,
      "createdAt": "2026-07-06T14:00:00Z",
      "actionUrl": "/sessions/200",
      "metadata": {
        "sessionId": 200,
        "clientId": 42
      }
    },
    {
      "id": 701,
      "type": "assignment",
      "title": "New Client Assigned",
      "body": "Chris T. has been assigned to you by the admin.",
      "isRead": false,
      "createdAt": "2026-07-06T09:00:00Z",
      "actionUrl": "/clients/80"
    }
  ]
}
```

---

### 🔜 PUT `/api/notifications/{id}/read`

Mark a notification as read.

**Access:** Authenticated trainer

**Responses:**
- `200 OK` — Marked as read

---

### 🔜 PUT `/api/notifications/{userId}/read-all`

Mark all notifications as read.

**Access:** Authenticated trainer

**Responses:**
- `200 OK` — All notifications marked as read

---

### 🔜 POST `/api/notifications/send`

Send a direct coaching message to a client.

**Access:** Authenticated trainer (own clients only)

**Request Body:**
```json
{
  "fromUserId": 5,
  "toUserId": 42,
  "channel": "in-app",
  "subject": "Your session tomorrow",
  "message": "Hi Jane, reminder that we have a session at 10am tomorrow. We'll be focusing on lower body. Make sure to warm up your hips beforehand!",
  "relatedEntityType": "pt-session",
  "relatedEntityId": 200
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `toUserId` | ulong | ✅ | Recipient (must be own assigned client) |
| `channel` | string | ✅ | `in-app`, `push`, `email`, `sms` |
| `message` | string | ✅ | Message body |
| `relatedEntityType` | string | ❌ | Context entity type: `pt-session`, `workout`, `plan` |
| `relatedEntityId` | ulong | ❌ | Context entity ID |

**Responses:**
- `200 OK` — Message sent
- `400 Bad Request` — Channel not available or recipient not an assigned client

---

### 🔜 GET `/api/preferences/{userId}`

Get the trainer's notification channel preferences.

**Access:** Authenticated trainer (own preferences)

**Response Data:**
```json
{
  "userId": 5,
  "channels": {
    "push":   { "enabled": true  },
    "email":  { "enabled": true  },
    "sms":    { "enabled": false }
  },
  "categories": {
    "booking":         { "push": true,  "email": true  },
    "cancellation":    { "push": true,  "email": true  },
    "assignment":      { "push": true,  "email": true  },
    "client-alert":    { "push": true,  "email": false },
    "system":          { "push": false, "email": true  }
  }
}
```

---

### 🔜 PUT `/api/preferences/{userId}`

Update notification channel preferences.

**Access:** Authenticated trainer

**Request Body:**
```json
{
  "channels": {
    "sms": { "enabled": true }
  },
  "categories": {
    "cancellation": { "push": true, "email": true, "sms": true }
  }
}
```

**Responses:**
- `200 OK` — Preferences updated

---

### 🔜 WS `/ws/notifications?token={token}`

Real-time push channel for instant trainer alerts.

**Access:** Authenticated trainer

**Server → Trainer message types:**

| `type` | Description |
|---|---|
| `notification.new` | A new notification arrived (booking, cancellation, assignment, alert) |
| `booking.confirmed` | A client just booked a PT session |
| `session.cancelled` | A client cancelled a booked session |
| `client.assigned` | A new client was assigned by the admin |
| `client.churn_alert` | A client's churn risk crossed a high threshold |
| `ping` | Keepalive — respond with `pong` |

**Example `session.cancelled` frame:**
```json
{
  "type": "session.cancelled",
  "data": {
    "sessionId": 200,
    "clientId": 42,
    "clientName": "Jane Doe",
    "scheduledAt": "2026-07-08T10:00:00Z",
    "cancelledAt": "2026-07-06T14:00:00Z",
    "reason": "Client request"
  }
}
```

**Example `client.churn_alert` frame:**
```json
{
  "type": "client.churn_alert",
  "data": {
    "clientId": 55,
    "clientName": "Bob Smith",
    "churnRiskScore": 74,
    "riskLevel": "high",
    "lastCheckinDaysAgo": 14,
    "recommendedAction": "Reach out personally"
  }
}
```

---

## 10. Gamification & Community Participation

**Base route:** `/api/challenges` | `/api/achievements` | `/api/social`

> 🔜 All endpoints in this section are **planned**.

Trainers create challenges for their clients, manually award achievement badges for notable milestones, and engage with their clients' social activity feed.

---

### 🔜 POST `/api/challenges`

Create a fitness challenge scoped to the trainer's client roster.

**Access:** Authenticated trainer

**Request Body:**
```json
{
  "tenantId": 1,
  "name": "Mark's August Consistency Challenge",
  "description": "Check in to the gym at least 4 times per week for 4 weeks.",
  "type": "checkins",
  "targetValue": 16,
  "targetUnit": "check-ins",
  "startsAt": "2026-08-01T00:00:00Z",
  "endsAt": "2026-08-31T23:59:59Z",
  "eligibleMemberIds": [42, 55, 80],
  "isPublic": false
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | ✅ | Challenge name |
| `type` | string | ✅ | `checkins`, `steps`, `workouts`, `calories`, `custom` |
| `targetValue` | decimal | ✅ | Goal value each participant must hit |
| `targetUnit` | string | ✅ | Unit label shown in leaderboard |
| `startsAt` / `endsAt` | datetime | ✅ | Challenge window |
| `eligibleMemberIds` | ulong[] | ❌ | Restrict to specific clients (trainer's own only) |
| `isPublic` | bool | ❌ | `false` = visible to eligible members only |

**Responses:**
- `200 OK` — Challenge created, returns challenge object with ID
- `400 Bad Request` — Validation failed or non-owned member IDs included

---

### 🔜 GET `/api/challenges?trainerId={id}`

List all challenges created by this trainer.

**Access:** Authenticated trainer (own challenges)

**Response Data:**
```json
[
  {
    "challengeId": 20,
    "name": "Mark's August Consistency Challenge",
    "type": "checkins",
    "startsAt": "2026-08-01T00:00:00Z",
    "endsAt": "2026-08-31T23:59:59Z",
    "participantCount": 3,
    "status": "upcoming"
  }
]
```

---

### 🔜 GET `/api/challenges/{id}/leaderboard`

View the leaderboard for a trainer-created challenge.

**Access:** Authenticated trainer (own challenge)

**Response Data:**
```json
{
  "challengeId": 20,
  "challengeName": "Mark's August Consistency Challenge",
  "updatedAt": "2026-08-06T08:00:00Z",
  "entries": [
    { "rank": 1, "userId": 42, "displayName": "Jane Doe",  "value": 8,  "unit": "check-ins" },
    { "rank": 2, "userId": 55, "displayName": "Bob Smith", "value": 6,  "unit": "check-ins" },
    { "rank": 3, "userId": 80, "displayName": "Chris T.",  "value": 5,  "unit": "check-ins" }
  ]
}
```

---

### 🔜 POST `/api/achievements/award`

Manually award an achievement badge to a client for a notable milestone.

**Access:** Authenticated trainer (own clients only)

**Request Body:**
```json
{
  "userId": 42,
  "achievementId": 15,
  "reason": "Hit a new squat PR at 100kg — incredible milestone!",
  "awardedBy": 5
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `userId` | ulong | ✅ | Client receiving the award |
| `achievementId` | ulong | ✅ | Achievement/badge to award |
| `reason` | string | ❌ | Custom message shown to the member |
| `awardedBy` | ulong | ✅ | Trainer's user ID (must be assigned trainer) |

**Responses:**
- `200 OK` — Badge awarded, member receives an in-app notification
- `400 Bad Request` — Member already has this achievement or is not an assigned client

---

### 🔜 GET `/api/achievements`

Browse all available achievement definitions (to see what can be awarded).

**Access:** Authenticated trainer

**Response Data:**
```json
[
  { "id": 5,  "name": "Iron Will",    "description": "Complete 50 gym check-ins",    "category": "consistency" },
  { "id": 15, "name": "Century Lift", "description": "Lift 100kg on any compound lift","category": "strength" },
  { "id": 22, "name": "Marathon Man", "description": "Log 42km of cardio in a month",  "category": "endurance" }
]
```

---

### 🔜 GET `/api/social/feed/{userId}`

Browse a client's social activity feed — shared workouts, milestone posts.

**Access:** Authenticated trainer (own clients only)

**Response Data:**
```json
[
  {
    "postId": 300,
    "userId": 42,
    "displayName": "Jane Doe",
    "type": "workout-share",
    "content": "Just crushed Upper Body Strength Day A! 💪",
    "workoutId": 10,
    "likesCount": 8,
    "commentsCount": 3,
    "isLiked": false,
    "postedAt": "2026-07-06T10:45:00Z"
  }
]
```

---

### 🔜 POST `/api/social/posts/{id}/like`

Like a client's shared post to show engagement and encouragement.

**Access:** Authenticated trainer

**Responses:**
- `200 OK` — Post liked

---

### 🔜 POST `/api/social/posts/{id}/comments`

Comment on a client's post with coaching encouragement or feedback.

**Access:** Authenticated trainer

**Request Body:**
```json
{
  "userId": 5,
  "text": "Huge effort Jane! Let's push even harder next session 🔥"
}
```

**Responses:**
- `200 OK` — Comment posted

---

## HTTP Status Code Reference

| Code | Meaning |
|---|---|
| `200 OK` | Request succeeded |
| `201 Created` | Resource created |
| `400 Bad Request` | Validation error, conflict, or out-of-scope resource |
| `401 Unauthorized` | Not authenticated or token expired |
| `403 Forbidden` | Authenticated but accessing data outside own scope |
| `404 Not Found` | Resource does not exist |
| `409 Conflict` | Duplicate action (e.g. already checked in) |
| `500 Internal Server Error` | Unhandled server error |

---

## Pagination

All list endpoints follow the standard pattern:
- `pageNumber` (int, default: 1)
- `pageSize` (int, default: 20)

```json
{
  "success": true,
  "data": {
    "items": [...],
    "pageNumber": 1,
    "pageSize": 20,
    "totalCount": 85,
    "totalPages": 5
  }
}
```

---

## Implementation Roadmap Summary

| Module | Status | Notes |
|---|---|---|
| Account & Authentication | ✅ Implemented | Auth, SSO, Roles controllers exist |
| Trainer Profile & Schedule | ✅ Implemented | TrainerController fully implemented |
| Client Management | ✅ Implemented | Member + Trainer assignment endpoints exist |
| Workout & Plan Building | ✅ Implemented | Workout, WorkoutBuilder, Plan controllers exist |
| AI-Assisted Coaching Tools | 🔜 Planned | No AI controller yet |
| Personal Training Sessions | 🔜 Planned | No PT sessions controller yet |
| Classes & Group Delivery | 🔜 Planned | No classes/attendance controller yet |
| Live & Realtime Coaching | 🔜 Planned | No WebSocket infrastructure yet |
| Communication & Notifications | 🔜 Planned | No notifications controller yet |
| Gamification & Community | 🔜 Planned | No challenges/achievements/social controller yet |

---

*Documentation generated from source — July 5, 2026*
