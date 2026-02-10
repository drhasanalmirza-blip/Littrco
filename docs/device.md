# LITTR ESP32 Device API v2

This document describes the v2 API endpoints for ESP32-based LITTR recycling bin controllers. V2 uses UID-based identification and session stacking for combined rewards.

## Overview

- **UID-based auth**: Devices identify by hardware UID — no static key exchange needed for drops
- **Session stacking**: Multiple drops within a configurable window combine into one QR code
- **Idempotency**: `event_id` on drops prevents duplicate processing on network retry
- **Partner points**: Shop gets +1 point per accepted drop, tracked in ledger
- **Cloud config**: Session window, sensor thresholds, display settings per shop

---

## Pairing Flow (New Device)

1. ESP32 sends its hardware UID → gets a 6-character pair code (valid 10 minutes)
2. Staff or partner enters that code in the LITTR portal to link the device to a shop
3. ESP32 polls pair-status until `paired=true`, then begins normal operation

### POST /api/v2/device/pair-request

ESP32 calls this with its UID to get a pairing code. If a valid unexpired code already exists for the UID, the same code is returned.

**Request:**
```json
{
  "uid": "ESP32-UNIQUE-ID"
}
```

**Response (new code):**
```json
{
  "ok": true,
  "status": "pending",
  "pairCode": "AB1234",
  "expiresAt": "2026-01-01T12:10:00.000Z"
}
```

**Response (already paired):**
```json
{
  "ok": true,
  "status": "already_paired",
  "deviceId": 1
}
```

### POST /api/v2/device/pair-claim

Staff or partner enters the pair code to claim the device for a shop. Requires authentication.

**Request:**
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
  "deviceId": 1,
  "shopId": 1,
  "shopName": "Elite Smoke Shop"
}
```

### GET /api/v2/device/pair-status?uid=...

ESP32 polls this to check if the device has been claimed.

**Response (paired):**
```json
{
  "ok": true,
  "paired": true,
  "deviceId": 1,
  "shopId": 1,
  "shopName": "Elite Smoke Shop",
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

**Response (not paired):**
```json
{
  "ok": true,
  "paired": false
}
```

---

## Config Defaults

| Parameter | Default | Description |
|-----------|---------|-------------|
| sessionWindowSec | 60 | Seconds before a reward session expires |
| acceptedHoldMs | 6000 | Milliseconds to hold "accepted" state on display |
| telemetryPeriodSec | 60 | Recommended telemetry reporting interval |
| warnTempC | 55 | Temperature threshold for fire alert (°C) |
| warnVocAnalog | 850 | VOC analog threshold for alert (0–4095 ADC) |
| warnVocDigital | -1 | VOC digital alert: -1 = disabled, 1 = enabled |

### GET /api/v2/device/config?uid=...

ESP32 fetches its cloud config (same defaults as above).

**Response:**
```json
{
  "ok": true,
  "deviceId": 1,
  "shopId": 1,
  "config": {
    "sessionWindowSec": 60,
    "acceptedHoldMs": 6000,
    "telemetryPeriodSec": 60,
    "warnTempC": 55,
    "warnVocAnalog": 850,
    "warnVocDigital": -1
  },
  "rewards_enabled": true
}
```

---

## Core Endpoints

### POST /api/v2/device/drop

Report a detected drop. Multiple drops within the session window are stacked into a single reward session.

- Points per drop: random 1–3
- Partner points: +1 per accepted drop (always)
- Idempotent via `event_id` (unique per UID)

**Request:**
```json
{
  "uid": "ESP32-UID",
  "event_id": "unique-id-per-drop"
}
```

**Response:**
```json
{
  "ok": true,
  "sessionId": 42,
  "points": 5,
  "qr_url": "https://littr.co/app/claim?token=abc123...",
  "stackCount": 3
}
```

**Session Stacking Logic:**
1. Find active session for this device where `expiresAt > now`, `claimed=false`, `voided=false`
2. If found → add random 1–3 points, increment `stackCount`, extend `expiresAt` by `sessionWindowSec`
3. If not found → create new session with new `claimToken` and `expiresAt = now + sessionWindowSec`

**Idempotency:**
If the same `event_id` is sent again, the response returns the existing session data with `"duplicate": true`.

### POST /api/v2/device/telemetry

Report sensor data from the bin. Call this every `telemetryPeriodSec` seconds (default 60).

**Request:**
```json
{
  "uid": "ESP32-UID",
  "temperatureC": 28.5,
  "vocAnalog": 450,
  "vocDigital": false,
  "fillPercent": 35
}
```

**Request Fields:**
| Field | Type | Range | Description |
|-------|------|-------|-------------|
| temperatureC | number | -40 to 125 | Temperature in Celsius from DS18B20 |
| vocAnalog | integer | 0 to 4095 | Raw ADC reading from MQ135 A0 pin |
| vocDigital | boolean | true/false | Digital output from MQ135 D0 pin |
| fillPercent | integer | 0 to 100 | Percentage full based on ultrasonic sensor |

**Response:**
```json
{
  "status": "ok",
  "fireAlertTriggered": false
}
```

**Fire Alert Triggers:**
- `temperatureC >= warnTempC` (default 55°C)
- `vocAnalog >= warnVocAnalog` (default 850)
- `vocDigital == true` (only if `warnVocDigital` is enabled)

---

## Claim Endpoint

### POST /api/v2/claim

User scans the QR code to claim their stacked session points.

**Request:**
```json
{
  "token": "abc123...",
  "email": "user@example.com",
  "password": "pass123"
}
```

- If the user is already logged in (session header), `email`/`password` are not needed
- If not logged in and account doesn't exist, one is auto-created

**Response (success):**
```json
{
  "ok": true,
  "pointsClaimed": 5,
  "dropCount": 3,
  "newBalance": 25
}
```

**Response (expired):**
```json
{
  "ok": false,
  "error": "Session expired"
}
```

**Response (already claimed):**
```json
{
  "ok": false,
  "error": "Already claimed"
}
```

**Expiry Logic:**
- If session is expired and unclaimed → it is voided and rejected
- A background job runs every 30 seconds to automatically void expired unclaimed sessions

---

## Shop Config Management

### GET /api/v2/shop/:shopId/device-config

Get current device config for a shop (staff or partner auth required).

### PATCH /api/v2/shop/:shopId/device-config

Update device config for a shop (staff or partner auth required).

**Request:**
```json
{
  "session_window_sec": 90,
  "accepted_hold_ms": 8000,
  "warn_temp_c": 60,
  "warn_voc_analog": 900,
  "warn_use_voc_digital": true
}
```

### GET /api/v2/shop/:shopId/points-ledger

Get partner points ledger for a shop (staff or partner auth required).

---

## Testing with curl

```bash
# 1. Pair request
curl -X POST https://littr.co/api/v2/device/pair-request \
  -H "Content-Type: application/json" \
  -d '{"uid": "ESP32-TEST-001"}'

# 2. Check pair status
curl "https://littr.co/api/v2/device/pair-status?uid=ESP32-TEST-001"

# 3. Report a drop
curl -X POST https://littr.co/api/v2/device/drop \
  -H "Content-Type: application/json" \
  -d '{"uid": "ESP32-TEST-001", "event_id": "drop-001"}'

# 4. Send telemetry
curl -X POST https://littr.co/api/v2/device/telemetry \
  -H "Content-Type: application/json" \
  -d '{"uid": "ESP32-TEST-001", "temperatureC": 28.5, "vocAnalog": 450, "vocDigital": false, "fillPercent": 35}'

# 5. Claim points
curl -X POST https://littr.co/api/v2/claim \
  -H "Content-Type: application/json" \
  -d '{"token": "YOUR_SESSION_TOKEN", "email": "test@example.com", "password": "test123"}'

# 6. Get config
curl "https://littr.co/api/v2/device/config?uid=ESP32-TEST-001"
```

---

## Wiring Diagram

```
ESP32 Pin Connections:
----------------------
GPIO4  -> DS18B20 Data (with 4.7kΩ pull-up to 3.3V)
GPIO34 -> MQ135 A0 (analog out)
GPIO35 -> MQ135 D0 (digital out)
GPIO12 -> Ultrasonic TRIG
GPIO14 -> Ultrasonic ECHO
3.3V   -> DS18B20 VCC, MQ135 VCC
GND    -> DS18B20 GND, MQ135 GND
```

---

## Legacy V1 Endpoints

Legacy support exists at `/api/device/*` using `X-Device-Id` and `X-Device-Key` headers. New implementations should use V2.

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/device/spin | POST | Single reward spin |
| /api/device/telemetry | POST | Report sensor data |
| /api/device/telemetry/history | GET | Historical readings |
| /api/device/status | GET | Device status |

**Legacy Headers:**
```
X-Device-Id: <id>
X-Device-Key: <key>
```
