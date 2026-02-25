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
