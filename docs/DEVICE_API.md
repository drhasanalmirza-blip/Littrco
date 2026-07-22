# LITTR Device API

All endpoints live under `/api/device/*`. Every call **except** the two pairing
exchanges — `POST /api/device/claim` (BLE nonce) and `POST /api/device/claim-by-code`
(SoftAP pair code) — must include `X-Device-Key: <hex>` — the server SHA-256 hashes
this and matches it against `devices.deviceKeyHash`. A `RETIRED` device is rejected `403`.

The device only ever does two things: **push** data and **poll** for commands. There is no websocket, no MQTT, no server→device push.

### Rate limits (spec §2.7)

Per-device sliding windows, enforced in-memory (`server/ratelimit.ts`):
- **120 req/min per device** across all general `/api/device/*` routes (one shared
  bucket — telemetry, events, settings, commands, drops, finalize, firmware).
- **30 req/min per device** for the two photo-upload routes.
- **10 req/min per IP** on `POST /api/device/claim-by-code` (guessable-code exchange).

On breach: `429` with a `Retry-After` header (seconds).

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

### QR / SoftAP pairing (alternative to BLE — spec §2.3)

For phones/browsers without Web Bluetooth, the partner (or staff) instead requests a
**pair code** and types it into the bin's SoftAP captive portal (branded
`http://littr.bin`):

1. Partner: `POST /api/partner/shops/:id/pair-code` (OWNER/MANAGER) — or staff:
   `POST /api/staff/shops/:id/pair-code` — creates a `PROVISIONING` device + a
   single-use 6-char code (alphabet excludes `0/O/1/I`), 10-minute TTL. Returns
   `{ deviceId, serial, code, expiresAt }`.
2. The user reads the code in the app and enters it in the bin's SoftAP portal.
3. The bin calls (no `X-Device-Key` yet; TLS only):

#### `POST /api/device/claim-by-code`
Body:
```json
{ "code": "K7M2QP", "uid": "S3-AABBCC001122", "firmwareVersion": "1.2.0" }
```
- `code` — the 6-char pair code (case-insensitive; server upper-cases it).
- `uid` — the board's MAC-derived id (4–64 chars); only stored as `serial` if the
  device row has no serial yet (the generated serial stays canonical).

Response:
```json
{ "deviceId": 12, "serial": "BIN-AB12CD34", "deviceKey": "<hex>", "shopId": 3 }
```
The server mints a **fresh** device key here and returns it exactly once — the bin
stores it in NVS and uses `X-Device-Key` from then on. The device is now `LIVE`.
Errors: `400` invalid/expired code, `404` device not found, `429` (10/min/IP).

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
  "rawDistanceMm": 412,
  "firmwareVersion": "1.0.1",
  "state": "idle",
  "errorLog": null
}
```
Response: `{ "ok": true }`. Server also updates `lastHeartbeatAt = now()`. Recommended cadence: every 30s when idle, every 5s during an active drop session.

New fields (spec §2.1):
- **`rawDistanceMm`** — the latest raw ultrasonic distance, persisted to
  `devices.lastDistanceMm` and surfaced to the partner calibration slider
  (`GET /api/partner/devices/:id/live-fill`). During a calibration window (after a
  `CALIBRATE_FILL` command) the bin should stream 1 s telemetry carrying this field.
- **`state`** — accepted for forward-compat but not persisted.

After persisting, the server runs the **alert engine**: fill-threshold crossings and
`FULL` fire notifications (with hysteresis), and a heartbeat auto-clears any `OFFLINE`
alert. See `docs/API_DESIGN.md` §5.

### `POST /api/device/events` (device-initiated alerts — spec §2.2)

Fire and environmental warnings are detected **on the bin** (the sensor board owns fire
logic). The device reports them here; the server records an alert and notifies staff +
shop members.
```json
{ "type": "FIRE", "tempC": 71.2, "vocAnalog": 3400, "fillPercent": 60, "message": "flame detected" }
```
- `type` — one of `FIRE | TEMP_HIGH | VOC_HIGH | SD_ERROR | CAMERA_ERROR`.
- `tempC`, `vocAnalog`, `fillPercent`, `message` — all optional context.

Response: `202 { "alertId": 88 }` (or `{ "alertId": null }` if the event was ignored).
An unresolved alert of the **same type on the same device within 10 minutes** is
refreshed (its `dataJson` updated) rather than duplicated — so it is safe to re-post a
sustained condition. `FIRE` is `CRITICAL`; `TEMP_HIGH`/`VOC_HIGH` are `WARNING`;
`SD_ERROR`/`CAMERA_ERROR` are `INFO`. A `FIRE` event may also trigger server-side fire
actions from device settings (see §7 of `docs/API_DESIGN.md`): `BIN_ALARM` enqueues a
`SOUND_ALARM {seconds:60}` command back to the bin.

---

## 3. Poll: settings (only fetches when newer)

### `GET /api/device/settings?version=<n>`
- `200 { version, settings }` — server is newer; apply and store version.
- `304` — no change.

The partner edits settings in the dashboard's **Settings** tab; saving bumps `version`
so the bin pulls on the next poll. As of Phase 1 the partner PUT is validated against a
**structured schema** (`shared/deviceSettings.ts`), and partial edits deep-merge onto
the stored JSON (unknown keys preserved for forward-compat). Structured shape (all keys
optional):
```jsonc
{
  "fill":      { "emptyDistanceMm": 500, "fullOffsetMm": 76 },   // calibration
  "policy":    { "allowThcVapes": false },
  "fire":      { "enabled": true, "mode": 2, "tempC": 40, "vocAnalog": 3000,
                 "vocWarmupSec": 300,
                 "onBoth": ["NOTIFY","BIN_ALARM"], "onTempOnly": ["NOTIFY"],
                 "onVocOnly": ["NOTIFY"] },                       // mode: 0 temp,1 voc,2 either,3 both
  "hours":     { "enabled": false, "open": "09:00", "close": "21:00",
                 "tz": "America/New_York" },
  "ui":        { "theme": "default" },
  "session":   { "stackWindowSec": 6, "qrTtlSec": 30 },
  "telemetry": { "idleSec": 30, "activeSec": 5 },
  "camera":    { "idleSnapshotSec": 8 }
}
```
The `fill.emptyDistanceMm` (0%) and `fill.fullOffsetMm` (100%, distance from lid) values
are what the partner calibration slider writes after a `CALIBRATE_FILL` run. Full field
reference: `docs/API_DESIGN.md` §7.

---

## 4. Poll: commands

### `GET /api/device/commands?lastCommandId=<n>`
Returns commands with `id > lastCommandId` and status in `(PENDING, SENT)`:
```json
{ "commands": [
  { "id": 42, "type": "RESET_FILL_AND_COUNT", "payload": null, "status": "PENDING" }
] }
```
Command types and payloads:

| Type | Payload | Meaning |
|------|---------|---------|
| `RESET_FILL_AND_COUNT` | — | zero fill % and vapes-since-empty (partner/staff mark-empty) |
| `REBOOT` | — | restart the bin |
| `PING` | — | liveness check |
| `TAKE_PHOTO` | `{ ir: boolean }` | capture a snapshot (staff live camera); `ir` toggles IR illumination |
| `CALIBRATE_FILL` | `{ seconds: 60 }` | stream 1 s telemetry with `rawDistanceMm` for the window |
| `SOUND_ALARM` | `{ seconds }` | sound the local alarm (e.g. from a FIRE `BIN_ALARM` action) |
| `UPDATE_FIRMWARE` | `{ version }` | pull the pinned OTA target (see §7) |

The bin should upload the resulting photo for `TAKE_PHOTO` via `POST /api/device/photos`
with `reason: "live"`.

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
Stored under `/uploads/photos/{deviceId}/`. `before` photos are proof only; the `after` photo is also surfaced as the device's `latestPhotoUrl`. The photo is also linked onto the drop (`beforePhotoId`/`afterPhotoId`) so the staff review queue and training export resolve its URL.

### `POST /api/device/photos` (untied to a drop)
```json
{ "reason": "idle" | "maintenance" | "calibration" | "live", "imageBase64": "...", "sessionId": 91 }
```
`sessionId` is optional. `reason: "live"` answers a staff `TAKE_PHOTO` snapshot command
(the staff live-camera page polls `GET /api/staff/devices/:id/photos?reason=live`).

### Photo hardening (both upload routes — spec §2.5)
Rate-limited to **30 uploads/min per device**. The decoded image must:
- be **≤ 4 MB** decoded, and
- begin with the JPEG magic bytes `FF D8 FF`.

Otherwise the request is rejected `400` (`"Not a JPEG"`, `"Image too large (max 4MB)"`,
or `"Invalid image"`). Base64 may be a bare string or a `data:image/jpeg;base64,…` URL.

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

## 6. OTA firmware check (spec §2.4)

### `GET /api/device/firmware?board=<sensor|hmi>&channel=<stable|beta>&version=<current>`
- `board` is required; `channel` defaults to `stable`; `version` is the currently
  installed version.
- A staff-pinned `devices.targetFirmwareVersion` wins over the newest release; otherwise
  the newest `active` release for `(board, channel)` is returned.
- `204 No Content` — already on the target/newest, or nothing applicable.
- `200 { version, url, sha256, sizeBytes }` — an update is available; download `url`,
  verify the `sha256`, then flash. A pinned update is also pushed proactively as an
  `UPDATE_FIRMWARE {version}` command.

---

## 7. Poll loop summary

```
on boot:
  if not yet paired:
    POST /api/device/claim once (BLE nonce)            → store deviceKey
    -- or --
    POST /api/device/claim-by-code once (SoftAP code)  → store deviceKey

loop:
  POST /api/device/telemetry               (every 30s idle, 5s active; rawDistanceMm)
  GET  /api/device/settings?version=v      → 304 or apply
  GET  /api/device/commands?last=l         → execute and ack each
    TAKE_PHOTO    → POST /api/device/photos (reason:"live")
    CALIBRATE_FILL→ stream 1s telemetry with rawDistanceMm for the window
    SOUND_ALARM   → sound local alarm
    UPDATE_FIRMWARE / periodically:
      GET /api/device/firmware?board=&channel=&version= → 204 or flash
  on IR-beam break:
    POST /api/device/drop-sessions/start   (if no open session)
    POST /api/device/drops
    POST /api/device/drops/:id/photos       (before, after; ≤4MB JPEG)
  on fire / temp / voc / SD / camera fault:
    POST /api/device/events                 (server records + notifies)
  on inactivity > sessionWindowSec:
    POST /api/device/drop-sessions/:id/finalize → display claimUrl as QR
```
