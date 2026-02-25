# LITTR App API Reference

## Overview

The LITTR App API serves the LITTR mobile application and web frontend. All endpoints are under `/api/app/` and return a consistent JSON response format.

**Base URL:** `https://littr.co/api/app`

## Authentication

### Session-Based Auth

Authenticated endpoints require the `X-Session-Id` header:

```
X-Session-Id: <session-id>
```

Sessions are created via login or register and expire after 7 days.

### Register

**POST /api/app/auth/register**

```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "recaptchaToken": "..."
}
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid-string",
    "email": "user@example.com",
    "role": "CUSTOMER"
  },
  "sessionId": "session-uuid"
}
```

### Login

**POST /api/app/auth/login**

```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "recaptchaToken": "..."
}
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid-string",
    "email": "user@example.com",
    "role": "CUSTOMER",
    "themePreference": "light"
  },
  "sessionId": "session-uuid"
}
```

### Forgot Password

**POST /api/app/auth/forgot-password**

```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "ok": true,
  "message": "If an account exists, a reset email has been sent"
}
```

## Response Format

All `/api/app/` endpoints return:

```json
{
  "ok": true,
  "data": { ... }
}
```

Or on error:

```json
{
  "ok": false,
  "error": "Human-readable error message"
}
```

Paginated endpoints additionally return:

```json
{
  "ok": true,
  "data": [ ... ],
  "total": 150,
  "page": 1,
  "limit": 20
}
```

## Pagination

Paginated endpoints accept query parameters:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `page` | 1 | Page number (1-indexed) |
| `limit` | 20 | Items per page (max 100) |

## Error Codes

| HTTP Status | Meaning |
|-------------|---------|
| 200 | Success |
| 400 | Bad request (missing/invalid parameters) |
| 401 | Not authenticated (missing or expired session) |
| 403 | Forbidden (insufficient role) |
| 404 | Resource not found |
| 409 | Conflict (e.g., email already registered) |
| 429 | Rate limited |
| 500 | Server error |

---

## Guest Endpoints (No Auth Required)

### List Shops

**GET /api/app/shops**

Returns all verified shops with locations for map display.

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "name": "Elite Smoke Shop",
      "address": "123 Main St",
      "city": "Rochester",
      "latitude": 43.1566,
      "longitude": -77.6088
    }
  ]
}
```

### Shop Detail

**GET /api/app/shops/:id**

**Response:**
```json
{
  "ok": true,
  "data": {
    "id": 1,
    "name": "Elite Smoke Shop",
    "address": "123 Main St",
    "city": "Rochester",
    "latitude": 43.1566,
    "longitude": -77.6088,
    "binsCount": 2,
    "rewardConfig": {
      "enabled": true
    }
  }
}
```

### Brand Catalog

**GET /api/app/brands**

Returns all brands with their subtypes.

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "name": "Geek Bar",
      "suggested": false,
      "subtypes": [
        { "id": 1, "brandId": 1, "name": "Pulse X", "suggested": false }
      ]
    }
  ]
}
```

---

## Customer Endpoints (CUSTOMER Auth)

### Current User Profile

**GET /api/app/me**

**Response:**
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "CUSTOMER"
  }
}
```

### Update Profile

**PATCH /api/app/me**

```json
{
  "displayName": "Jane Doe"
}
```

**Response:**
```json
{
  "ok": true,
  "data": { "id": "uuid", "email": "user@example.com", "role": "CUSTOMER" }
}
```

### Change Password

**PATCH /api/app/me/password**

```json
{
  "currentPassword": "oldPass123",
  "newPassword": "newPass456"
}
```

**Response:**
```json
{
  "ok": true,
  "data": { "message": "Password changed" }
}
```

### Wallet

**GET /api/app/wallet**

**Response:**
```json
{
  "ok": true,
  "data": {
    "balance": 42,
    "lifetimeEarned": 150,
    "transactions": [
      {
        "id": 1,
        "amount": 3,
        "type": "EARN",
        "description": "Recycling reward at Elite Smoke Shop",
        "createdAt": "2025-01-15T10:30:00.000Z"
      }
    ]
  }
}
```

### Drop History

**GET /api/app/drops**

Query params: `?page=1&limit=20&status=approved`

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "id": 123,
      "binId": 1,
      "shopId": 1,
      "status": "approved",
      "category": "Nicotine",
      "brand": "Elf Bar",
      "subtype": "BC5000",
      "flavor": "Blue Razz Ice",
      "pointsAwarded": 2,
      "aiConfidence": 0.92,
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  ],
  "total": 45,
  "page": 1,
  "limit": 20
}
```

### Drop Detail

**GET /api/app/drops/:id**

**Response:**
```json
{
  "ok": true,
  "data": {
    "id": 123,
    "binId": 1,
    "shopId": 1,
    "status": "approved",
    "category": "Nicotine",
    "brand": "Elf Bar",
    "subtype": "BC5000",
    "flavor": "Blue Razz Ice",
    "weightGrams": 12.5,
    "pointsAwarded": 2,
    "aiConfidence": 0.92,
    "aiModelVersion": "openai-gpt-4o-v1",
    "createdAt": "2025-01-15T10:30:00.000Z",
    "images": [
      {
        "id": 1,
        "imageRole": "after",
        "storageUrl": "data:image/jpeg;base64,...",
        "createdAt": "2025-01-15T10:30:05.000Z"
      }
    ],
    "aiJobs": [
      {
        "id": 1,
        "status": "done",
        "provider": "openai",
        "finishedAt": "2025-01-15T10:30:10.000Z"
      }
    ],
    "appeals": []
  }
}
```

### Submit Appeal

**POST /api/app/drops/:id/appeal**

Submit an appeal on a denied drop.

```json
{
  "reason": "This is a nicotine vape, not THC. It's an Elf Bar BC5000."
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "id": 1,
    "dropId": 123,
    "type": "appeal",
    "payloadJson": { "reason": "This is a nicotine vape..." },
    "createdAt": "2025-01-15T11:00:00.000Z"
  }
}
```

### Self-Report

**POST /api/app/drops/:id/self-report**

Self-report the brand/subtype/flavor on an approved drop for bonus points.

```json
{
  "brand": "Elf Bar",
  "subtype": "BC5000",
  "flavor": "Blue Razz Ice"
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "id": 2,
    "dropId": 123,
    "type": "self_report",
    "payloadJson": { "brand": "Elf Bar", "subtype": "BC5000", "flavor": "Blue Razz Ice" },
    "createdAt": "2025-01-15T11:00:00.000Z"
  }
}
```

### Store

**GET /api/app/store**

List available rewards for customers.

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "name": "Free Vape Juice Sample",
      "description": "Redeem for a free sample at participating shops",
      "pointsCost": 50,
      "imageUrl": null,
      "active": true,
      "stock": 100
    }
  ]
}
```

### Redeem Reward

**POST /api/app/store/redeem**

```json
{
  "storeItemId": 1
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "id": 1,
    "storeItemId": 1,
    "pointsSpent": 50,
    "status": "PENDING",
    "createdAt": "2025-01-15T11:00:00.000Z"
  }
}
```

### Redemption History

**GET /api/app/redemptions**

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "storeItemId": 1,
      "pointsSpent": 50,
      "status": "FULFILLED",
      "fulfilledAt": "2025-01-16T10:00:00.000Z",
      "createdAt": "2025-01-15T11:00:00.000Z"
    }
  ]
}
```

### Claim Points

**POST /api/app/claim**

Claim points from a QR code token. Supports auto-registration for new users.

```json
{
  "token": "abc123def456...",
  "email": "user@example.com",
  "password": "pass123"
}
```

If the user is already authenticated via `X-Session-Id`, `email` and `password` are not required.

**Response:**
```json
{
  "ok": true,
  "receipt": {
    "points": 5,
    "shopName": "Elite Smoke Shop",
    "timestamp": "2025-01-15T10:35:00.000Z",
    "newBalance": 47
  }
}
```

### Notifications

**GET /api/app/notifications**

**Response:**
```json
{
  "ok": true,
  "data": []
}
```

### Phone Scan

**POST /api/app/scan**

Upload a photo of a vape for identification (no physical drop required).

```json
{
  "imageUrl": "data:image/jpeg;base64,..."
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "category": "Nicotine",
    "brand": "Elf Bar",
    "subtype": "BC5000",
    "flavor": "Blue Razz Ice",
    "confidence": 0.89
  }
}
```

---

## VeriScan Endpoints (Customer Auth)

### Validate QR

**GET /api/app/veriscan/validate**

Query params: `?binId=1&shopId=1&sig=...`

**Response:**
```json
{
  "ok": true,
  "data": {
    "shop": { "id": 1, "name": "Elite Smoke Shop", "address": "123 Main St" },
    "bin": { "id": 1, "name": "Bin A" },
    "bins": [
      { "id": 1, "name": "Bin A" },
      { "id": 2, "name": "Bin B" }
    ],
    "multiplesBins": true
  }
}
```

### Start Session

**POST /api/app/veriscan/session/start**

```json
{
  "shopId": 1,
  "binId": 1
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "id": 42,
    "userId": "uuid",
    "shopId": 1,
    "binId": 1,
    "status": "active",
    "expectedItemCount": 0,
    "dropsMatchedCount": 0,
    "createdAt": "2025-01-15T10:30:00.000Z"
  }
}
```

### Add Item

**POST /api/app/veriscan/session/:id/items**

```json
{
  "imageUrl": "data:image/jpeg;base64,..."
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "id": 1,
    "sessionId": 42,
    "imageUrl": "data:image/jpeg;base64,...",
    "aiBrand": "Elf Bar",
    "aiSubtype": "BC5000",
    "aiFlavor": "Blue Razz Ice",
    "aiConfidence": 0.87,
    "modifier": 2.0,
    "createdAt": "2025-01-15T10:30:05.000Z"
  }
}
```

### Confirm Item

**POST /api/app/veriscan/session/:id/items/:itemId/confirm**

```json
{
  "brand": "Elf Bar",
  "subtype": "BC5000",
  "flavor": "Blue Razz Ice"
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "id": 1,
    "sessionId": 42,
    "finalBrand": "Elf Bar",
    "finalSubtype": "BC5000",
    "finalFlavor": "Blue Razz Ice",
    "confirmedAt": "2025-01-15T10:30:15.000Z",
    "modifier": 2.0
  }
}
```

### Arm Bin

**POST /api/app/veriscan/session/:id/arm**

```json
{
  "timeoutSeconds": 60
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "id": 42,
    "status": "armed",
    "armStatus": "armed",
    "expiresAt": "2025-01-15T10:31:00.000Z",
    "expectedItemCount": 3
  }
}
```

### Session History

**GET /api/app/veriscan/sessions**

**Response:**
```json
{
  "ok": true,
  "data": []
}
```

---

## Partner Endpoints (PARTNER Auth)

### Partner Shops

**GET /api/app/partner/shops**

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "name": "Elite Smoke Shop",
      "address": "123 Main St",
      "city": "Rochester",
      "status": "VERIFIED"
    }
  ]
}
```

### Shop Detail

**GET /api/app/partner/shops/:id**

**Response:**
```json
{
  "ok": true,
  "data": {
    "id": 1,
    "name": "Elite Smoke Shop",
    "address": "123 Main St",
    "city": "Rochester",
    "status": "VERIFIED",
    "bins": [
      { "id": 1, "name": "Bin A", "status": "ONLINE", "fillLevel": 35 }
    ]
  }
}
```

### Shop Stats

**GET /api/app/partner/shops/:id/stats**

**Response:**
```json
{
  "ok": true,
  "data": {
    "totalDrops": 523,
    "todayDrops": 12,
    "totalPoints": 1847,
    "todayPoints": 38,
    "activeDevices": 2
  }
}
```

### Shop Drops

**GET /api/app/partner/shops/:id/drops**

Query params: `?page=1&limit=20`

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "id": 123,
      "shopId": 1,
      "pointsAwarded": 2,
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

### Shop Bins

**GET /api/app/partner/shops/:id/bins**

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "name": "Bin A",
      "status": "ONLINE",
      "fillLevel": 35,
      "vapeCount": 47,
      "lastTemperature": 28.5,
      "lastAirQuality": 450,
      "lastSeenAt": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

### Fire Alerts

**GET /api/app/partner/shops/:id/alerts**

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "binId": 1,
      "severity": "HIGH",
      "temperature": 72.5,
      "acknowledged": false,
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

### Acknowledge Alert

**POST /api/app/partner/shops/:id/alerts/:alertId/acknowledge**

**Response:**
```json
{
  "ok": true,
  "data": {
    "id": 1,
    "acknowledged": true,
    "acknowledgedAt": "2025-01-15T10:35:00.000Z"
  }
}
```

### Request Pickup

**POST /api/app/partner/shops/:id/pickup**

```json
{
  "notes": "Bin is 90% full, please schedule pickup this week"
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "id": 1,
    "shopId": 1,
    "status": "PENDING",
    "notes": "Bin is 90% full...",
    "createdAt": "2025-01-15T11:00:00.000Z"
  }
}
```

### Reward Config

**GET /api/app/partner/shops/:id/reward-config**

**Response:**
```json
{
  "ok": true,
  "data": {
    "id": 1,
    "shopId": 1,
    "enabled": true,
    "minSecondsBetweenSpins": 30,
    "dailySpinCap": 50,
    "dailyPointCap": 200,
    "rewardTableJson": [
      { "points": 1, "weight": 50 },
      { "points": 2, "weight": 30 },
      { "points": 3, "weight": 15 },
      { "points": 5, "weight": 4 },
      { "points": 10, "weight": 1 }
    ]
  }
}
```

### Update Reward Config

**PATCH /api/app/partner/shops/:id/reward-config**

```json
{
  "enabled": true,
  "dailySpinCap": 100
}
```

**Response:**
```json
{
  "ok": true,
  "data": { "id": 1, "shopId": 1, "enabled": true, "dailySpinCap": 100 }
}
```

### Partner Notifications

**GET /api/app/partner/notifications**

**Response:**
```json
{
  "ok": true,
  "data": []
}
```

---

## Staff Endpoints (STAFF Auth)

### Dashboard

**GET /api/app/staff/dashboard**

**Response:**
```json
{
  "ok": true,
  "data": {
    "totalDrops": 1523,
    "activeBins": 8,
    "pendingAppeals": 3,
    "flaggedUsers": 1,
    "dropsToday": 42
  }
}
```

### All Drops

**GET /api/app/staff/drops**

Query params: `?page=1&limit=20&status=denied&shopId=1`

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "id": 123,
      "binId": 1,
      "shopId": 1,
      "userId": "uuid",
      "status": "denied",
      "category": "THC",
      "brand": null,
      "aiConfidence": 0.85,
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  ],
  "total": 15,
  "page": 1,
  "limit": 20
}
```

### Drop Detail

**GET /api/app/staff/drops/:id**

**Response:**
```json
{
  "ok": true,
  "data": {
    "id": 123,
    "status": "denied",
    "category": "THC",
    "images": [ { "id": 1, "imageRole": "after", "storageUrl": "..." } ],
    "aiJobs": [ { "id": 1, "status": "done", "provider": "openai" } ],
    "appeals": []
  }
}
```

### Override Drop

**PATCH /api/app/staff/drops/:id/override**

```json
{
  "category": "Nicotine",
  "brand": "Elf Bar",
  "subtype": "BC5000",
  "status": "corrected"
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "id": 123,
    "status": "corrected",
    "category": "Nicotine",
    "brand": "Elf Bar",
    "overrideSource": "staff:admin@littr.co"
  }
}
```

### Appeals

**GET /api/app/staff/appeals**

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "dropId": 123,
      "type": "appeal",
      "payloadJson": { "reason": "This is a nicotine vape" },
      "resolution": null,
      "resolvedAt": null,
      "createdAt": "2025-01-15T11:00:00.000Z"
    }
  ]
}
```

### Resolve Appeal

**PATCH /api/app/staff/appeals/:id/resolve**

```json
{
  "resolution": "approved"
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "id": 1,
    "resolution": "approved",
    "resolvedAt": "2025-01-15T12:00:00.000Z",
    "resolvedById": "staff-uuid"
  }
}
```

### Flagged Users

**GET /api/app/staff/flagged-users**

Returns users with 3+ denied drops.

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "userId": "uuid",
      "deniedCount": 5,
      "categories": ["THC", "THC", "Trash", "THC", "Trash"]
    }
  ]
}
```

### All Bins

**GET /api/app/staff/bins**

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "shopId": 1,
      "name": "Bin A",
      "status": "ONLINE",
      "fillLevel": 35,
      "capabilities": {
        "hasWeight": false,
        "cameraMode": "s3cam",
        "uploadPolicy": "drop_only"
      }
    }
  ]
}
```

### Pair Claim

**POST /api/app/staff/pair-claim**

```json
{
  "pairCode": "AB1234",
  "shopId": 1
}
```

**Response:**
```json
{
  "ok": true,
  "message": "Use /api/v2/device/pair-claim for full pairing flow"
}
```

---

## Rate Limiting

| Endpoint Category | Limit |
|-------------------|-------|
| Auth (login/register) | 10 requests per minute per IP |
| Drop submit | 1 request per 20 seconds per device |
| Telemetry | 1 request per 30 seconds per device |
| General API | 100 requests per minute per session |
| VeriScan AI | 10 requests per minute per session |

Rate-limited responses return HTTP 429:
```json
{
  "ok": false,
  "error": "Too fast",
  "waitSeconds": 15
}
```
