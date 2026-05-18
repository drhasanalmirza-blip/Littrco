# LITTR Bin Camera Module API

## Overview

This document is the integration guide for camera modules that run inside or near LITTR smart bins. Camera modules capture images of deposited items for AI classification.

There are two supported camera module types:

| Module Type | Hardware | Use Case |
|-------------|----------|----------|
| `s3cam` | ESP32-S3-CAM | Low-cost, integrated directly into the bin |
| `android_cam` | Android phone (Pixel 3a) | Higher quality images, runs a companion app |

## Authentication

Camera modules authenticate using a **module token** issued during registration. Include this token in every request:

```
X-Module-Token: <your-module-token>
```

The token is tied to a specific `binId` and is returned once during registration. Store it securely on the module device.

## Registration

### POST /api/bin-module/register

Register a camera module with the server. Call this once when the module is first set up.

**Request:**
```json
{
  "binId": 1,
  "moduleType": "s3cam",
  "firmwareVersion": "1.0.0"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `binId` | integer | Yes | The bin this module is attached to |
| `moduleType` | string | Yes | `"s3cam"` or `"android_cam"` |
| `firmwareVersion` | string | No | Module firmware/app version |

**Response (200):**
```json
{
  "ok": true,
  "data": {
    "moduleToken": "a1b2c3d4e5f6...64-char-hex-string",
    "binId": 1,
    "capabilities": {
      "id": 1,
      "binId": 1,
      "hasWeight": false,
      "cameraMode": "s3cam",
      "uploadPolicy": "drop_only",
      "debugMode": false
    }
  }
}
```

**Save the `moduleToken`** — it is only returned during registration and cannot be retrieved again. If lost, re-register the module (a new token will be issued).

## Configuration

### GET /api/bin-module/config

Fetch the module's current capture configuration. Call on startup and periodically (every 5 minutes recommended).

**Headers:** `X-Module-Token: <token>`

**Response (200):**
```json
{
  "ok": true,
  "data": {
    "binId": 1,
    "cameraMode": "s3cam",
    "hasWeight": false,
    "cadence": {
      "idleIntervalSec": 60,
      "burstIntervalSec": 1,
      "burstDurationSec": 15,
      "cooldownIntervalSec": 5,
      "cooldownDurationSec": 60
    },
    "uploadPolicy": "drop_only",
    "debugMode": false
  }
}
```

### Capture Cadence

The cadence object controls how frequently the camera captures frames:

| Field | Default | Description |
|-------|---------|-------------|
| `idleIntervalSec` | 60 | Seconds between baseline captures when idle |
| `burstIntervalSec` | 1 | Seconds between captures during a drop event |
| `burstDurationSec` | 15 | How long burst mode lasts after drop detection |
| `cooldownIntervalSec` | 5 | Seconds between captures during cooldown |
| `cooldownDurationSec` | 60 | How long cooldown lasts after burst ends |

**Timing diagram:**
```
IDLE ──────────────► DROP DETECTED ──► BURST ──────► COOLDOWN ──► IDLE
(1 frame/60s)                         (1 frame/1s   (1 frame/5s
                                       for 15s)      for 60s)
```

### Upload Policies

| Policy | Behavior |
|--------|----------|
| `drop_only` | Only upload images captured during drop events. Baselines are NOT uploaded. |
| `drop_plus_baseline` | Upload drop images AND periodic baseline frames (for server-side diff computation). |
| `debug_all` | Upload all captured frames. Use only during development/debugging. |

## Heartbeat

### POST /api/bin-module/heartbeat

Report that the module is alive. Call every 60 seconds.

**Headers:** `X-Module-Token: <token>`

**Request:**
```json
{
  "freeBytes": 4194304,
  "totalFrames": 1523,
  "oldestFrame": "2025-01-15T08:00:00.000Z"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `freeBytes` | integer | No | Free storage space on module |
| `totalFrames` | integer | No | Total frames captured since boot |
| `oldestFrame` | string | No | ISO 8601 timestamp of oldest stored frame |

**Response (200):**
```json
{
  "ok": true
}
```

## Drop Image Upload

### POST /api/bin-module/drop-capture

Upload images captured during a drop event. This is the primary endpoint for sending drop-related images to the server.

**Important:** This endpoint stores the image and links it to the drop record. It does **NOT** trigger AI classification. AI runs only when the drop is explicitly submitted via the web API.

**Headers:** `X-Module-Token: <token>`

**Request:**
```json
{
  "dropId": 123,
  "imageRole": "after",
  "storageUrl": "data:image/jpeg;base64,/9j/4AAQ...",
  "hash": "sha256-hex-string"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `dropId` | integer | Yes | The drop this image belongs to (from main ESP32's drop event) |
| `imageRole` | string | Yes | One of: `"baseline"`, `"after"`, `"crop"`, `"debug"` |
| `storageUrl` | string | Yes | Image data as base64 data URL or external URL |
| `hash` | string | No | SHA-256 hash of the raw image data (for deduplication) |

### Image Roles

| Role | When to Capture | Description |
|------|-----------------|-------------|
| `baseline` | Before drop detected | Reference frame showing empty/prior state |
| `after` | After drop detected | Frame showing the deposited item |
| `crop` | After post-processing | Cropped/zoomed image of just the item (best for AI) |
| `debug` | Any time | Debug frames (only uploaded when `debugMode: true`) |

**Best practice:** Send at minimum an `after` image. If your module supports on-device cropping, also send a `crop` image — this produces the best AI classification results.

**Response (200):**
```json
{
  "ok": true,
  "data": {
    "id": 456,
    "dropId": 123,
    "imageRole": "after",
    "storageUrl": "data:image/jpeg;base64,/9j/4AAQ...",
    "hash": "sha256-hex-string",
    "createdAt": "2025-01-15T10:30:05.000Z"
  }
}
```

## Baseline Upload

### POST /api/bin-module/baseline

Upload a periodic baseline frame. Baselines are used for server-side diff computation to detect items.

**Important:** The server respects the `uploadPolicy` setting. If the policy is `drop_only`, baseline uploads are silently skipped (returns `skipped: true`).

**Headers:** `X-Module-Token: <token>`

**Request:**
```json
{
  "storageUrl": "data:image/jpeg;base64,/9j/4AAQ...",
  "hash": "sha256-hex-string"
}
```

**Response (200, accepted):**
```json
{
  "ok": true,
  "stored": true
}
```

**Response (200, skipped due to policy):**
```json
{
  "ok": true,
  "skipped": true,
  "reason": "uploadPolicy is drop_only"
}
```

## Pending Drops

### GET /api/bin-module/pending-drops

Poll for drops that need image capture. Use this as a fallback when the module missed the MQTT event from the main ESP32.

**Headers:** `X-Module-Token: <token>`

**Response (200):**
```json
{
  "ok": true,
  "data": [
    {
      "dropId": 123,
      "createdAt": "2025-01-15T10:30:00.000Z"
    },
    {
      "dropId": 124,
      "createdAt": "2025-01-15T10:31:00.000Z"
    }
  ]
}
```

Returns drops with `status: "awaiting_ai"` for this module's bin. After capturing images for a drop, upload them via `/api/bin-module/drop-capture`.

## ESP32-S3-CAM vs Android Camera

### ESP32-S3-CAM

- **Connection**: Connected directly to the bin's main ESP32 via UART or I2C
- **Image quality**: VGA (640x480) typical, lower quality
- **On-device processing**: Limited — send raw frames, let server crop
- **Power**: Powered by bin's main power supply
- **Recommended image roles**: `baseline`, `after` (skip `crop`)
- **Memory**: Limited — capture and upload sequentially, not in parallel

### Android Camera (Pixel 3a)

- **Connection**: WiFi connection to LITTR server
- **Image quality**: 12.2 MP, high quality
- **On-device processing**: Can do on-device cropping and preprocessing
- **Power**: Independent battery, needs charging solution
- **Recommended image roles**: `baseline`, `after`, `crop` (send all three)
- **Storage**: Large local storage — can buffer frames during connectivity issues

## Error Handling

### HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Process response |
| 400 | Bad request | Fix request parameters |
| 401 | Unauthorized | Module token invalid or missing. Re-register if needed. |
| 404 | Not found | Resource (drop, bin) doesn't exist |
| 500 | Server error | Retry with exponential backoff |

### Retry Strategy

Use exponential backoff for failed requests:

```
Attempt 1: wait 1 second
Attempt 2: wait 2 seconds
Attempt 3: wait 4 seconds
Attempt 4: wait 8 seconds
Attempt 5: wait 16 seconds
Max wait: 60 seconds
Max retries: 10
```

For image uploads that fail, store the image locally and retry on next heartbeat cycle. Do not discard images on upload failure.

### Offline Behavior

If the server is unreachable:

1. Continue capturing images according to cadence
2. Store images locally with metadata (dropId, imageRole, timestamp)
3. On reconnection, upload stored images oldest-first
4. Poll `/api/bin-module/pending-drops` to catch any missed drops
5. Resume normal heartbeat reporting

## Example: Complete Drop Capture Flow

```bash
# 1. Module starts up and fetches config
curl -H "X-Module-Token: $TOKEN" \
  https://littr.co/api/bin-module/config

# 2. Module reports heartbeat every 60s
curl -X POST -H "X-Module-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"freeBytes": 4194304, "totalFrames": 100}' \
  https://littr.co/api/bin-module/heartbeat

# 3. Main ESP32 detects drop, camera module captures "after" image
curl -X POST -H "X-Module-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dropId": 123,
    "imageRole": "after",
    "storageUrl": "data:image/jpeg;base64,/9j/4AAQ...",
    "hash": "abc123def456..."
  }' \
  https://littr.co/api/bin-module/drop-capture

# 4. If module supports cropping, also upload crop
curl -X POST -H "X-Module-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dropId": 123,
    "imageRole": "crop",
    "storageUrl": "data:image/jpeg;base64,/9j/4BBR...",
    "hash": "def789ghi012..."
  }' \
  https://littr.co/api/bin-module/drop-capture

# 5. If policy allows, upload periodic baseline
curl -X POST -H "X-Module-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "storageUrl": "data:image/jpeg;base64,/9j/4CCT...",
    "hash": "ghi345jkl678..."
  }' \
  https://littr.co/api/bin-module/baseline

# 6. Check for any missed drops
curl -H "X-Module-Token: $TOKEN" \
  https://littr.co/api/bin-module/pending-drops
```

---

## Phase 1 Classifier Extensions (Task #5)

The `drop-capture` route now also supports an event-scoped, idempotent flow.
Captures are stored and linked to a `Drop` by `eventId`. The route does **not**
auto-create the `Drop` row — if firmware uploads captures before posting the
drop, the captures are queued (with `dropId = null` on `drop_images`) and the
classifier runs once the drop arrives via `POST /api/drops/start` (with
`eventId`) or `POST /api/drops/:dropId/submit`. See `docs/CLASSIFIER.md` for the
verdict rules, race handling, and budget controls.

### `POST /api/bin-module/drop-capture` — event-scoped

Header: `X-Module-Token: <token>`

Body:
```json
{
  "eventId": "evt_<unique>",
  "imageRole": "after",          // baseline | after | crop | debug
  "imageBase64": "<JPEG base64>", // OR "storageUrl": "<URL>"
  "hash": "<optional content hash>"
}
```

Behavior:
- **Does NOT auto-create the drop.** If a `Drop` row with this `eventId`
  exists, the image is linked to it. Otherwise the image is stored with
  `dropId = null` and queued by `eventId`.
- **Idempotent** on `(eventId, imageRole)` — re-POSTs return the existing row
  with `idempotent: true`.
- JPEG bytes (if `imageBase64`) are stored under `uploads/captures/<binId>/`
  and served at `/uploads/...`.
- For `imageRole ∈ {after, crop}`: schedules `processCapture` via
  `queueMicrotask` **only if the drop already exists**. When the drop
  arrives later (via `/api/drops/start?eventId=...` or
  `/api/drops/:dropId/submit`), the server links orphan captures by
  `eventId` and runs `processCapture` then. Other roles skip the classifier.

Legacy fast-path: callers that send `{dropId, imageRole, storageUrl}` (no
`eventId`) keep the prior behavior — image is recorded against `dropId`, no
classifier is invoked.

### `GET /api/bin-module/drop-verdict?eventId=evt_xxx`

Header: `X-Module-Token: <token>`

Response:
```json
{ "ok": true, "data": {
  "eventId": "evt_xxx",
  "ready": true,
  "accepted": true,
  "reason": "vape",            // or "thc_vape" | "not_a_vape" | "uncertain" | "low_confidence" | "human:<label>"
  "reviewNeeded": false,
  "decidedAt": "2026-05-17T09:38:00.000Z"
}}
```

Poll every ~500ms for up to a few seconds. The verdict is set once the
classifier finishes (Phase 0 = instant pass-through; Phase 1 = ~1–3s).

---

# Unified Bin Lifecycle (v3) — Task #6

This section is the canonical, end-to-end reference for everything a smart bin
(ESP32 main controller + optional camera module) talks to. It supersedes the
"Pairing & registration" notes scattered above.

## 1. State Machine

```
                  +------------------------+
   (boot, no UID  |                        |
    pair record)  |   pair_request         |
        ----->    |   /api/v2/device/      |
                  |   pair-request         |
                  +-----------+------------+
                              | partner/staff redeems code
                              v
                  +------------------------+
                  |   PENDING_SETUP        |
                  |   (bin row created,    |
                  |    no rewards yet)     |
                  +-----------+------------+
                              | staff PATCH /api/staff/bins/:id/setup
                              v
                  +------------------------+   first telemetry      +-----------+
                  |   OFFLINE (configured) |  -------------------> |  ONLINE   |
                  +-----------+------------+                       +-----+-----+
                              ^                                          |
                              | (no telemetry for >N min)                |
                              +------------------------------------------+

  Any state above ONLINE can transition to FIRE_ALERT when
  /api/device/telemetry detects a fire condition.
```

Bins have two orthogonal properties set by staff during setup:

| Field         | Values                            | Meaning |
|---------------|-----------------------------------|---------|
| `mode`        | `demo`, `normal`                  | How `/api/v2/device/drop` decides reward points |
| `cameraModel` | `none`, `s3cam`, `android_cam`    | Which (if any) camera module talks to `/api/bin-module/*` |

## 2. Pairing & Registration (bin's POV)

1. **First boot** — bin generates its own stable `uid` (e.g. MAC-derived) and
   POSTs to `/api/v2/device/pair-request` with that `uid`.
2. **Display the pair code** — server returns `{ pairCode, expiresAt }`. Show
   it on the bin's screen. Re-call this endpoint on a slow loop (~30s) until
   redeemed.
3. **Partner/staff redeems** the code in the LITTR dashboard.
4. **Poll `/api/v2/device/pair-status?uid=<uid>`** until `paired: true`. The
   response carries the bin's permanent `deviceId`, `shopId`, and the cloud
   config block.
5. **Save** the `deviceId` to NVS. From here on, the bin is identified by
   `uid` on all endpoints below.
6. **Bin status is `PENDING_SETUP`** at this point — `/api/v2/device/drop`
   will reject with HTTP 409 `bin_not_configured` until staff completes setup
   in the admin panel. The bin should display "Awaiting staff setup".

### Example

```http
POST /api/v2/device/pair-request
Content-Type: application/json

{ "uid": "ESP32-AA:BB:CC:DD:EE:FF", "firmwareVersion": "v3.0.1" }
```

```json
{
  "ok": true,
  "status": "pending",
  "pairCode": "TPJWFU",
  "expiresAt": "2026-05-18T02:24:13.791Z"
}
```

```http
GET /api/v2/device/pair-status?uid=ESP32-AA:BB:CC:DD:EE:FF
```

```json
{
  "ok": true,
  "paired": true,
  "deviceId": 42,
  "shopId": 7,
  "shopName": "Albany Smoke Shop",
  "config": {
    "sessionWindowSec": 60,
    "acceptedHoldMs": 6000,
    "telemetryPeriodSec": 60,
    "warnTempC": 55,
    "warnVocAnalog": 850,
    "warnVocDigital": -1
  }
}
```

## 3. Config Fetch

### `GET /api/v2/device/config?uid=<uid>`

Bin should call this on boot (after pairing) and on a slow refresh cadence
(every few minutes). The server uses this call to update `lastSeenAt`.

**Response:**
```json
{
  "ok": true,
  "deviceId": 42,
  "shopId": 7,
  "config": {
    "sessionWindowSec": 60,
    "acceptedHoldMs": 6000,
    "telemetryPeriodSec": 60,
    "warnTempC": 55,
    "warnVocAnalog": 850,
    "warnVocDigital": -1
  },
  "rewards_enabled": true,
  "binId": 42,
  "binStatus": "ONLINE",
  "mode": "demo",
  "cameraModel": "none",
  "rejectNonVapes": false,
  "rejectThcVapes": false
}
```

The per-bin `binId`, `binStatus`, `mode`, `cameraModel`, `rejectNonVapes`, and
`rejectThcVapes` fields are returned alongside the shop-level `config` so the
firmware can configure itself on boot. If the device hasn't been claimed to a
bin yet, `binId`/`binStatus` are `null` and `mode`/`cameraModel` default to
`"demo"`/`"none"` respectively. The authoritative `mode` is also echoed in
every `/api/v2/device/drop` response.

## 4. Drop Reporting — **MUST wait for server response before lighting reward**

### `POST /api/v2/device/drop`

This is the most important endpoint. The bin **must** call it on every
physical drop and **must** wait for the response before showing the user any
reward (lighting, beep, QR display). Do not pre-compute or guess points
on-device.

**Request:**
```json
{
  "uid": "ESP32-AA:BB:CC:DD:EE:FF",
  "event_id": "evt_2026051800001"
}
```

| Field      | Type   | Required | Notes |
|------------|--------|----------|-------|
| `uid`      | string | Yes      | Bin's UID from pairing |
| `event_id` | string | No, but strongly recommended | Unique per drop; the server uses it for idempotency. If you retry, send the same `event_id` and you'll get the same response back (with `duplicate: true`). |

**Success response (HTTP 200):**
```json
{
  "ok": true,
  "sessionId": 813,
  "points": 4,
  "qr_url": "https://littr.co/app/claim?token=abc123...",
  "stackCount": 1,
  "mode": "demo",
  "rejected": false
}
```

| Field        | Meaning |
|--------------|---------|
| `points`     | Cumulative session points to display (NOT just this drop) |
| `qr_url`     | Render this as the QR code on the bin's screen |
| `stackCount` | How many drops in the current claim session |
| `mode`       | `"demo"` or `"normal"` — informational; bin can log/show it |
| `rejected`   | If `true`, light the rejection LED; `points` will be 0 |
| `rejectionReason` | `"thc_vape"` or `"not_a_vape"` when `rejected: true`, else `null`. Use it for the local log line. |
| `duplicate`  | (Only on retried `event_id`) — replay the original UI state. `rejected`/`rejectionReason` are recomputed from the stored verdict so retries are consistent. |

**Pending response (HTTP 200) — normal mode, classifier verdict not yet in:**

When the bin is in `normal` mode AND has `rejectThcVapes` or `rejectNonVapes`
enabled, the server gates the reward on the classifier verdict and will
never pay optimistically. If the verdict for `event_id` isn't ready yet
the response is:
```json
{
  "ok": true,
  "pending": true,
  "reason": "awaiting_classifier_verdict",
  "mode": "normal",
  "retryAfterMs": 1000
}
```
The bin must keep the user-facing UI in a "thinking" state and retry the
same `POST /api/v2/device/drop` with the same `event_id` after
`retryAfterMs` milliseconds. No session is created and no points are
awarded until the verdict resolves. The drop event itself (with images)
is uploaded separately via `POST /api/bin-module/drop-capture`, which is
what triggers the classifier in the first place.

**Per-mode behavior:**

| Mode      | Reward source                                              | Range |
|-----------|------------------------------------------------------------|-------|
| `demo`    | Server rolls random 1–10 inclusive. Classifier is skipped. | 1–10  |
| `normal`  | Server uses the shop's `reward_configs.rewardTableJson` (weighted random). | Per config; default 1–10 |

**Error responses:**

| HTTP | `error` value          | When                                                | Firmware action |
|------|------------------------|-----------------------------------------------------|-----------------|
| 400  | `uid required`         | UID missing from body                               | Fix request and retry |
| 400  | `Device not paired or inactive` | Bin's UID is unknown, unpaired, or marked INACTIVE | Re-run pair flow |
| 409  | `bin_not_configured`   | Bin row exists but `status = PENDING_SETUP`         | Display "Awaiting staff setup". Do **not** light any reward. Retry on next drop. |
| 500  | `Drop failed`          | Server-side exception                                | Exponential backoff; safe to retry with same `event_id` (idempotent) |

## 5. Telemetry

### `POST /api/device/telemetry`

Headers: `X-Device-Id: <deviceId>`, `X-Device-Key: <deviceKey>`

Rate-limited to one call per `telemetryPeriodSec` seconds (default 60). The
server returns HTTP 429 with a `waitSeconds` field if you exceed it.

**Request:**
```json
{
  "temperatureC": 24.5,
  "vocAnalog": 320,
  "vocDigital": false,
  "fillPercent": 47
}
```

When the bin is still in `PENDING_SETUP`, telemetry is accepted and stored
but **does not** flip the status to `ONLINE` — the bin stays pending until
staff completes setup.

## 6. Camera / Image Upload (`/api/bin-module/*`)

Camera modules are a **separate** auth domain from the main ESP32. See
sections "Authentication", "Registration", "Heartbeat", and "Drop Captures"
above for the full module-token flow.

Per-`cameraModel` guidance:

| `cameraModel`   | Behavior                                                                 |
|-----------------|--------------------------------------------------------------------------|
| `none`          | No module talks to `/api/bin-module/*`. Classifier runs in pass-through. |
| `s3cam`         | ESP32-S3-CAM module registers, uploads `after`/`crop` images on drop.    |
| `android_cam`   | Android companion app registers as `android_cam`, uploads higher-quality `after`/`crop` images. |

The verdict for any drop image is reachable via
`GET /api/bin-module/drop-verdict?eventId=evt_xxx` (see earlier section).
In `demo` mode the bin should ignore the verdict (the server already paid
out random points and the classifier output is for training only).

## 7. Claim / Reward QR

The `qr_url` returned by `/api/v2/device/drop` is a pre-built URL that
deep-links into the customer mobile app/web flow. The bin's only job is to
render the QR code; the customer scans it and the app calls
`POST /api/v2/claim { token }` to settle the points into a wallet.

## 8. Staff Setup Endpoints (for reference)

These are the endpoints the LITTR dashboard calls — not the bin. They are
documented here so firmware devs understand what flips a bin out of
`PENDING_SETUP`.

| Method | Path                              | Body / Notes |
|--------|-----------------------------------|--------------|
| GET    | `/api/staff/bins/pending-setup`   | Lists every bin in `PENDING_SETUP` with shop + device info. |
| PATCH  | `/api/staff/bins/:id/setup`       | `{ mode: "demo"\|"normal", cameraModel: "none"\|"s3cam"\|"android_cam", name?: string }` — stamps `setupCompletedAt`, flips `status` to `OFFLINE` (telemetry will lift it to `ONLINE`). |

## 9. Error Code Catalogue

| `error` string         | HTTP | Endpoint              | Firmware response                                       |
|------------------------|------|-----------------------|---------------------------------------------------------|
| `uid required`         | 400  | pair / drop / config  | Fix and retry                                            |
| `Device not paired or inactive` | 400 | drop / config | Re-run `/pair-request` → `/pair-status` flow            |
| `bin_not_configured`   | 409  | drop                  | Hold; show "Awaiting staff setup"; do not light reward  |
| `Too fast` (`waitSeconds`) | 429 | telemetry          | Sleep `waitSeconds`; resume                              |
| `Invalid device credentials` | 401 | telemetry        | Wipe and re-pair                                         |
| `Drop failed`          | 500  | drop                  | Backoff + retry with same `event_id`                     |

