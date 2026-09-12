# Module Access API Documentation

> **Base URL:** `https://<host>/api/module-access`
> **Access:** Admin only
> **Auth:** JWT Bearer — `Authorization: Bearer <token>`

---

## Overview

The Module Access API controls **which platform modules each role can access**, and at what level of action (view, create, edit, delete, export).

Each access record links a **Role** to a **Module** within a **Tenant**, and stores five independent permission flags.

### Data Model

| Field | Type | Description |
|---|---|---|
| `id` | ulong | Record ID |
| `tenantId` | ulong | Gym tenant this rule belongs to |
| `roleId` | ulong | Role being granted access |
| `roleName` | string | Role name (e.g. `admin`, `trainer`, `client`) |
| `module` | string | Module key (e.g. `members`, `billing`) |
| `canView` | bool | Can list and read records |
| `canCreate` | bool | Can create new records |
| `canEdit` | bool | Can update existing records |
| `canDelete` | bool | Can delete or archive records |
| `canExport` | bool | Can export data as CSV/PDF/Excel |
| `isActive` | bool | Whether this rule is currently active |
| `updatedAt` | datetime | Last modified timestamp |

### Available Module Keys

```
members          trainers         leads            onboarding       corporate
exercises        workouts         plans            workout-automation
branches         tenants          roles
billing          payments         invoices         subscriptions
classes          attendance       pt-sessions
analytics        reports
notifications    campaigns
automations      webhooks
integrations     api-keys
ai-insights
gamification     social
media            forms
settings
```

---

## Response Envelope

All endpoints return:

```json
{
  "success": true,
  "message": "Operation successful.",
  "data": { },
  "errors": []
}
```

---

## Endpoints

### 1. GET `/api/module-access/modules`

List all platform module keys available for access configuration.

**Access:** Admin

**No parameters required.**

**Response:**
```json
{
  "success": true,
  "message": "Available modules.",
  "data": [
    "members", "trainers", "leads", "onboarding", "corporate",
    "exercises", "workouts", "plans", "workout-automation",
    "branches", "tenants", "roles",
    "billing", "payments", "invoices", "subscriptions",
    "classes", "attendance", "pt-sessions",
    "analytics", "reports",
    "notifications", "campaigns",
    "automations", "webhooks",
    "integrations", "api-keys",
    "ai-insights",
    "gamification", "social",
    "media", "forms",
    "settings"
  ]
}
```

**Status Codes:**
- `200 OK` — Returns module key list

---

### 2. GET `/api/module-access?tenantId={id}&roleId={id}`

Get all module access entries configured for a specific role within a tenant.

**Access:** Admin

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `tenantId` | ulong | ✅ | Tenant to scope the query |
| `roleId` | ulong | ✅ | Role to retrieve access for |

**Response:**
```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "id": 1,
      "tenantId": 1,
      "roleId": 2,
      "roleName": "trainer",
      "module": "members",
      "canView": true,
      "canCreate": false,
      "canEdit": false,
      "canDelete": false,
      "canExport": false,
      "isActive": true,
      "updatedAt": "2026-07-05T10:00:00Z"
    },
    {
      "id": 2,
      "tenantId": 1,
      "roleId": 2,
      "roleName": "trainer",
      "module": "workouts",
      "canView": true,
      "canCreate": true,
      "canEdit": true,
      "canDelete": false,
      "canExport": false,
      "isActive": true,
      "updatedAt": "2026-07-05T10:00:00Z"
    }
  ]
}
```

**Status Codes:**
- `200 OK` — Returns list of access entries (empty array if none configured)
- `400 Bad Request` — `tenantId` or `roleId` is 0 or missing

---

### 3. GET `/api/module-access/matrix?tenantId={id}`

Get the full module access matrix for a tenant — every configured module grouped with all roles that have access to it. Useful for rendering an admin permission grid.

**Access:** Admin

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `tenantId` | ulong | ✅ | Tenant to scope the matrix |

**Response:**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "tenantId": 1,
    "matrix": {
      "members": [
        {
          "roleId": 1,
          "roleName": "admin",
          "canView": true,
          "canCreate": true,
          "canEdit": true,
          "canDelete": true,
          "canExport": true
        },
        {
          "roleId": 2,
          "roleName": "trainer",
          "canView": true,
          "canCreate": false,
          "canEdit": false,
          "canDelete": false,
          "canExport": false
        }
      ],
      "billing": [
        {
          "roleId": 1,
          "roleName": "admin",
          "canView": true,
          "canCreate": true,
          "canEdit": true,
          "canDelete": false,
          "canExport": true
        }
      ],
      "workouts": [
        {
          "roleId": 2,
          "roleName": "trainer",
          "canView": true,
          "canCreate": true,
          "canEdit": true,
          "canDelete": false,
          "canExport": false
        },
        {
          "roleId": 3,
          "roleName": "client",
          "canView": true,
          "canCreate": false,
          "canEdit": false,
          "canDelete": false,
          "canExport": false
        }
      ]
    }
  }
}
```

> The matrix only includes modules that have been explicitly configured. Modules with no entries are not shown.

**Status Codes:**
- `200 OK` — Returns matrix object
- `400 Bad Request` — `tenantId` is 0 or missing

---

### 4. POST `/api/module-access`

Set (upsert) access for a single module + role combination. If a record already exists for this `tenantId` + `roleId` + `module`, it is updated. Otherwise a new record is created.

**Access:** Admin

**Request Body:**
```json
{
  "tenantId": 1,
  "roleId": 2,
  "module": "members",
  "canView": true,
  "canCreate": false,
  "canEdit": false,
  "canDelete": false,
  "canExport": false
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `tenantId` | ulong | ✅ | Tenant scope |
| `roleId` | ulong | ✅ | Role to configure |
| `module` | string | ✅ | Module key (see available modules above) |
| `canView` | bool | ✅ | Grant view access |
| `canCreate` | bool | ✅ | Grant create access |
| `canEdit` | bool | ✅ | Grant edit access |
| `canDelete` | bool | ✅ | Grant delete access |
| `canExport` | bool | ✅ | Grant export access |

**Response:**
```json
{
  "success": true,
  "message": "Module access updated.",
  "data": {
    "id": 1,
    "tenantId": 1,
    "roleId": 2,
    "roleName": "trainer",
    "module": "members",
    "canView": true,
    "canCreate": false,
    "canEdit": false,
    "canDelete": false,
    "canExport": false,
    "isActive": true,
    "updatedAt": "2026-07-05T10:00:00Z"
  }
}
```

**Status Codes:**
- `200 OK` — Access record created or updated
- `400 Bad Request` — Validation failed

**Validation Rules:**
- `tenantId` must be > 0
- `roleId` must be > 0
- `module` must not be empty and must be ≤ 100 characters

---

### 5. POST `/api/module-access/bulk`

Bulk upsert access for multiple modules for a single role in one request. Maximum 50 module entries per call.

**Access:** Admin

**Request Body:**
```json
{
  "tenantId": 1,
  "roleId": 2,
  "modules": [
    {
      "module": "members",
      "canView": true,
      "canCreate": false,
      "canEdit": false,
      "canDelete": false,
      "canExport": false
    },
    {
      "module": "workouts",
      "canView": true,
      "canCreate": true,
      "canEdit": true,
      "canDelete": false,
      "canExport": false
    },
    {
      "module": "plans",
      "canView": true,
      "canCreate": true,
      "canEdit": true,
      "canDelete": false,
      "canExport": false
    },
    {
      "module": "analytics",
      "canView": false,
      "canCreate": false,
      "canEdit": false,
      "canDelete": false,
      "canExport": false
    }
  ]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `tenantId` | ulong | ✅ | Tenant scope |
| `roleId` | ulong | ✅ | Role to configure |
| `modules` | array | ✅ | List of module entries (1–50) |
| `modules[].module` | string | ✅ | Module key |
| `modules[].canView` | bool | ✅ | |
| `modules[].canCreate` | bool | ✅ | |
| `modules[].canEdit` | bool | ✅ | |
| `modules[].canDelete` | bool | ✅ | |
| `modules[].canExport` | bool | ✅ | |

**Response:**
```json
{
  "success": true,
  "message": "4 module access entries updated.",
  "data": [
    {
      "id": 1, "tenantId": 1, "roleId": 2, "roleName": "trainer",
      "module": "members",  "canView": true,  "canCreate": false, "canEdit": false, "canDelete": false, "canExport": false,
      "isActive": true, "updatedAt": "2026-07-05T10:00:00Z"
    },
    {
      "id": 2, "tenantId": 1, "roleId": 2, "roleName": "trainer",
      "module": "workouts", "canView": true,  "canCreate": true,  "canEdit": true,  "canDelete": false, "canExport": false,
      "isActive": true, "updatedAt": "2026-07-05T10:00:00Z"
    },
    {
      "id": 3, "tenantId": 1, "roleId": 2, "roleName": "trainer",
      "module": "plans",    "canView": true,  "canCreate": true,  "canEdit": true,  "canDelete": false, "canExport": false,
      "isActive": true, "updatedAt": "2026-07-05T10:00:00Z"
    },
    {
      "id": 4, "tenantId": 1, "roleId": 2, "roleName": "trainer",
      "module": "analytics","canView": false, "canCreate": false, "canEdit": false, "canDelete": false, "canExport": false,
      "isActive": true, "updatedAt": "2026-07-05T10:00:00Z"
    }
  ]
}
```

**Status Codes:**
- `200 OK` — All entries upserted, returns full result list
- `400 Bad Request` — Validation failed

**Validation Rules:**
- `tenantId` and `roleId` must be > 0
- `modules` must have at least 1 entry and no more than 50
- Each entry must have a non-empty `module` key

---

### 6. POST `/api/module-access/check?tenantId={id}`

Check whether a specific role is allowed to perform a specific action on a specific module. Designed for runtime authorization checks in the frontend.

**Access:** Admin

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `tenantId` | ulong | ✅ | Tenant scope |

**Request Body:**
```json
{
  "roleId": 2,
  "module": "billing",
  "action": "view"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `roleId` | ulong | ✅ | Role to check |
| `module` | string | ✅ | Module key to check |
| `action` | string | ✅ | One of: `view`, `create`, `edit`, `delete`, `export` |

**Response (access granted):**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "roleId": 2,
    "module": "billing",
    "action": "view",
    "isAllowed": true
  }
}
```

**Response (access denied):**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "roleId": 2,
    "module": "billing",
    "action": "delete",
    "isAllowed": false
  }
}
```

> `isAllowed: false` is returned as `200 OK` — it is not an error. The check itself succeeded; the role simply does not have that permission.

**Status Codes:**
- `200 OK` — Check executed, inspect `isAllowed`
- `400 Bad Request` — `tenantId` is 0, or validation failed on body

**Validation Rules:**
- `roleId` must be > 0
- `module` must not be empty
- `action` must be one of: `view`, `create`, `edit`, `delete`, `export`

---

### 7. DELETE `/api/module-access?tenantId={id}&roleId={id}&module={key}`

Remove the access record for a specific role on a specific module. This fully deletes the row — the role will have no configured access on that module.

**Access:** Admin

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `tenantId` | ulong | ✅ | Tenant scope |
| `roleId` | ulong | ✅ | Role to revoke access from |
| `module` | string | ✅ | Module key to revoke |

**Example request:**
```
DELETE /api/module-access?tenantId=1&roleId=2&module=billing
```

**Response:**
```json
{
  "success": true,
  "message": "Module access revoked.",
  "data": null
}
```

**Status Codes:**
- `200 OK` — Access record deleted
- `400 Bad Request` — Missing required query parameters
- `404 Not Found` — No access record exists for this role + module combination

---

### 8. DELETE `/api/module-access/role?tenantId={id}&roleId={id}`

Remove **all** module access records for a role under a tenant. Use this before deleting a role to clean up all its access entries.

**Access:** Admin

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `tenantId` | ulong | ✅ | Tenant scope |
| `roleId` | ulong | ✅ | Role whose access is being fully cleared |

**Example request:**
```
DELETE /api/module-access/role?tenantId=1&roleId=2
```

**Response:**
```json
{
  "success": true,
  "message": "All module access for role revoked.",
  "data": null
}
```

**Status Codes:**
- `200 OK` — All records for the role deleted
- `400 Bad Request` — Missing required query parameters
- `404 Not Found` — No access records found for this role

---

## HTTP Status Codes

| Code | Meaning |
|---|---|
| `200 OK` | Operation succeeded |
| `400 Bad Request` | Missing parameters or validation failure |
| `404 Not Found` | No matching access record found |

---

## Common Usage Patterns

### Configure a new custom role from scratch

1. Create the role via `POST /api/roles`
2. Call `POST /api/module-access/bulk` with all modules the role should access
3. Verify with `GET /api/module-access?tenantId=1&roleId=<newRoleId>`

### Render a permission grid in the admin UI

Call `GET /api/module-access/matrix?tenantId=1` — the response maps each module to all roles, ready to display as a table.

### Runtime frontend guard

Before showing a menu item or button, call:
```
POST /api/module-access/check?tenantId=1
{ "roleId": 2, "module": "billing", "action": "view" }
```
If `isAllowed: false`, hide the element.

### Remove all access before deleting a role

```
DELETE /api/module-access/role?tenantId=1&roleId=2
DELETE /api/roles/2
```

---

## Default Module Access by Built-in Role

| Module | admin | trainer | client |
|---|---|---|---|
| `members` | view, create, edit, delete, export | view | view (own) |
| `trainers` | view, create, edit, delete | view, edit (own) | view |
| `workouts` | all | view, create, edit, delete | view |
| `plans` | all | view, create, edit | view |
| `billing` | all | — | view (own) |
| `analytics` | all | — | — |
| `leads` | all | view, create, edit | — |
| `roles` | all | — | — |
| `settings` | all | — | — |

> These defaults must be seeded via `POST /api/module-access/bulk` per tenant — they are not applied automatically.
