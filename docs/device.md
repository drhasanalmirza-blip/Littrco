# LITTR ESP32 Device API v2

This document describes the v2 API endpoints for ESP32-based LITTR recycling bin controllers. V2 focuses on UID-based pairing and session stacking for more robust rewards.

## Authentication

V2 uses hardware UID for identification. No static keys are required for drop events, but pairing is required for shop association.

## Pairing Flow (New Device)

1. **Request Pair Code**: ESP32 sends its hardware UID to get a 6-character code.
2. **Staff/Partner Claim**: The code is entered in the LITTR portal to link the UID to a shop.
3. **Poll Status**: ESP32 polls until the UID is associated with a shop.

### POST /api/v2/device/pair-request
Get a short-lived pairing code for a new device.

**Request:**
```json
{
  "uid": "ESP32-MAC-ADDRESS-OR-UNIQUE-ID"
}
```

**Response:**
```json
{
  "pairCode": "AB1234",
  "expiresAt": "2026-01-01T12:15:00.000Z"
}
```

### GET /api/v2/device/pair-status
Poll to see if the device has been claimed by a shop.

**Query Parameters:**
- `uid`: The hardware UID

**Response (If Paired):**
```json
{
  "paired": true,
  "shopId": 1,
  "shopName": "Elite Smoke Shop",
  "config": { ... }
}
```

## Core Endpoints

### POST /api/v2/device/drop
Report a detected drop. Multiple drops within a "session window" are combined.

**Request:**
```json
{
  "uid": "ESP32-UID",
  "event_id": "unique-id-per-drop-for-idempotency"
}
```

**Response:**
```json
{
  "sessionId": "current-active-session-id",
  "points": 5,
  "qr_url": "https://littr.co/app/claim?token=...",
  "stackCount": 3
}
```

### POST /api/v2/device/telemetry
Report sensor data. Call this every 60 seconds.

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

**Response:**
```json
{
  "status": "ok",
  "fireAlertTriggered": false
}
```

## V1 Endpoints (Legacy)

Legacy support exists at `/api/device/*` using `X-Device-Id` and `X-Device-Key` headers. New implementations should use V2.

### POST /api/device/spin
Triggers a single-reward spin.

**Headers:**
- `X-Device-Id`: <id>
- `X-Device-Key`: <key>

**Response:**
```json
{
  "points": 3,
  "qr_url": "https://littr.co/app/claim?token=abc123..."
}
```

## Fire Alert Triggers
- **Temperature >= 60°C**: HIGH severity alert
- **Temperature >= 80°C**: CRITICAL severity alert
- **VOC digital pin HIGH**: HIGH severity alert

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
