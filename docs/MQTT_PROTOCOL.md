# LITTR MQTT Protocol Specification

## Overview

This document defines the MQTT message protocol for real-time communication between the LITTR server and smart bin devices. Phase 1 uses a no-op adapter; this protocol will be implemented in Phase 2.

## Broker Configuration

| Setting | Value |
|---------|-------|
| Protocol | MQTT v3.1.1 over TLS |
| Port | 8883 (TLS) |
| Keep-alive | 60 seconds |
| QoS | 1 (at least once) for commands, 0 (at most once) for telemetry |
| Clean Session | false (persistent sessions for bins) |

## Topic Structure

```
bins/{binId}/events    → Bin publishes events to server
bins/{binId}/commands  → Server publishes commands to bin
```

All messages are JSON-encoded UTF-8 strings.

## Event Topics (Bin → Server)

### `bins/{binId}/events`

#### `drop_detected`

Published when the bin's sensors detect a new item deposit.

```json
{
  "type": "drop_detected",
  "event_id": "unique-event-id",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "sensors": {
    "weight_delta_g": 12.5,
    "fill_percent_before": 35,
    "fill_percent_after": 37
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Always `"drop_detected"` |
| `event_id` | string | Unique ID for idempotency (UUID or `{uid}-{counter}`) |
| `timestamp` | string | ISO 8601 timestamp of detection |
| `sensors.weight_delta_g` | number | Weight change in grams (if weight sensor equipped) |
| `sensors.fill_percent_before` | integer | Fill level before drop (0-100) |
| `sensors.fill_percent_after` | integer | Fill level after drop (0-100) |

#### `sensor_reading`

Periodic telemetry data from bin sensors.

```json
{
  "type": "sensor_reading",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "temperature_c": 28.5,
  "voc_analog": 450,
  "voc_digital": false,
  "fill_percent": 37,
  "battery_v": 4.1
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Always `"sensor_reading"` |
| `temperature_c` | number | Temperature in Celsius (DS18B20) |
| `voc_analog` | integer | VOC analog reading 0-4095 (MQ135 A0) |
| `voc_digital` | boolean | VOC digital output (MQ135 D0) |
| `fill_percent` | integer | Fill level 0-100 (ultrasonic) |
| `battery_v` | number | Battery voltage (if battery-powered) |

#### `heartbeat`

Periodic alive signal from the bin.

```json
{
  "type": "heartbeat",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "uptime_sec": 86400,
  "firmware_version": "2.1.0",
  "wifi_rssi": -65,
  "free_heap": 120000
}
```

#### `fire_alert`

Emergency alert when temperature or VOC thresholds are exceeded.

```json
{
  "type": "fire_alert",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "severity": "HIGH",
  "temperature_c": 72.5,
  "temperature_rise_c": 15.0,
  "voc_analog": 1200,
  "voc_digital": true
}
```

| Field | Type | Description |
|-------|------|-------------|
| `severity` | string | `LOW`, `MEDIUM`, `HIGH`, or `CRITICAL` |
| `temperature_rise_c` | number | Temperature increase rate (°C per minute) |

#### `camera_ready`

Published by camera module when it has captured images for a drop.

```json
{
  "type": "camera_ready",
  "event_id": "matching-drop-event-id",
  "timestamp": "2025-01-15T10:30:05.000Z",
  "images": {
    "baseline": true,
    "after": true,
    "crop": false
  }
}
```

## Command Topics (Server → Bin)

### `bins/{binId}/commands`

#### `arm_veriscan`

Instructs the bin to enter VeriScan mode and expect a specific number of deposits.

```json
{
  "type": "arm_veriscan",
  "session_id": 42,
  "expected_count": 3,
  "expires_at": "2025-01-15T10:31:00.000Z",
  "timeout_sec": 60
}
```

| Field | Type | Description |
|-------|------|-------------|
| `session_id` | integer | VeriScan session ID |
| `expected_count` | integer | Number of items to expect |
| `expires_at` | string | ISO 8601 expiration timestamp |
| `timeout_sec` | integer | Timeout in seconds |

**Bin behavior**: Display countdown, accept `expected_count` drops, match each to VeriScan session. After all items received or timeout, publish `veriscan_complete` event.

#### `reward_update`

Informs the bin about a reward status change (e.g., after AI classification or appeal resolution).

```json
{
  "type": "reward_update",
  "drop_id": 123,
  "status": "approved",
  "points": 2,
  "message": "+2 LITTR points"
}
```

#### `config_update`

Pushes updated configuration to the bin.

```json
{
  "type": "config_update",
  "config": {
    "session_window_sec": 90,
    "accepted_hold_ms": 8000,
    "warn_temp_c": 60,
    "warn_voc_analog": 900,
    "warn_use_voc_digital": true
  }
}
```

**Bin behavior**: Apply new configuration immediately. Acknowledge with a `heartbeat` event.

#### `reboot`

Instructs the bin to perform a soft reboot.

```json
{
  "type": "reboot",
  "reason": "firmware_update",
  "delay_sec": 5
}
```

#### `capture_request`

Instructs the camera module to capture images immediately.

```json
{
  "type": "capture_request",
  "drop_id": 123,
  "roles_requested": ["after", "crop"],
  "upload_immediately": true
}
```

## Message Flow Examples

### Standard Drop Flow

```
Bin                          Server
 │                              │
 │ ── drop_detected ──────────► │ Creates drop record
 │                              │ Creates reward session
 │                              │
 │ ◄── reward_update ────────── │ Points: +2
 │                              │
 │    Display QR code           │
 │                              │
```

### VeriScan Flow

```
Customer        Server           Bin
 │                │                │
 │ ─ start ─────► │                │
 │ ─ add items ─► │                │
 │ ─ confirm ───► │                │
 │ ─ arm ───────► │                │
 │                │ ─ arm_veriscan ► │
 │                │                │  Enter VeriScan mode
 │   Deposit items in bin         │
 │                │ ◄ drop_detected │
 │                │  Match to session│
 │                │ ─ reward_update ► │
 │                │                │
```

### Fire Alert Flow

```
Bin                          Server
 │                              │
 │ ── fire_alert ─────────────► │ Creates fire alert record
 │                              │ Notifies partner + staff
 │                              │ Updates bin status to FIRE_ALERT
 │                              │
```

## Connection Management

### Initial Connection

1. Bin connects to broker with client ID `littr-bin-{binId}`
2. Subscribes to `bins/{binId}/commands` with QoS 1
3. Publishes initial `heartbeat` event

### Reconnection

- Use exponential backoff: 1s, 2s, 4s, 8s, 16s, max 60s
- On reconnect, re-subscribe and publish `heartbeat`
- Broker retains last `config_update` command (retained message)

### Last Will and Testament (LWT)

```json
Topic: bins/{binId}/events
Payload: {"type": "offline", "timestamp": "<set-by-broker>"}
QoS: 1
Retain: false
```

## Security

- All connections use TLS (port 8883)
- Authentication via username (binId) + password (device token)
- ACL restricts each bin to its own topic pair
- No cross-bin message access
