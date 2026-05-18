# LITTR Bin & Module API — v3 (latest)

This is the canonical, end-to-end reference for everything a LITTR smart bin
(ESP32 main controller + optional camera module) talks to. **It supersedes
all earlier pairing / setup docs.** Where v2 had a two-step
`pair-claim → staff setup` flow with a `PENDING_SETUP` intermediate state,
**v3 collapses pairing and configuration into a single staff-driven `assign`
action** so a bin is fully configured the moment it is paired.

---

## 1. State Machine

```
                  +------------------------+
   (boot, no UID  |                        |
    pair record)  |   pair_request         |
        ----->    |   /api/v2/device/      |
                  |   pair-request         |
                  +-----------+------------+
                              | staff opens Bins page and clicks "Assign":
                              | POST /api/v2/staff/pair-requests/:id/assign
                              | { shopId, name, mode, cameraModel }
                              v
                  +------------------------+   first telemetry      +-----------+
                  |   OFFLINE (configured) |  -------------------> |  ONLINE   |
                  +-----------+------------+                       +-----+-----+
                              ^                                          |
                              | (no telemetry for >N min)                |
                              +------------------------------------------+

  Any configured state above can transition to FIRE_ALERT when
  /api/device/telemetry detects a fire condition.
```

Bins carry two orthogonal properties set at assignment time:

| Field         | Values                            | Meaning |
|---------------|-----------------------------------|---------|
| `mode`        | `demo`, `normal`                  | How `/api/v2/device/drop` computes reward points |
| `cameraModel` | `none`, `s3cam`, `android_cam`    | Which (if any) camera module talks to `/api/bin-module/*` |

> **Legacy note.** A small number of bins from before v3 may still be in
> `PENDING_SETUP`. They are surfaced in the Bins page under a "Legacy Setup"
> sub-tab and can be finished with the old `PATCH /api/staff/bins/:id/setup`
> endpoint. No new path produces `PENDING_SETUP` bins.

---

## 2. Pairing & Assignment (bin's POV)

1. **First boot** — bin generates its own stable `uid` (e.g. MAC-derived) and
   POSTs to `/api/v2/device/pair-request`.
2. **Display the pair code** — server returns `{ pairCode, expiresAt }`. Show
   it on the bin's screen. Re-call the endpoint on a slow loop (~30s) until
   redeemed; you'll get the same `pairCode` back while one is active.
3. **Staff opens the Bins page** in the LITTR dashboard, sees the pending
   request, clicks **Assign** and fills in: shop, bin name, `mode`,
   `cameraModel`. One submit creates/updates the device row, creates the
   bin row directly in `OFFLINE`, and claims the pair request.
4. **Poll `/api/v2/device/pair-status?uid=<uid>`** until `paired: true`. The
   response carries the bin's permanent `deviceId`, `shopId`, `shopName`,
   and the shop-level `config` block. The authoritative `mode` and
   `cameraModel` selected by staff are returned by
   `/api/v2/device/config?uid=<uid>` (see §3) once the bin polls for its
   full config.
5. **Save** the `deviceId` to NVS. From here on the bin is identified by
   `uid` on all endpoints below.
6. **Immediately ready.** Because v3 stamps the bin straight to `OFFLINE`
   with full config, `/api/v2/device/drop` works on the very next physical
   drop — there is no "awaiting staff setup" gate any more.

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

---

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

The per-bin `binId`, `binStatus`, `mode`, `cameraModel`, `rejectNonVapes`,
and `rejectThcVapes` fields are returned alongside the shop-level `config`
so the firmware can configure itself on boot. The authoritative `mode` is
also echoed in every `/api/v2/device/drop` response.

---

## 4. Drop Reporting — **MUST wait for server response before lighting reward**

### `POST /api/v2/device/drop`

This is the most important endpoint. The bin **must** call it on every
physical drop and **must** wait for the response before showing the user
any reward (lighting, beep, QR display). Do not pre-compute or guess
points on-device.

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
| `event_id` | string | No, but strongly recommended | Unique per drop; the server uses it for idempotency. Retries with the same `event_id` return the same response (with `duplicate: true`). |

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
| `mode`       | `"demo"` or `"normal"` — informational |
| `rejected`   | If `true`, light the rejection LED; `points` will be 0 |
| `rejectionReason` | `"thc_vape"` or `"not_a_vape"` when `rejected: true`, else `null` |
| `duplicate`  | (Only on retried `event_id`) — replay the original UI state |

**Rejection response (HTTP 200) — bin owner's filter matched the verdict:**

When the bin is in `normal` mode AND the classifier has determined that the
dropped item matches a reject toggle set by the bin owner
(`rejectThcVapes` or `rejectNonVapes`), the server returns a rejection
immediately. **No reward session is created and no points are credited.**

```json
{
  "ok": true,
  "sessionId": null,
  "points": 0,
  "qr_url": null,
  "stackCount": 0,
  "mode": "normal",
  "rejected": true,
  "rejectionReason": "thc_vape"
}
```

When `rejected: true`:
- Light the **rejection LED** immediately.
- Do **not** display a QR code (`qr_url` is `null`).
- Do **not** show any points (`points` is `0`).
- Retrying with the same `event_id` is fully idempotent — the server stores
  a zero-point drop event record as an idempotency marker so all retries
  return `duplicate: true` with the same rejection payload.

**Pending response (HTTP 200) — normal mode, classifier verdict not yet in:**

When the bin is in `normal` mode AND has `rejectThcVapes` or
`rejectNonVapes` enabled, the server gates the reward on the classifier
verdict and will never pay optimistically. If the verdict for `event_id`
isn't ready yet the response is:

```json
{
  "ok": true,
  "pending": true,
  "reason": "awaiting_classifier_verdict",
  "mode": "normal",
  "retryAfterMs": 1000
}
```

Keep the user-facing UI in a "thinking" state and retry the same
`POST /api/v2/device/drop` with the same `event_id` after `retryAfterMs`
milliseconds. The drop event itself (with images) is uploaded separately
via `POST /api/bin-module/drop-capture`, which is what triggers the
classifier.

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
| 409  | `bin_not_configured`   | *Legacy only.* Bin row is still in `PENDING_SETUP` (pre-v3) | Display "Awaiting staff setup"; do not light any reward; retry on next drop |
| 500  | `Drop failed`          | Server-side exception                                | Exponential backoff; safe to retry with same `event_id` |

> **v3 will not produce new `PENDING_SETUP` bins.** Pairing and
> configuration are now a single staff action, so 409 only appears for the
> small number of bins paired before v3 that have not been finished via
> the legacy `PATCH /api/staff/bins/:id/setup` endpoint.

---

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

First telemetry from an `OFFLINE` bin flips its status to `ONLINE`.

---

## 6. Camera / Image Upload (`/api/bin-module/*`)

Camera modules are a **separate** auth domain from the main ESP32. The
module registers itself, fetches its capture cadence, posts heartbeats, and
uploads drop-capture images. Per `cameraModel`:

| `cameraModel`   | Behavior                                                                 |
|-----------------|--------------------------------------------------------------------------|
| `none`          | No module talks to `/api/bin-module/*`. Classifier runs in pass-through. |
| `s3cam`         | ESP32-S3-CAM module registers, uploads `after`/`crop` images on drop.    |
| `android_cam`   | Android companion app registers as `android_cam`, uploads higher-quality `after`/`crop` images. |

### `POST /api/bin-module/register`

Body: `{ binId, moduleType: "s3cam" | "android_cam", firmwareVersion }`
Response: `{ ok: true, moduleToken }` — store this in NVS and send it on
every subsequent module request as the `X-Module-Token` header.

### `GET /api/bin-module/config`

Header: `X-Module-Token`
Returns idle / burst / cooldown cadence + upload policy + debug flags.

### `POST /api/bin-module/heartbeat`

Header: `X-Module-Token`
Body: `{ freeBytes, totalFrames, oldestFrame }`

### `POST /api/bin-module/drop-capture`

Header: `X-Module-Token`
Body (multipart or JSON+base64): `{ eventId, imageRole: "baseline"|"after"|"crop", image, hash }`
Server stores the image, links it to the drop, and (for `after`/`crop`)
enqueues the classifier.

### `POST /api/bin-module/baseline`

Header: `X-Module-Token`
Body: `{ image, hash }`
Periodic baseline frame for diff computation. Only uploaded when the
configured `uploadPolicy` allows.

### `GET /api/bin-module/drop-verdict?eventId=evt_xxx`

Returns the classifier verdict for a drop. In `demo` mode the bin should
ignore this; the server already paid out random points and the classifier
output is for training only.

---

## 7. Claim / Reward QR

The `qr_url` returned by `/api/v2/device/drop` is a pre-built URL that
deep-links into the customer mobile app/web flow. The bin's only job is to
render the QR code; the customer scans it and the app calls
`POST /api/v2/claim { token }` to settle the points into a wallet.

---

## 8. Staff Endpoints (for reference)

These are the endpoints the LITTR dashboard calls — not the bin. They are
listed here so firmware devs can reproduce the assignment flow during
bring-up.

| Method | Path                                              | Body / Notes |
|--------|---------------------------------------------------|--------------|
| GET    | `/api/v2/staff/pair-requests`                     | Lists every pair request (pending, claimed, expired). |
| POST   | `/api/v2/staff/pair-requests/:id/assign`          | **Canonical assign action.** Body: `{ shopId, name, mode: "demo"\|"normal", cameraModel: "none"\|"s3cam"\|"android_cam" }`. Atomically claims the pair request, creates/updates the device, and creates the bin row in `OFFLINE` with the supplied config. |
| GET    | `/api/staff/bins/pending-setup`                   | *Legacy.* Lists bins still in `PENDING_SETUP` (only pre-v3 rows). |
| PATCH  | `/api/staff/bins/:id/setup`                       | *Legacy.* Finishes setup on a `PENDING_SETUP` row. Body: `{ name?, mode?, cameraModel? }`. New paths never produce rows that need this. |

---

## 9. Error Code Catalogue

| `error` string         | HTTP | Endpoint                              | Firmware response                                       |
|------------------------|------|---------------------------------------|---------------------------------------------------------|
| `uid required`         | 400  | pair / drop / config                  | Fix and retry                                            |
| `Device not paired or inactive` | 400 | drop / config                | Re-run `/pair-request` → `/pair-status` flow            |
| `Pair request expired` | 400  | staff assign                          | Bin should request a fresh code via `/pair-request`     |
| `Pair request already claimed` | 400 | staff assign                   | Staff: refresh the page; bin is already live           |
| `Too fast` (`waitSeconds`) | 429 | telemetry                           | Sleep `waitSeconds`; resume                              |
| `Drop failed`          | 500  | drop                                  | Exponential backoff; safe to retry with same `event_id` |
