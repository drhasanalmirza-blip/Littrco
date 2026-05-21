# LITTR Device API

All endpoints live under `/api/device/*`. Every call **except** `POST /api/device/claim` must include `X-Device-Key: <hex>` — the server SHA-256 hashes this and matches it against `devices.deviceKeyHash`.

The device only ever does two things: **push** data and **poll** for commands. There is no websocket, no MQTT, no server→device push.

---

## 1. Pairing handshake

1. Partner clicks **Add Bin** in the dashboard → browser hits `POST /api/partner/bins/pair-init { shopId }`.
2. Server creates a `devices` row in `PROVISIONING` state, generates a 32-byte hex `deviceKey` + a 16-byte `nonce`, returns `{ deviceId, serial, deviceKey, nonce, ttlMs }`.
3. Browser writes `{ deviceKey, nonce, serial }` to the bin's BLE pairing characteristic.
4. Bin stores the key in non-volatile memory, connects to WiFi, then calls:

### `POST /api/device/claim`
No `X-Device-Key` header. Body:
```json
{ "nonce": "<hex>", "serial": "BIN-AB12CD34", "firmwareVersion": "1.0.0" }
```
Response:
```json
{ "deviceId": 12, "serial": "BIN-AB12CD34", "shopId": 3 }
```
Nonce is single-use and expires in 10 minutes. After this the bin is `LIVE`.

---

## 2. Push: telemetry

### `POST /api/device/telemetry`
Body (all optional):
```json
{
  "vapesSinceEmpty": 7,
  "fillPercent": 24,
  "tempC": 23.4,
  "vocRaw": 312,
  "wifiRssi": -65,
  "sdFreeMb": 14820,
  "firmwareVersion": "1.0.1",
  "state": "idle",
  "errorLog": null
}
```
Response: `{ "ok": true }`. Server also updates `lastHeartbeatAt = now()`. Recommended cadence: every 30s when idle, every 5s during an active drop session.

---

## 3. Poll: settings (only fetches when newer)

### `GET /api/device/settings?version=<n>`
- `200 { version, settings }` — server is newer; apply and store version.
- `304` — no change.

Settings shape (free-form jsonb; example):
```json
{
  "irBeamThreshold": 380,
  "dropDebounceMs": 250,
  "fillPercentPerVape": 4,
  "burstPhotoCount": 2,
  "tempWarnC": 60,
  "tempAlertC": 70
}
```
The partner edits this in the dashboard's **Settings** tab; saving bumps `version` so the bin pulls on next poll.

---

## 4. Poll: commands

### `GET /api/device/commands?lastCommandId=<n>`
Returns commands with `id > lastCommandId` and status in `(PENDING, SENT)`:
```json
{ "commands": [
  { "id": 42, "type": "RESET_FILL_AND_COUNT", "payload": null, "status": "PENDING" }
] }
```
Known types: `RESET_FILL_AND_COUNT`, `REBOOT`, `TAKE_PHOTO`, `PING`.

### `POST /api/device/commands/ack`
```json
{ "commandId": 42, "result": "ok" }
```

---

## 5. Drop sessions

The flow groups multiple vapes from one visit into a single QR receipt.

### `POST /api/device/drop-sessions/start`
Response: `{ "sessionId": 91 }`. Call when the first IR beam break occurs.

### `POST /api/device/drops`
```json
{
  "sessionId": 91,
  "sequence": 1,
  "beamPatternJson": { "t0": 0, "t1": 142, "t2": 295 },
  "tempC": 24.1,
  "vocRaw": 320,
  "fillPercent": 28,
  "accepted": true
}
```
Response: `{ "dropId": 217 }`. `accepted=false` records the event but does not contribute to the battery/point payout.

### `POST /api/device/drops/:dropId/photos`
```json
{ "imageRole": "after", "imageBase64": "data:image/jpeg;base64,/9j/..." }
```
Stored under `/uploads/photos/{deviceId}/`. `before` photos are proof only; the `after` photo is also surfaced as the device's `latestPhotoUrl`.

### `POST /api/device/photos` (untied to a drop)
```json
{ "reason": "idle" | "maintenance" | "calibration", "imageBase64": "..." }
```

### `POST /api/device/drop-sessions/:id/finalize`
Call after the countdown ends. Server:
- Computes `batteriesEstimated = acceptedDropCount × batteriesPerVape` (from `reward_configs`, default 5).
- Awards `shopPointsAwarded = acceptedDropCount × shopPointsPerVape` (default 1) to the host shop **immediately** — no customer scan required.
- Generates a `claimToken` and `claimUrl` for the customer QR.

Response:
```json
{
  "ok": true,
  "batteries": 25,
  "shopPoints": 5,
  "claimToken": "9a2c...e1",
  "claimUrl": "https://littr.co/claim/9a2c...e1",
  "expiresAt": "2026-05-28T00:00:00Z"
}
```

If `acceptedDropCount == 0`, the session is marked `EXPIRED` and no token is issued.

---

## 6. Poll loop summary

```
on boot:
  POST /api/device/claim once (if not yet paired) → store deviceKey

loop:
  POST /api/device/telemetry           (every 30s idle, 5s active)
  GET  /api/device/settings?version=v  → 304 or apply
  GET  /api/device/commands?last=l     → execute and ack each
  on IR-beam break:
    POST /api/device/drop-sessions/start (if no open session)
    POST /api/device/drops
    POST /api/device/drops/:id/photos (before, after)
  on inactivity > sessionWindowSec:
    POST /api/device/drop-sessions/:id/finalize → display claimUrl as QR
```
