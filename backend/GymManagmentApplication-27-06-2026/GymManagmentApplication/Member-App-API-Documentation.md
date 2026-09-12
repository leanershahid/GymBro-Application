# Enterprise Gym Platform — Member App API Documentation

> **Base URL:** `https://<host>/api`
> **Version:** 1.0 | **Date:** July 5, 2026
> **Auth:** JWT Bearer token — `Authorization: Bearer <token>`
> **Scope:** Client / Member experience only. Admin and Trainer endpoints are documented separately.

---

## Implementation Status Legend

| Badge | Meaning |
|---|---|
| ✅ Implemented | Controller and service exist in the current codebase |
| 🔜 Planned | Defined in the PRD; API contract specified here; not yet built |

---

## Table of Contents

1. [Account & Authentication](#1-account--authentication)
2. [Profile & Membership](#2-profile--membership)
3. [Workouts & Training](#3-workouts--training)
4. [AI Coaching & Personalization](#4-ai-coaching--personalization)
5. [Health & Wellness Tracking](#5-health--wellness-tracking)
6. [Classes, Booking & Attendance](#6-classes-booking--attendance)
7. [Billing & Payments](#7-billing--payments)
8. [Gamification & Social Community](#8-gamification--social-community)
9. [Notifications & Support](#9-notifications--support)
10. [Live & Realtime Experiences](#10-live--realtime-experiences)

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

## 1. Account & Authentication

**Base route:** `/api/auth` | `/api/auth/sso` | `/api/biometric`

Members register, authenticate, manage credentials, and enroll biometric access from this module.

---

### ✅ POST `/api/auth/register`

Create a new member account.

**Access:** Public

**Request Body:**
```json
{
  "email": "member@example.com",
  "password": "SecurePass123!",
  "firstName": "Jane",
  "lastName": "Doe",
  "role": "client",
  "tenantId": 1
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `email` | string | ✅ | Must be unique per tenant |
| `password` | string | ✅ | Min 8 chars |
| `firstName` | string | ✅ | |
| `lastName` | string | ✅ | |
| `role` | string | ❌ | Always `client` for member self-registration |
| `tenantId` | ulong | ✅ | Gym tenant ID |

**Responses:**
- `200 OK` — Registration successful

**Response Data:**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "dGhp...",
  "expiresAt": "2026-07-05T12:00:00Z",
  "role": "client",
  "userId": 42,
  "email": "member@example.com"
}
```

- `400 Bad Request` — Validation failed
- `409 Conflict` — Email already registered

---

### ✅ POST `/api/auth/login`

Authenticate with email and password.

**Access:** Public

**Request Body:**
```json
{
  "email": "member@example.com",
  "password": "SecurePass123!"
}
```

**Responses:**
- `200 OK` — Returns `AuthResponse` with `accessToken` and `refreshToken`
- `401 Unauthorized` — Invalid credentials

---

### ✅ POST `/api/auth/logout`

Invalidate the current session.

**Access:** Authenticated member

**No body required.** User ID is extracted from the JWT.

**Responses:**
- `200 OK` — Logged out successfully

---

### ✅ POST `/api/auth/refresh-token`

Exchange a refresh token for a new access token without re-login.

**Access:** Public

**Request Body:**
```json
{
  "refreshToken": "dGhp..."
}
```

**Responses:**
- `200 OK` — Returns new `AuthResponse`
- `401 Unauthorized` — Refresh token invalid or expired

---

### ✅ POST `/api/auth/forgot-password`

Trigger a password reset email.

**Access:** Public

**Request Body:**
```json
{
  "email": "member@example.com"
}
```

**Responses:**
- `200 OK` — Always 200 (prevents email enumeration)

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

### ✅ PUT `/api/auth/change-password`

Change password while authenticated.

**Access:** Authenticated member

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

Get the authenticated member's own profile.

**Access:** Authenticated member

**Response Data:**
```json
{
  "userId": 42,
  "email": "member@example.com",
  "firstName": "Jane",
  "lastName": "Doe",
  "role": "client",
  "isEmailVerified": true
}
```

---

### ✅ POST `/api/auth/verify-email`

Verify email address with the OTP sent on registration.

**Access:** Public

**Request Body:**
```json
{
  "email": "member@example.com",
  "otp": "123456"
}
```

**Responses:**
- `200 OK` — Email verified
- `400 Bad Request` — Invalid or expired OTP

---

### ✅ POST `/api/auth/resend-otp`

Resend email/SMS verification OTP.

**Access:** Public

**Request Body:**
```json
{
  "email": "member@example.com",
  "channel": "email"
}
```

| Field | Type | Notes |
|---|---|---|
| `channel` | string | `email` or `sms` (default: `email`) |

---

### ✅ POST `/api/auth/sso/init`

Start an SSO login flow (Google, Microsoft, Apple).

**Access:** Public

**Request Body:**
```json
{
  "provider": "google",
  "redirectUri": "https://app.gymname.com/auth/callback"
}
```

**Response:** `{ "authorizationUrl": "https://accounts.google.com/..." }`

---

### ✅ POST `/api/auth/sso/callback`

Complete the SSO flow and receive platform tokens.

**Access:** Public

**Request Body:**
```json
{
  "provider": "google",
  "code": "4/0AX4XfWh...",
  "state": "state-token"
}
```

**Responses:**
- `200 OK` — Returns `AuthResponse`
- `401 Unauthorized` — SSO authentication failed

---

### ✅ POST `/api/biometric/face/enroll`

Enroll face for frictionless gym entry.

**Access:** Authenticated member

**Request Body:**
```json
{
  "userId": 42,
  "faceImageBase64": "data:image/jpeg;base64,/9j/..."
}
```

**Responses:**
- `200 OK` — Face enrolled successfully

---

### ✅ POST `/api/biometric/fingerprint/enroll`

Enroll fingerprint for gym entry.

**Access:** Authenticated member

**Request Body:**
```json
{
  "userId": 42,
  "fingerprintData": "base64-encoded-template"
}
```

**Responses:**
- `200 OK` — Fingerprint enrolled successfully

---

## 2. Profile & Membership

**Base route:** `/api/members` | `/api/subscriptions`

Members view and edit their own profile, documents, timeline, and self-manage their membership subscription.

---

### ✅ GET `/api/members/{id}`

Get the member's own profile.

**Access:** Authenticated member (own record only)

**Response Data:**
```json
{
  "id": 42,
  "tenantId": 1,
  "email": "jane@example.com",
  "firstName": "Jane",
  "lastName": "Doe",
  "phone": "+1-555-0101",
  "gender": "female",
  "dob": "1995-06-15",
  "avatarUrl": "https://cdn.example.com/avatar.jpg",
  "status": "Active",
  "trainerId": 5,
  "branchId": 2,
  "createdAt": "2026-01-10T08:00:00Z"
}
```

**Responses:**
- `200 OK` — Returns member profile
- `404 Not Found` — Member not found

---

### ✅ PUT `/api/members/{id}`

Update personal profile details.

**Access:** Authenticated member (own record only)

**Request Body (all fields optional):**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "phone": "+1-555-0202",
  "gender": "female",
  "dob": "1995-06-15",
  "avatarUrl": "https://cdn.example.com/new-avatar.jpg"
}
```

**Responses:**
- `200 OK` — Profile updated
- `404 Not Found` — Member not found

---

### ✅ POST `/api/members/{id}/photo`

Upload or replace profile photo.

**Access:** Authenticated member (own record)

**Request:** `multipart/form-data` — field name: `photo`

**Response:**
```json
{
  "url": "https://cdn.example.com/members/42/photo.jpg"
}
```

---

### ✅ GET `/api/members/{id}/documents`

View uploaded documents (waivers, consents, ID).

**Access:** Authenticated member (own documents)

**Response Data:**
```json
[
  {
    "id": 1,
    "fileName": "liability-waiver.pdf",
    "url": "https://cdn.example.com/docs/waiver.pdf",
    "documentType": "waiver",
    "uploadedAt": "2026-01-10T09:00:00Z"
  }
]
```

---

### ✅ POST `/api/members/{id}/documents?documentType={type}`

Upload a document (e.g. signed waiver, medical certificate).

**Access:** Authenticated member (own record)

**Request:** `multipart/form-data` — field name: `file`

**Query Params:**

| Param | Description |
|---|---|
| `documentType` | `waiver`, `medical-cert`, `id`, etc. |

**Responses:**
- `200 OK` — Document uploaded

---

### ✅ GET `/api/members/{id}/timeline`

View own full activity timeline — check-ins, workouts, payments, plan changes.

**Access:** Authenticated member (own timeline)

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
  }
]
```

---

### 🔜 GET `/api/subscriptions/{id}`

View current membership plan, entitlements, and renewal date.

**Access:** Authenticated member (own subscription)

**Response Data:**
```json
{
  "id": 10,
  "planName": "Premium Monthly",
  "status": "Active",
  "renewsAt": "2026-08-05T00:00:00Z",
  "price": 59.99,
  "currency": "USD",
  "features": ["Unlimited classes", "Personal trainer (2/month)", "App access"]
}
```

---

### 🔜 POST `/api/subscriptions/{id}/freeze`

Request a membership freeze (billing pauses during the freeze period).

**Access:** Authenticated member (own subscription)

**Request Body:**
```json
{
  "freezeFrom": "2026-08-01",
  "freezeUntil": "2026-08-21",
  "reason": "Traveling abroad"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `freezeFrom` | date | ✅ | Freeze start date |
| `freezeUntil` | date | ✅ | Freeze end date |
| `reason` | string | ❌ | Optional reason |

**Responses:**
- `200 OK` — Freeze scheduled
- `400 Bad Request` — Invalid date range or subscription not eligible

---

### 🔜 POST `/api/subscriptions/{id}/upgrade`

Request an upgrade to a higher membership tier.

**Access:** Authenticated member

**Request Body:**
```json
{
  "newPlanId": 5,
  "effectiveDate": "2026-08-01"
}
```

**Responses:**
- `200 OK` — Upgrade scheduled or applied

---

### 🔜 POST `/api/subscriptions/{id}/downgrade`

Request a downgrade to a lower tier.

**Access:** Authenticated member

**Request Body:**
```json
{
  "newPlanId": 2,
  "effectiveDate": "2026-08-01"
}
```

**Responses:**
- `200 OK` — Downgrade scheduled

---

## 3. Workouts & Training

**Base route:** `/api/exercises` | `/api/workouts` | `/api/plans`

Members browse the exercise library, follow assigned workouts, log sessions, and track plan progression.

---

### ✅ GET `/api/exercises`

Browse the full exercise library.

**Access:** Authenticated member

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `tag` | string | Filter by tag (e.g. `legs`, `push`) |
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

### ✅ GET `/api/exercises/{id}`

Get full exercise detail including instructions and coaching annotations.

**Access:** Authenticated member

**Response Data:**
```json
{
  "id": 1,
  "name": "Barbell Back Squat",
  "description": "Compound lower-body movement.",
  "instructions": "1. Rack the bar. 2. Step under. 3. Squat to parallel.",
  "category": "Strength",
  "difficulty": "Intermediate",
  "tags": ["legs", "compound", "barbell"],
  "muscles": ["Quadriceps", "Glutes", "Hamstrings"],
  "equipment": ["Barbell", "Rack"],
  "videoUrl": "https://cdn.example.com/exercises/squat.mp4",
  "annotations": [
    { "timeSeconds": 5, "text": "Keep chest up" },
    { "timeSeconds": 12, "text": "Drive through heels" }
  ]
}
```

**Responses:**
- `200 OK` — Returns exercise detail
- `404 Not Found` — Exercise not found

---

### ✅ GET `/api/exercises/{id}/alternatives`

Get injury-safe or equipment-free alternative exercises.

**Access:** Authenticated member

**Response Data:**
```json
[
  { "id": 12, "name": "Goblet Squat", "difficulty": "Beginner" },
  { "id": 13, "name": "Leg Press",    "difficulty": "Beginner" }
]
```

---

### ✅ GET `/api/exercises/tags`

Get all available exercise tags for filter UI.

**Access:** Authenticated member

**Response:** `["legs", "push", "pull", "cardio", "core", ...]`

---

### ✅ GET `/api/exercises/muscles`

Get all muscle group definitions.

**Access:** Authenticated member

**Response:** `[{ "id": 3, "name": "Quadriceps" }, ...]`

---

### ✅ GET `/api/workouts`

List workouts (filtered by assigned member).

**Access:** Authenticated member

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `memberId` | ulong | Filter to own assigned workouts |
| `difficulty` | string | `Beginner`, `Intermediate`, `Advanced` |
| `pageNumber` | int | Page (default: 1) |
| `pageSize` | int | Items per page (default: 20) |

---

### ✅ GET `/api/workouts/{id}`

Get full workout detail including exercise list and builder configuration.

**Access:** Authenticated member

**Response Data:**
```json
{
  "id": 10,
  "name": "Upper Body Strength Day A",
  "goal": "MuscleGain",
  "difficulty": "Intermediate",
  "durationMin": 60,
  "exercises": [
    { "exerciseId": 1, "name": "Bench Press", "sets": 4, "reps": 8, "restSec": 90 }
  ]
}
```

---

### ✅ POST `/api/workouts/{id}/complete`

Log a completed workout session with all set-level data.

**Access:** Authenticated member

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
    { "exerciseId": 1, "setNo": 1, "reps": 8, "weightKg": 80.0, "rpe": 7 },
    { "exerciseId": 1, "setNo": 2, "reps": 8, "weightKg": 82.5, "rpe": 8 }
  ]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `clientId` | ulong | ✅ | Authenticated member's ID |
| `startedAt` / `endedAt` | datetime | ✅ | Session window |
| `calories` | ushort | ❌ | Estimated calories burned |
| `moodBefore` / `moodAfter` | byte | ❌ | 1–10 mood score |
| `fatigueLevel` | byte | ❌ | 1–10 fatigue score |
| `sets[].rpe` | byte | ❌ | Rate of Perceived Exertion 1–10 |

**Responses:**
- `200 OK` — Session logged
- `400 Bad Request` — Validation failed

---

### ✅ GET `/api/workouts/{id}/progress?clientId={id}`

View own progress on a specific workout over time.

**Access:** Authenticated member (own data)

**Response Data:**
```json
{
  "workoutId": 10,
  "sessionsCompleted": 8,
  "totalVolumeKg": 14200,
  "lastCompletedAt": "2026-07-04T10:30:00Z",
  "progressByExercise": [
    { "exerciseId": 1, "name": "Bench Press", "maxWeightKg": 82.5, "trend": "improving" }
  ]
}
```

---

### ✅ POST `/api/workouts/{id}/bookmark`

Bookmark/unbookmark a workout for quick access.

**Access:** Authenticated member

**Responses:**
- `200 OK` — Bookmark toggled

---

### ✅ POST `/api/workouts/{id}/share`

Share a completed workout to the social feed.

**Access:** Authenticated member

**Responses:**
- `200 OK` — Workout shared

---

### ✅ GET `/api/plans/{id}`

Get full details of an assigned multi-week training plan.

**Access:** Authenticated member

**Response Data:**
```json
{
  "id": 3,
  "name": "12-Week Strength Builder",
  "durationWeeks": 12,
  "goal": "MuscleGain",
  "difficulty": "Intermediate",
  "currentWeek": 4,
  "completionPercent": 33
}
```

---

### ✅ GET `/api/plans/{id}/tree`

View the progression tree of a plan (which plan follows after completion).

**Access:** Authenticated member

---

### ✅ GET `/api/workouts/{id}/score?clientId={id}`

Get the performance score for a completed workout session.

**Access:** Authenticated member (own score)

---

## 4. AI Coaching & Personalization

**Base route:** `/api/ai`

> 🔜 All endpoints in this section are **planned**. None are implemented in the current codebase.

AI-powered workout generation, meal planning, macro analysis, posture feedback, and a conversational coaching bot.

---

### 🔜 POST `/api/ai/workouts/generate`

Generate a personalized workout based on the member's goals, fitness level, and available equipment.

**Access:** Authenticated member

**Request Body:**
```json
{
  "userId": 42,
  "goal": "WeightLoss",
  "fitnessLevel": "Beginner",
  "availableEquipment": ["dumbbells", "resistance-bands"],
  "durationMin": 45,
  "focusArea": "full-body",
  "injuries": ["lower-back"]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `userId` | ulong | ✅ | Requesting member |
| `goal` | string | ✅ | `WeightLoss`, `MuscleGain`, `Endurance`, `General` |
| `fitnessLevel` | string | ✅ | `Beginner`, `Intermediate`, `Advanced` |
| `availableEquipment` | string[] | ❌ | Equipment member has access to |
| `durationMin` | int | ❌ | Target session duration |
| `focusArea` | string | ❌ | `full-body`, `upper`, `lower`, `core` |
| `injuries` | string[] | ❌ | Known injuries to avoid stressing |

**Response Data:**
```json
{
  "generatedWorkoutId": 201,
  "name": "AI Full-Body Burn — July 6",
  "durationMin": 45,
  "exercises": [
    { "exerciseId": 12, "name": "Goblet Squat", "sets": 3, "reps": 12, "restSec": 60 },
    { "exerciseId": 18, "name": "Dumbbell Row",  "sets": 3, "reps": 10, "restSec": 60 }
  ]
}
```

**Responses:**
- `200 OK` — Workout generated
- `400 Bad Request` — Invalid input parameters

---

### 🔜 GET `/api/ai/workouts/recommendations/{userId}`

Get a personalized list of recommended workouts based on the member's history and preferences.

**Access:** Authenticated member (own data)

**Response Data:**
```json
[
  { "workoutId": 10, "name": "Upper Body Strength Day A", "matchScore": 0.92, "reason": "Aligns with your MuscleGain goal" },
  { "workoutId": 15, "name": "HIIT Cardio Blast",         "matchScore": 0.87, "reason": "Based on your recent activity level" }
]
```

---

### 🔜 POST `/api/ai/diet/generate`

Generate a personalized meal plan based on goals, dietary preferences, and caloric targets.

**Access:** Authenticated member

**Request Body:**
```json
{
  "userId": 42,
  "goal": "WeightLoss",
  "targetCalories": 1800,
  "dietType": "balanced",
  "allergies": ["gluten"],
  "mealsPerDay": 4,
  "durationDays": 7
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `goal` | string | ✅ | `WeightLoss`, `MuscleGain`, `Maintenance` |
| `targetCalories` | int | ❌ | Daily caloric target |
| `dietType` | string | ❌ | `balanced`, `keto`, `vegan`, `vegetarian`, `paleo` |
| `allergies` | string[] | ❌ | Food allergies/intolerances |
| `mealsPerDay` | int | ❌ | Number of meals (default: 3) |
| `durationDays` | int | ❌ | Plan duration in days (default: 7) |

**Response Data:**
```json
{
  "planId": 50,
  "dailyCalories": 1800,
  "days": [
    {
      "day": 1,
      "meals": [
        { "meal": "Breakfast", "name": "Greek Yogurt Parfait", "calories": 380, "protein": 28, "carbs": 42, "fat": 8 },
        { "meal": "Lunch",     "name": "Grilled Chicken Salad","calories": 520, "protein": 45, "carbs": 30, "fat": 18 }
      ]
    }
  ]
}
```

---

### 🔜 POST `/api/ai/diet/analyze`

Analyze a meal photo to estimate macros and log food intake.

**Access:** Authenticated member

**Request:** `multipart/form-data` — field name: `photo`

**Additional Body Fields:**
```json
{
  "userId": 42,
  "mealType": "lunch",
  "loggedAt": "2026-07-06T13:00:00Z"
}
```

**Response Data:**
```json
{
  "detectedFoods": [
    { "name": "Grilled Salmon", "portion": "150g", "calories": 280, "protein": 38, "carbs": 0, "fat": 13 },
    { "name": "Brown Rice",     "portion": "100g", "calories": 216, "protein": 4,  "carbs": 45, "fat": 2 }
  ],
  "totalCalories": 496,
  "totalProtein": 42,
  "totalCarbs": 45,
  "totalFat": 15,
  "confidence": 0.84,
  "logId": 320
}
```

---

### 🔜 POST `/api/ai/chat`

Send a message to the AI coaching bot.

**Access:** Authenticated member

**Request Body:**
```json
{
  "userId": 42,
  "message": "What should I eat after a heavy leg day?",
  "conversationId": "conv_abc123"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `userId` | ulong | ✅ | Member sending the message |
| `message` | string | ✅ | Member's question or input |
| `conversationId` | string | ❌ | Continue existing conversation thread |

**Response Data:**
```json
{
  "reply": "After a heavy leg day, prioritize protein (30–40g) and fast carbs within 30 minutes to kick-start muscle repair. Try a chicken and rice bowl or a protein shake with a banana.",
  "conversationId": "conv_abc123",
  "suggestedActions": [
    { "label": "Generate recovery meal plan", "action": "generate-diet" }
  ]
}
```

---

### 🔜 POST `/api/ai/posture/realtime`

Start a real-time posture analysis session using the device camera.

**Access:** Authenticated member

**Request Body:**
```json
{
  "userId": 42,
  "exerciseId": 1,
  "sessionToken": "ws-token-for-live-feed"
}
```

**Response Data:**
```json
{
  "sessionId": "posture_session_xyz",
  "websocketUrl": "wss://api.example.com/ws/posture-feed?session=posture_session_xyz",
  "expiresAt": "2026-07-06T10:30:00Z"
}
```

> Connect to the returned `websocketUrl` to receive real-time posture corrections. See [Section 10](#10-live--realtime-experiences).

---

### 🔜 POST `/api/ai/form/score`

Submit a recorded exercise video clip for form scoring.

**Access:** Authenticated member

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
    { "issue": "Knee cave on ascent",     "severity": "medium", "correction": "Push knees out in line with toes" },
    { "issue": "Forward lean excessive",  "severity": "low",    "correction": "Elevate heels slightly or improve ankle mobility" }
  ],
  "videoAnnotationUrl": "https://cdn.example.com/form-analysis/42/squat-review.mp4"
}
```

---

## 5. Health & Wellness Tracking

**Base route:** `/api/goals` | `/api/tracking` | `/api/journal` | `/api/devices` | `/api/integrations`

> 🔜 All endpoints in this section are **planned**.

Members set goals, log daily habits, upload progress photos, and sync wearable devices.

---

### 🔜 POST `/api/goals`

Create a personal fitness goal with optional milestones.

**Access:** Authenticated member

**Request Body:**
```json
{
  "userId": 42,
  "title": "Lose 5kg in 3 months",
  "goalType": "WeightLoss",
  "targetValue": 75.0,
  "targetUnit": "kg",
  "targetDate": "2026-10-06",
  "milestones": [
    { "label": "Lose 2kg",  "targetValue": 78.0, "targetDate": "2026-08-06" },
    { "label": "Lose 4kg",  "targetValue": 76.0, "targetDate": "2026-09-06" }
  ]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `goalType` | string | ✅ | `WeightLoss`, `MuscleGain`, `Endurance`, `Habit`, `Custom` |
| `targetValue` | decimal | ❌ | Numeric target (weight, body-fat %, steps) |
| `targetDate` | date | ✅ | Deadline |
| `milestones` | array | ❌ | Intermediate checkpoints |

**Responses:**
- `200 OK` — Goal created, returns goal object with ID

---

### 🔜 GET `/api/goals?userId={id}`

List all active goals for the member.

**Access:** Authenticated member (own goals)

**Response Data:**
```json
[
  {
    "id": 1,
    "title": "Lose 5kg in 3 months",
    "goalType": "WeightLoss",
    "progressPercent": 40,
    "currentValue": 78.0,
    "targetValue": 75.0,
    "targetDate": "2026-10-06",
    "status": "OnTrack"
  }
]
```

---

### 🔜 PUT `/api/goals/{id}`

Update a goal's target or deadline.

**Access:** Authenticated member (own goal)

---

### 🔜 DELETE `/api/goals/{id}`

Remove a goal.

**Access:** Authenticated member (own goal)

---

### 🔜 POST `/api/tracking/habits`

Log a daily habit entry (sleep, mood, hydration, stress, recovery).

**Access:** Authenticated member

**Request Body:**
```json
{
  "userId": 42,
  "loggedAt": "2026-07-06",
  "sleepHours": 7.5,
  "mood": 8,
  "hydrationLiters": 2.5,
  "stressLevel": 4,
  "recoveryScore": 76,
  "notes": "Felt well rested"
}
```

| Field | Type | Description |
|---|---|---|
| `sleepHours` | decimal | Hours slept |
| `mood` | byte | 1–10 mood score |
| `hydrationLiters` | decimal | Water intake in litres |
| `stressLevel` | byte | 1–10 stress score |
| `recoveryScore` | byte | 0–100 recovery score (from wearable or manual) |

**Responses:**
- `200 OK` — Habit log recorded

---

### 🔜 GET `/api/tracking/dashboard/{userId}`

Get a 30-day health trends dashboard for the member.

**Access:** Authenticated member (own data)

**Response Data:**
```json
{
  "userId": 42,
  "period": "30d",
  "averageSleep": 7.2,
  "averageMood": 7.4,
  "averageHydration": 2.3,
  "workoutsCompleted": 18,
  "totalCaloriesBurned": 9200,
  "weightTrend": [
    { "date": "2026-06-06", "weightKg": 81.0 },
    { "date": "2026-07-06", "weightKg": 79.5 }
  ],
  "moodTrend": [
    { "date": "2026-06-06", "score": 6 },
    { "date": "2026-07-06", "score": 8 }
  ]
}
```

---

### 🔜 POST `/api/journal/photos`

Upload a progress/transformation photo.

**Access:** Authenticated member

**Request:** `multipart/form-data` — field name: `photo`

**Additional Body Fields:**
```json
{
  "userId": 42,
  "takenAt": "2026-07-06",
  "pose": "front",
  "isPrivate": true,
  "notes": "Week 12 check-in"
}
```

| Field | Description |
|---|---|
| `pose` | `front`, `side`, `back` |
| `isPrivate` | If `true`, visible only to the member |

**Response:**
```json
{
  "photoId": 88,
  "url": "https://cdn.example.com/journal/42/photo-week12.jpg",
  "takenAt": "2026-07-06"
}
```

---

### 🔜 POST `/api/journal/measurements`

Log body measurements.

**Access:** Authenticated member

**Request Body:**
```json
{
  "userId": 42,
  "loggedAt": "2026-07-06",
  "weightKg": 79.5,
  "bodyFatPercent": 20.1,
  "muscleMassKg": 38.2,
  "waistCm": 84,
  "hipCm": 96,
  "chestCm": 102,
  "armCm": 36,
  "thighCm": 58
}
```

**Responses:**
- `200 OK` — Measurements logged

---

### 🔜 GET `/api/journal/measurements?userId={id}`

Get measurement history for trend charts.

**Access:** Authenticated member (own data)

**Response Data:**
```json
[
  { "loggedAt": "2026-07-06", "weightKg": 79.5, "bodyFatPercent": 20.1 },
  { "loggedAt": "2026-06-06", "weightKg": 81.0, "bodyFatPercent": 21.8 }
]
```

---

### 🔜 POST `/api/devices/connect`

Connect a wearable device to the member's account.

**Access:** Authenticated member

**Request Body:**
```json
{
  "userId": 42,
  "deviceType": "fitbit",
  "authCode": "fitbit-oauth-code",
  "redirectUri": "https://app.gymname.com/devices/callback"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `deviceType` | string | ✅ | `fitbit`, `garmin`, `apple-health`, `google-fit`, `whoop` |
| `authCode` | string | ✅ | OAuth code from device provider |

**Responses:**
- `200 OK` — Device connected, sync begins

---

### 🔜 POST `/api/devices/sync`

Manually trigger a data sync from a connected device.

**Access:** Authenticated member

**Request Body:**
```json
{
  "userId": 42,
  "deviceType": "fitbit"
}
```

**Responses:**
- `200 OK` — Sync triggered, returns sync job ID

---

### 🔜 GET `/api/devices?userId={id}`

List all connected devices and their last sync status.

**Access:** Authenticated member

**Response Data:**
```json
[
  {
    "deviceType": "fitbit",
    "deviceName": "Fitbit Charge 6",
    "connectedAt": "2026-06-01T10:00:00Z",
    "lastSyncAt": "2026-07-06T07:30:00Z",
    "status": "healthy"
  }
]
```

---

### 🔜 POST `/api/integrations/apple-health`

Enable Apple Health sync for the member (iOS only).

**Access:** Authenticated member

**Request Body:**
```json
{
  "userId": 42,
  "dataTypes": ["steps", "heart-rate", "sleep", "workouts"]
}
```

**Responses:**
- `200 OK` — Apple Health integration enabled

---

### 🔜 POST `/api/integrations/google-fit`

Enable Google Fit sync.

**Access:** Authenticated member

**Request Body:**
```json
{
  "userId": 42,
  "authCode": "google-oauth-code",
  "redirectUri": "https://app.gymname.com/integrations/callback"
}
```

**Responses:**
- `200 OK` — Google Fit connected

---

## 6. Classes, Booking & Attendance

**Base route:** `/api/classes` | `/api/attendance` | `/api/pt-sessions`

> 🔜 All endpoints in this section are **planned**.

Members browse the class schedule, book or join waitlists, check in, and manage PT sessions.

---

### 🔜 GET `/api/classes/calendar`

Browse the class schedule calendar.

**Access:** Authenticated member

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `branchId` | ulong | ❌ | Filter by branch/location |
| `date` | date | ❌ | Specific date (ISO 8601) |
| `fromDate` | date | ❌ | Start of date range |
| `toDate` | date | ❌ | End of date range |
| `trainerId` | ulong | ❌ | Filter by trainer |
| `classType` | string | ❌ | e.g. `spin`, `yoga`, `HIIT`, `pilates` |
| `pageNumber` | int | ❌ | Page (default: 1) |
| `pageSize` | int | ❌ | Items per page (default: 20) |

**Response Data:**
```json
[
  {
    "classId": 101,
    "name": "Morning Spin",
    "classType": "spin",
    "trainerId": 5,
    "trainerName": "Mark Johnson",
    "branchId": 2,
    "startsAt": "2026-07-07T07:00:00Z",
    "endsAt": "2026-07-07T08:00:00Z",
    "capacity": 20,
    "enrolledCount": 17,
    "spotsAvailable": 3,
    "waitlistCount": 0,
    "isBooked": false
  }
]
```

---

### 🔜 POST `/api/classes/{id}/book`

Book a spot in a class.

**Access:** Authenticated member

**Path Parameters:**

| Param | Description |
|---|---|
| `id` | Class ID |

**Request Body:**
```json
{
  "userId": 42
}
```

**Responses:**
- `200 OK` — Booking confirmed
  ```json
  { "bookingId": 300, "classId": 101, "status": "confirmed", "bookedAt": "2026-07-06T10:00:00Z" }
  ```
- `400 Bad Request` — Class full (use `/waitlist` instead)
- `409 Conflict` — Member already booked

---

### 🔜 DELETE `/api/classes/{id}/book`

Cancel a class booking.

**Access:** Authenticated member

**Request Body:**
```json
{
  "userId": 42
}
```

**Responses:**
- `200 OK` — Booking cancelled
- `404 Not Found` — No booking found

---

### 🔜 POST `/api/classes/{id}/waitlist`

Join the waitlist when a class is at capacity.

**Access:** Authenticated member

**Request Body:**
```json
{
  "userId": 42
}
```

**Responses:**
- `200 OK` — Added to waitlist
  ```json
  { "waitlistId": 55, "position": 3, "classId": 101 }
  ```
- `409 Conflict` — Already on waitlist

---

### 🔜 DELETE `/api/classes/{id}/waitlist`

Leave the waitlist.

**Access:** Authenticated member

**Responses:**
- `200 OK` — Removed from waitlist

---

### 🔜 GET `/api/classes/{id}/bookings`

View all bookings for a class (own booking only for members).

**Access:** Authenticated member (own booking)

**Response Data:**
```json
{
  "bookingId": 300,
  "classId": 101,
  "className": "Morning Spin",
  "status": "confirmed",
  "bookedAt": "2026-07-06T10:00:00Z"
}
```

---

### 🔜 POST `/api/attendance/qr-scan`

Check in to the gym or a class by scanning a QR code.

**Access:** Authenticated member

**Request Body:**
```json
{
  "userId": 42,
  "qrCode": "GYM-ENTRY-XYZ-2026",
  "branchId": 2,
  "classId": 101
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `qrCode` | string | ✅ | QR code scanned at entry/class |
| `branchId` | ulong | ✅ | Branch being checked into |
| `classId` | ulong | ❌ | Class ID if checking into a specific class |

**Responses:**
- `200 OK` — Check-in recorded
  ```json
  { "checkinId": 500, "checkedInAt": "2026-07-07T06:58:00Z", "branchName": "Downtown" }
  ```
- `400 Bad Request` — Invalid QR code or outside check-in window

---

### 🔜 GET `/api/attendance/{userId}`

View own full attendance history.

**Access:** Authenticated member (own history)

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `fromDate` | date | Start of range |
| `toDate` | date | End of range |
| `pageNumber` | int | Page (default: 1) |
| `pageSize` | int | Items per page (default: 20) |

**Response Data:**
```json
[
  {
    "checkinId": 500,
    "checkedInAt": "2026-07-07T06:58:00Z",
    "branchName": "Downtown",
    "className": "Morning Spin",
    "type": "class"
  },
  {
    "checkinId": 498,
    "checkedInAt": "2026-07-05T09:10:00Z",
    "branchName": "Downtown",
    "className": null,
    "type": "general"
  }
]
```

---

### 🔜 POST `/api/pt-sessions`

Book a personal training session with an assigned trainer.

**Access:** Authenticated member

**Request Body:**
```json
{
  "userId": 42,
  "trainerId": 5,
  "branchId": 2,
  "scheduledAt": "2026-07-08T10:00:00Z",
  "durationMin": 60,
  "notes": "Focus on upper body"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `trainerId` | ulong | ✅ | Assigned trainer |
| `scheduledAt` | datetime | ✅ | Session date and time |
| `durationMin` | int | ❌ | Duration in minutes (default: 60) |

**Responses:**
- `200 OK` — PT session booked
- `400 Bad Request` — Slot unavailable or no PT package remaining

---

### 🔜 GET `/api/pt-sessions?userId={id}`

View all upcoming and past PT sessions.

**Access:** Authenticated member (own sessions)

**Response Data:**
```json
[
  {
    "sessionId": 200,
    "trainerId": 5,
    "trainerName": "Mark Johnson",
    "scheduledAt": "2026-07-08T10:00:00Z",
    "status": "scheduled",
    "durationMin": 60
  }
]
```

---

### 🔜 DELETE `/api/pt-sessions/{id}`

Cancel a booked PT session.

**Access:** Authenticated member

**Responses:**
- `200 OK` — Session cancelled
- `400 Bad Request` — Cancellation window exceeded

---

## 7. Billing & Payments

**Base route:** `/api/membership-plans` | `/api/payments` | `/api/invoices` | `/api/pricing` | `/api/subscriptions`

> 🔜 All endpoints in this section are **planned**.

Members manage their own payment methods, view invoices, redeem promo codes, and self-manage their subscription tier.

---

### 🔜 GET `/api/membership-plans`

Browse available membership plans for upgrade/downgrade options.

**Access:** Authenticated member

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `tenantId` | ulong | Gym tenant scope |

**Response Data:**
```json
[
  {
    "id": 1,
    "name": "Basic Monthly",
    "price": 29.99,
    "currency": "USD",
    "billingCycle": "monthly",
    "features": ["Gym access", "App access"]
  },
  {
    "id": 2,
    "name": "Premium Monthly",
    "price": 59.99,
    "currency": "USD",
    "billingCycle": "monthly",
    "features": ["Unlimited classes", "2 PT sessions/month", "App access", "Nutrition tracking"]
  }
]
```

---

### 🔜 POST `/api/payments/methods`

Save a new payment method (card/UPI/bank account).

**Access:** Authenticated member

**Request Body:**
```json
{
  "userId": 42,
  "type": "card",
  "provider": "stripe",
  "token": "tok_visa_stripe",
  "setAsDefault": true
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | string | ✅ | `card`, `upi`, `bank-account` |
| `provider` | string | ✅ | `stripe`, `razorpay` |
| `token` | string | ✅ | Payment provider tokenized card reference |
| `setAsDefault` | bool | ❌ | Make this the default payment method |

**Responses:**
- `200 OK` — Payment method saved
  ```json
  { "methodId": 10, "type": "card", "last4": "4242", "brand": "Visa", "isDefault": true }
  ```

---

### 🔜 GET `/api/payments/methods?userId={id}`

List all saved payment methods.

**Access:** Authenticated member

**Response Data:**
```json
[
  { "methodId": 10, "type": "card", "last4": "4242", "brand": "Visa",       "isDefault": true  },
  { "methodId": 11, "type": "card", "last4": "8888", "brand": "Mastercard", "isDefault": false }
]
```

---

### 🔜 DELETE `/api/payments/methods/{methodId}`

Remove a saved payment method.

**Access:** Authenticated member

**Responses:**
- `200 OK` — Payment method removed
- `400 Bad Request` — Cannot remove the only active payment method on a live subscription

---

### 🔜 GET `/api/payments/history?userId={id}`

View full payment history.

**Access:** Authenticated member (own history)

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `fromDate` | date | Start of range |
| `toDate` | date | End of range |
| `pageNumber` | int | Page (default: 1) |
| `pageSize` | int | Items per page (default: 20) |

**Response Data:**
```json
[
  {
    "paymentId": 900,
    "amount": 59.99,
    "currency": "USD",
    "status": "succeeded",
    "description": "Premium Monthly — July 2026",
    "paidAt": "2026-07-05T00:00:00Z",
    "invoiceId": 400
  }
]
```

---

### 🔜 GET `/api/invoices/{id}/pdf`

Download a specific invoice as a PDF.

**Access:** Authenticated member (own invoices)

**Response:** Binary PDF file stream

**Headers:**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="invoice-400.pdf"
```

---

### 🔜 GET `/api/invoices?userId={id}`

List all invoices for the member.

**Access:** Authenticated member

**Response Data:**
```json
[
  {
    "invoiceId": 400,
    "amount": 59.99,
    "currency": "USD",
    "status": "paid",
    "issuedAt": "2026-07-05T00:00:00Z",
    "dueAt": "2026-07-05T00:00:00Z",
    "pdfUrl": "/api/invoices/400/pdf"
  }
]
```

---

### 🔜 POST `/api/pricing/discounts/validate`

Validate and apply a promo/referral/discount code at checkout.

**Access:** Authenticated member

**Request Body:**
```json
{
  "userId": 42,
  "code": "SUMMER20",
  "planId": 2
}
```

**Response Data:**
```json
{
  "code": "SUMMER20",
  "discountType": "percentage",
  "discountValue": 20,
  "originalPrice": 59.99,
  "discountedPrice": 47.99,
  "validUntil": "2026-08-31T23:59:59Z",
  "isValid": true
}
```

**Responses:**
- `200 OK` — Code valid, returns discount details
- `400 Bad Request` — Code invalid, expired, or not applicable to selected plan

---

### 🔜 POST `/api/subscriptions/{id}/renew`

Manually trigger a subscription renewal (e.g. after a failed auto-renewal).

**Access:** Authenticated member (own subscription)

**Request Body:**
```json
{
  "paymentMethodId": 10
}
```

**Responses:**
- `200 OK` — Renewal successful
- `400 Bad Request` — Payment failed

---

## 8. Gamification & Social Community

**Base route:** `/api/challenges` | `/api/achievements` | `/api/social`

> 🔜 All endpoints in this section are **planned**.

Members join challenges, earn achievements, build a social fitness profile, and interact with the community feed.

---

### 🔜 GET `/api/challenges`

Browse all active and upcoming challenges.

**Access:** Authenticated member

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `tenantId` | ulong | Gym tenant scope |
| `status` | string | `active`, `upcoming`, `completed` |
| `pageNumber` | int | Page (default: 1) |
| `pageSize` | int | Items per page (default: 20) |

**Response Data:**
```json
[
  {
    "challengeId": 10,
    "name": "30-Day Step Challenge",
    "description": "Hit 10,000 steps every day for 30 days.",
    "type": "steps",
    "targetValue": 10000,
    "targetUnit": "steps/day",
    "startsAt": "2026-07-01T00:00:00Z",
    "endsAt": "2026-07-31T23:59:59Z",
    "participantCount": 142,
    "isJoined": false
  }
]
```

---

### 🔜 POST `/api/challenges/{id}/join`

Join a challenge.

**Access:** Authenticated member

**Request Body:**
```json
{
  "userId": 42
}
```

**Responses:**
- `200 OK` — Joined successfully
- `400 Bad Request` — Challenge not open for registration
- `409 Conflict` — Already a participant

---

### 🔜 DELETE `/api/challenges/{id}/join`

Leave a challenge.

**Access:** Authenticated member

**Responses:**
- `200 OK` — Left the challenge

---

### 🔜 GET `/api/challenges/{id}/leaderboard`

View the challenge leaderboard.

**Access:** Authenticated member

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `pageNumber` | int | Page (default: 1) |
| `pageSize` | int | Items per page (default: 20) |

**Response Data:**
```json
{
  "challengeId": 10,
  "challengeName": "30-Day Step Challenge",
  "updatedAt": "2026-07-06T08:00:00Z",
  "myRank": 14,
  "entries": [
    { "rank": 1,  "userId": 99, "displayName": "Alex R.",  "value": 312000, "unit": "steps" },
    { "rank": 2,  "userId": 78, "displayName": "Sara M.",  "value": 295000, "unit": "steps" },
    { "rank": 14, "userId": 42, "displayName": "Jane D.",  "value": 210000, "unit": "steps" }
  ]
}
```

---

### 🔜 GET `/api/achievements/{userId}`

View all earned achievements and badges for the member.

**Access:** Authenticated member (own achievements)

**Response Data:**
```json
[
  {
    "achievementId": 5,
    "name": "Iron Will",
    "description": "Complete 50 gym check-ins",
    "badgeUrl": "https://cdn.example.com/badges/iron-will.png",
    "earnedAt": "2026-06-20T09:00:00Z"
  },
  {
    "achievementId": 8,
    "name": "First Rep",
    "description": "Log your first workout session",
    "badgeUrl": "https://cdn.example.com/badges/first-rep.png",
    "earnedAt": "2026-01-11T10:30:00Z"
  }
]
```

---

### 🔜 GET `/api/achievements`

Browse all available achievements (locked and unlocked).

**Access:** Authenticated member

**Response Data:**
```json
[
  {
    "achievementId": 5,
    "name": "Iron Will",
    "description": "Complete 50 gym check-ins",
    "badgeUrl": "https://cdn.example.com/badges/iron-will.png",
    "isEarned": true,
    "progress": { "current": 50, "required": 50 }
  },
  {
    "achievementId": 12,
    "name": "Century Club",
    "description": "Complete 100 gym check-ins",
    "badgeUrl": "https://cdn.example.com/badges/century.png",
    "isEarned": false,
    "progress": { "current": 50, "required": 100 }
  }
]
```

---

### 🔜 GET `/api/social/feed/{userId}`

Get the social activity feed for a member (own + followed members).

**Access:** Authenticated member

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `pageNumber` | int | Page (default: 1) |
| `pageSize` | int | Items per page (default: 20) |

**Response Data:**
```json
[
  {
    "postId": 300,
    "userId": 42,
    "displayName": "Jane D.",
    "avatarUrl": "https://cdn.example.com/avatar.jpg",
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

### 🔜 POST `/api/social/follow/{userId}`

Follow another member's activity.

**Access:** Authenticated member

**Path Parameters:**

| Param | Description |
|---|---|
| `userId` | ID of the member to follow |

**Responses:**
- `200 OK` — Now following
- `409 Conflict` — Already following

---

### 🔜 DELETE `/api/social/follow/{userId}`

Unfollow a member.

**Access:** Authenticated member

**Responses:**
- `200 OK` — Unfollowed

---

### 🔜 POST `/api/social/posts/{id}/like`

Like a social post.

**Access:** Authenticated member

**Responses:**
- `200 OK` — Post liked

---

### 🔜 DELETE `/api/social/posts/{id}/like`

Unlike a post.

**Access:** Authenticated member

**Responses:**
- `200 OK` — Like removed

---

### 🔜 POST `/api/social/posts/{id}/comments`

Comment on a social post.

**Access:** Authenticated member

**Request Body:**
```json
{
  "userId": 42,
  "text": "Amazing effort! Keep it up 🔥"
}
```

**Responses:**
- `200 OK` — Comment posted

---

### 🔜 GET `/api/social/posts/{id}/comments`

Get comments on a social post.

**Access:** Authenticated member

**Response Data:**
```json
[
  {
    "commentId": 50,
    "userId": 99,
    "displayName": "Alex R.",
    "text": "Amazing effort! Keep it up 🔥",
    "postedAt": "2026-07-06T11:00:00Z"
  }
]
```

---

## 9. Notifications & Support

**Base route:** `/api/notifications` | `/api/preferences` | `/api/ai/support`

> 🔜 All endpoints in this section are **planned**.

Members manage their notification inbox, control channel preferences and opt-outs, and get instant AI-powered support.

---

### 🔜 GET `/api/notifications/{userId}`

Get the member's notification inbox.

**Access:** Authenticated member (own inbox)

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `isRead` | bool | Filter by read/unread |
| `type` | string | Filter by type (e.g. `billing`, `class`, `achievement`) |
| `pageNumber` | int | Page (default: 1) |
| `pageSize` | int | Items per page (default: 20) |

**Response Data:**
```json
{
  "unreadCount": 3,
  "notifications": [
    {
      "id": 600,
      "type": "billing",
      "title": "Renewal in 3 days",
      "body": "Your Premium Monthly plan renews on July 9. Ensure your payment method is up to date.",
      "isRead": false,
      "createdAt": "2026-07-06T08:00:00Z",
      "actionUrl": "/billing"
    },
    {
      "id": 601,
      "type": "achievement",
      "title": "Badge Unlocked: Iron Will",
      "body": "You've completed 50 gym check-ins. Congratulations!",
      "isRead": false,
      "createdAt": "2026-07-05T10:00:00Z",
      "actionUrl": "/achievements"
    }
  ]
}
```

---

### 🔜 PUT `/api/notifications/{id}/read`

Mark a notification as read.

**Access:** Authenticated member

**Responses:**
- `200 OK` — Notification marked as read

---

### 🔜 PUT `/api/notifications/{userId}/read-all`

Mark all notifications as read.

**Access:** Authenticated member

**Responses:**
- `200 OK` — All notifications marked as read

---

### 🔜 GET `/api/preferences/{userId}`

Get the member's current notification channel preferences.

**Access:** Authenticated member (own preferences)

**Response Data:**
```json
{
  "userId": 42,
  "channels": {
    "push":      { "enabled": true },
    "email":     { "enabled": true },
    "sms":       { "enabled": false },
    "whatsapp":  { "enabled": true }
  },
  "categories": {
    "billing":       { "push": true,  "email": true,  "sms": false },
    "class-reminders":{ "push": true,  "email": false, "sms": false },
    "marketing":     { "push": false, "email": false, "sms": false },
    "achievements":  { "push": true,  "email": true,  "sms": false }
  }
}
```

---

### 🔜 PUT `/api/preferences/{userId}`

Update notification channel preferences.

**Access:** Authenticated member

**Request Body:**
```json
{
  "channels": {
    "sms": { "enabled": false },
    "whatsapp": { "enabled": true }
  },
  "categories": {
    "marketing": { "push": false, "email": false, "sms": false, "whatsapp": false }
  }
}
```

**Responses:**
- `200 OK` — Preferences updated

---

### 🔜 POST `/api/preferences/{userId}/opt-out`

Opt out of a specific notification category entirely.

**Access:** Authenticated member

**Request Body:**
```json
{
  "category": "marketing"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `category` | string | ✅ | Category to opt out of: `marketing`, `class-reminders`, `billing`, `achievements` |

**Responses:**
- `200 OK` — Opted out

---

### 🔜 POST `/api/ai/support/route`

Send a support message to the AI bot; routes to a human agent if the bot cannot resolve it.

**Access:** Authenticated member

**Request Body:**
```json
{
  "userId": 42,
  "message": "I was charged twice for my membership this month.",
  "conversationId": "support_conv_xyz"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `message` | string | ✅ | Member's support query |
| `conversationId` | string | ❌ | Continue existing support thread |

**Response Data:**
```json
{
  "reply": "I can see two charges on July 1 and July 3. The July 3 charge appears to be a duplicate and has been flagged for review. A refund will be processed within 3–5 business days.",
  "conversationId": "support_conv_xyz",
  "resolvedBy": "ai",
  "escalated": false,
  "ticketId": null
}
```

If the AI cannot resolve the issue, `escalated` is `true` and a `ticketId` is returned for human agent follow-up:

```json
{
  "reply": "I've connected you with a support agent who will follow up within 2 hours.",
  "conversationId": "support_conv_xyz",
  "resolvedBy": "human-agent",
  "escalated": true,
  "ticketId": "TKT-20260706-001"
}
```

---

### 🔜 GET `/api/ai/support/suggestions/{userId}`

Get AI-suggested answers to common questions based on the member's account context.

**Access:** Authenticated member

**Response Data:**
```json
[
  { "question": "How do I freeze my membership?",       "actionUrl": "/billing/freeze" },
  { "question": "When does my plan renew?",             "actionUrl": "/billing" },
  { "question": "How do I book a personal trainer?",   "actionUrl": "/schedule/pt-sessions" }
]
```

---

## 10. Live & Realtime Experiences

**WebSocket base:** `wss://<host>/ws`

> 🔜 All endpoints in this section are **planned**.

Low-latency, bidirectional WebSocket connections for live coaching, posture feedback, workout sync, and leaderboard updates.

---

### Connection Pattern

All WebSocket connections follow this flow:

1. Authenticate via REST to get an access token
2. Connect to the WebSocket URL with the token as a query parameter:
   ```
   wss://api.example.com/ws/<channel>?token=<accessToken>
   ```
3. Send/receive JSON message frames
4. Server sends `ping` frames every 30 seconds; client must respond with `pong`
5. Close connection with a standard WebSocket close frame when done

**Standard error frame:**
```json
{
  "type": "error",
  "code": "unauthorized",
  "message": "Token expired. Reconnect with a fresh access token."
}
```

---

### 🔜 WS `/ws/notifications?token={token}`

Real-time push channel for in-app notifications.

**Access:** Authenticated member

**Server → Client message types:**

| `type` | Description |
|---|---|
| `notification.new` | A new notification has arrived |
| `notification.update` | An existing notification was updated (e.g. read status) |
| `ping` | Keepalive ping — respond with `pong` |

**Example inbound frame:**
```json
{
  "type": "notification.new",
  "data": {
    "id": 602,
    "notificationType": "class-reminder",
    "title": "Class starts in 30 minutes",
    "body": "Morning Spin with Mark Johnson at 7:00 AM",
    "actionUrl": "/schedule",
    "createdAt": "2026-07-07T06:30:00Z"
  }
}
```

---

### 🔜 WS `/ws/live-coaching?token={token}&sessionId={sessionId}`

Join a live personal training session with real-time video/audio and coaching cues.

**Access:** Authenticated member (must have a booked PT session)

**Client → Server message types:**

| `type` | Payload | Description |
|---|---|---|
| `join` | `{ "sessionId": "..." }` | Join the coaching room |
| `leave` | — | Leave the session |
| `heartbeat` | `{ "timestamp": "..." }` | Keep session alive |

**Server → Client message types:**

| `type` | Description |
|---|---|
| `session.started` | Trainer has started the session |
| `coaching.cue` | Live text/audio coaching instruction from trainer |
| `session.ended` | Session has finished |
| `participant.joined` | Another participant joined (group session) |

**Example `coaching.cue` frame:**
```json
{
  "type": "coaching.cue",
  "data": {
    "text": "Keep your back straight, drive through those heels!",
    "audioUrl": "https://cdn.example.com/cues/backstraight.mp3",
    "timestamp": "2026-07-08T10:14:32Z"
  }
}
```

---

### 🔜 WS `/ws/posture-feed?token={token}&sessionId={sessionId}`

Receive real-time posture correction feedback during a tracked exercise.

**Access:** Authenticated member

**Connection:** Established after calling `POST /api/ai/posture/realtime` to get the `sessionId`.

**Client → Server:** Stream video frames as binary WebSocket messages (JPEG/WebP)

**Server → Client message types:**

| `type` | Description |
|---|---|
| `posture.ok` | Form is correct — no correction needed |
| `posture.correction` | Issue detected — includes correction details |
| `posture.rep_counted` | A valid rep was detected and counted |
| `session.summary` | Final session summary after workout ends |

**Example `posture.correction` frame:**
```json
{
  "type": "posture.correction",
  "data": {
    "issue": "Knee cave detected",
    "severity": "medium",
    "correction": "Push your knees out in line with your toes",
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
    "exerciseId": 1,
    "repNumber": 5,
    "formScore": 88,
    "timestamp": "2026-07-06T09:12:48Z"
  }
}
```

---

### 🔜 WS `/ws/workout-session/{sessionId}?token={token}`

Sync an in-progress workout session across multiple devices in near real-time.

**Access:** Authenticated member (own active session)

**Client → Server message types:**

| `type` | Payload | Description |
|---|---|---|
| `set.logged` | `{ exerciseId, setNo, reps, weightKg, rpe }` | Log a completed set |
| `session.pause` | — | Pause the active session |
| `session.resume` | — | Resume a paused session |
| `session.end` | `{ notes, calories }` | Mark session as complete |

**Server → Client message types:**

| `type` | Description |
|---|---|
| `sync.state` | Full session state — sent on reconnect |
| `set.confirmed` | Set log acknowledged and saved |
| `session.updated` | Session state changed on another device |

**Example `sync.state` frame (sent on device reconnect):**
```json
{
  "type": "sync.state",
  "data": {
    "sessionId": "sess_abc123",
    "workoutId": 10,
    "startedAt": "2026-07-06T09:00:00Z",
    "currentExerciseIndex": 2,
    "setsLogged": [
      { "exerciseId": 1, "setNo": 1, "reps": 8, "weightKg": 80.0 },
      { "exerciseId": 1, "setNo": 2, "reps": 8, "weightKg": 82.5 }
    ],
    "elapsedSec": 1240
  }
}
```

---

### 🔜 WS `/ws/leaderboard?token={token}&challengeId={id}`

Subscribe to live leaderboard updates during an active challenge.

**Access:** Authenticated member (must be a challenge participant)

**Server → Client message types:**

| `type` | Description |
|---|---|
| `leaderboard.update` | A participant's score or rank changed |
| `leaderboard.snapshot` | Full leaderboard snapshot (sent on connect) |
| `challenge.ended` | Challenge has finished — final standings |

**Example `leaderboard.update` frame:**
```json
{
  "type": "leaderboard.update",
  "data": {
    "userId": 99,
    "displayName": "Alex R.",
    "newValue": 315000,
    "newRank": 1,
    "previousRank": 2,
    "unit": "steps",
    "updatedAt": "2026-07-06T09:05:00Z"
  }
}
```

---

## HTTP Status Code Reference

| Code | Meaning |
|---|---|
| `200 OK` | Request succeeded |
| `201 Created` | Resource created |
| `400 Bad Request` | Validation error or bad input |
| `401 Unauthorized` | Not authenticated or token expired |
| `403 Forbidden` | Authenticated but not authorized (e.g. accessing another member's data) |
| `404 Not Found` | Resource does not exist |
| `409 Conflict` | Duplicate action (e.g. already booked, already following) |
| `500 Internal Server Error` | Unhandled server error |

---

## Pagination

All list endpoints that support pagination use consistent query parameters:
- `pageNumber` (int, default: 1)
- `pageSize` (int, default: 20)

**Paginated response envelope:**
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pageNumber": 1,
    "pageSize": 20,
    "totalCount": 240,
    "totalPages": 12
  }
}
```

---

## Implementation Roadmap Summary

| Module | Status | Notes |
|---|---|---|
| Account & Authentication | ✅ Implemented | Auth, SSO, Biometric controllers exist |
| Profile & Membership | ✅ / 🔜 Partial | Profile endpoints exist; subscription management planned |
| Workouts & Training | ✅ Implemented | Exercise, Workout, Plan controllers exist |
| AI Coaching | 🔜 Planned | No AI controller yet |
| Health & Wellness Tracking | 🔜 Planned | No tracking controller yet |
| Classes, Booking & Attendance | 🔜 Planned | No classes/attendance controller yet |
| Billing & Payments | 🔜 Planned | No billing/payments controller yet |
| Gamification & Social | 🔜 Planned | No challenges/social controller yet |
| Notifications & Support | 🔜 Planned | No notifications controller yet |
| Live & Realtime (WebSockets) | 🔜 Planned | No WebSocket infrastructure yet |

---

*Documentation generated from source — July 5, 2026*
