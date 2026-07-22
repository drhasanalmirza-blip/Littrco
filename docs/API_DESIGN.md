# LITTR Cloud API — Phase 1 Design Spec

_This document specifies the Phase 1 server work (see repo-root `ROADMAP.md`). It is the
source of truth for the schema deltas, endpoints, and semantics being added to the
existing Express/Drizzle backend. Existing behavior documented in `docs/DEVICE_API.md`
and `docs/REWARD_ECONOMY.md` stays unchanged unless stated here._

Conventions: all new endpoints are JSON over the existing middleware
(`authMiddleware`, `requireRole`, `deviceAuthMiddleware` from `server/auth.ts`), zod
validation on every body/query, and the existing error shape `{ error: string }` with
appropriate status codes. Partner endpoints must enforce shop membership the same way
existing `/api/partner/*` routes do (`isPartnerOfShop`, STAFF bypass).

---

## 1. Schema deltas (`shared/schema.ts`)

### 1.1 Enum changes

- `shop_member_role`: add `VIEWER` (read-only partner team member).
- `photo_reason`: add `live` (staff live-view snapshots).
- New enum `drop_review_status`: `UNREVIEWED | APPROVED | REJECTED`.
- New enum `alert_severity`: `INFO | WARNING | CRITICAL`.

### 1.2 Column additions

`devices`:
- `pointsPerVapeOverride` integer, nullable — per-bin shop-points modifier; when set,
  finalize uses it instead of `reward_configs.shopPointsPerVape`.
- `lastDistanceMm` integer, nullable — latest raw ultrasonic distance (calibration).
- `targetFirmwareVersion` text, nullable — staff-pinned OTA target.
- `offlineNotifiedAt` timestamp, nullable — offline-alert dedupe latch.
- `alertStateJson` jsonb, nullable — threshold hysteresis state (see §5.4).

`drops`:
- `reviewStatus` `drop_review_status`, not null, default `UNREVIEWED`.
- `reviewedByUserId` uuid → users, nullable.
- `reviewedAt` timestamp, nullable.
- `reviewNote` text, nullable.
- `pointsRevoked` boolean, not null, default false — set once compensation ledger rows
  are written (idempotency latch).

### 1.3 New tables

`alerts`:
- id serial PK, `deviceId` → devices (cascade), `shopId` → shops (set null, nullable),
  `type` text (see §5.2 for the closed set), `severity` alert_severity,
  `message` text, `dataJson` jsonb nullable, `createdAt` timestamp default now,
  `resolvedAt` timestamp nullable, `notifiedJson` jsonb nullable (delivery receipts).
- Index on (`deviceId`, `createdAt`).

`notification_prefs`:
- id serial PK, `userId` → users (cascade), `shopId` → shops (cascade, **nullable** —
  null = global scope, used by STAFF), `channelsJson` jsonb (default
  `{"email":true,"sms":false,"call":false,"push":false}`), `eventsJson` jsonb (default
  see §5.3), `phone` text nullable (for future SMS/call), `updatedAt` timestamp.
- Unique on (`userId`, `shopId`) — one prefs row per user per scope. (Postgres treats
  NULLs as distinct in unique indexes; enforce the null-scope uniqueness with a partial
  unique index on `userId` where `shopId is null`, or normalize with a sentinel — pick
  one and document it in the schema comment.)

`partner_invites`:
- id serial PK, `shopId` → shops (cascade), `email` text, `role` shop_member_role,
  `token` text unique, `invitedByUserId` → users, `createdAt`, `expiresAt`,
  `acceptedAt` nullable, `acceptedByUserId` → users nullable.

`self_reports`:
- id serial PK, `sessionId` → drop_sessions (cascade), `customerId` → customers
  (cascade), `brand` text nullable, `model` text nullable, `puffCount` integer nullable,
  `isThc` boolean nullable, `notes` text nullable, `createdAt`.
- Unique on (`sessionId`) — one self-report per session.

`firmware_releases`:
- id serial PK, `board` text (`sensor` | `hmi`), `version` text, `channel` text
  (`stable` | `beta`, default `stable`), `url` text, `sha256` text, `sizeBytes` integer
  nullable, `notes` text nullable, `active` boolean default true, `createdAt`.
- Unique on (`board`, `version`, `channel`).

`pairing_codes` (QR/SoftAP pairing — replaces nothing; BLE `pairing_nonces` stays for
back-compat but the new flow is this):
- id serial PK, `code` text unique (6 uppercase alphanumeric, no 0/O/1/I),
  `deviceId` → devices (cascade), `createdByUserId` → users, `expiresAt` (10 min),
  `consumedAt` nullable, `createdAt`.

---

## 2. Device API additions (`X-Device-Key` unless noted)

### 2.1 `POST /api/device/telemetry` — extended (existing route)

Accept additional optional fields, persisted onto `devices`:
`rawDistanceMm` (→ `lastDistanceMm`), `state` (existing), plus everything already
supported. After persisting, run the **alert engine** (§5) with prev/next device state.

### 2.2 `POST /api/device/events` — NEW

Device-initiated alerts (fire and warnings are detected on-device).
Body: `{ type: "FIRE" | "TEMP_HIGH" | "VOC_HIGH" | "SD_ERROR" | "CAMERA_ERROR",
tempC?, vocAnalog?, fillPercent?, message? }`.
Creates an `alerts` row (FIRE ⇒ CRITICAL, others WARNING) and dispatches notifications
per §5. Responds `{ alertId }`. Rate-limit generously but do dedupe: an unresolved alert
of the same type on the same device within 10 minutes is refreshed (update `dataJson`),
not duplicated.

### 2.3 `POST /api/device/claim-by-code` — NEW (no device key; TLS only)

The SoftAP pairing exchange. Body: `{ code, uid, firmwareVersion? }` where `uid` is the
board's MAC-derived id (e.g. `S3-AABBCC001122`).
Flow: look up unexpired unconsumed `pairing_codes.code` → consume atomically (same
pattern as `consumePairingNonce`) → generate a fresh device key, store its hash on the
device row, set status LIVE, store `uid` in `devices.serial` if the device row has no
serial yet (serial stays the canonical id) → respond
`{ deviceId, serial, deviceKey, shopId }`.
(The user enters the code in the bin's SoftAP captive portal, branded **`http://littr.bin`**
— the AP's wildcard DNS resolves it to the bin; firmware Phase 3 detail, noted here for
the end-to-end picture.) The device stores `deviceKey` in NVS and uses
it for everything thereafter. Rate-limit hard (10/min/IP) — this is a guessable-code
exchange; codes are single-use with a 10-minute TTL, ~1.07B code space at 6 chars of a
32-char alphabet.

### 2.4 `GET /api/device/firmware?board=sensor&channel=stable&version=1.2.3` — NEW

OTA check. If the device row has `targetFirmwareVersion`, that release wins; otherwise
the newest `active` release for (board, channel). Responds `204` when `version` already
matches the target, else `{ version, url, sha256, sizeBytes }`.

### 2.5 Photo upload hardening (existing routes)

`POST /api/device/drops/:dropId/photos` and `POST /api/device/photos`:
- Enforce max decoded size 4 MB; verify JPEG magic bytes (`FF D8 FF`); reject otherwise
  with 400.
- `POST /api/device/photos` accepts `reason: "live"` (new enum value) — used to answer
  staff snapshot commands.

### 2.6 Commands (existing route — semantics only)

New command types the server may enqueue (documented for firmware; no server code change
beyond what §3/§4 enqueue): `TAKE_PHOTO {ir: boolean}`, `CALIBRATE_FILL {seconds: 60}`,
`SOUND_ALARM {seconds}`, `UPDATE_FIRMWARE {version}`, plus existing
`RESET_FILL_AND_COUNT`, `REBOOT`, `PING`.

### 2.7 Rate limits (all device routes)

Per-device sliding window: 120 req/min general, 30 req/min for photo uploads. 429 with
`Retry-After`. Implement as a small in-memory middleware (`server/ratelimit.ts`) — no
new dependency; note in code that multi-instance deployments need a store swap.

---

## 3. Staff API additions (`requireRole("STAFF")`)

### 3.1 Drop review

- `GET /api/staff/review/queue?status=UNREVIEWED&shopId=&deviceId=&limit=50&offset=0`
  → drops joined with session, device, shop, and before/after photo URLs, newest first.
  `status` filter optional (any `drop_review_status` or `all`).
- `GET /api/staff/review/drops/:dropId` → full detail (drop, session incl. claim state,
  photos, device, shop, self-report if any).
- `POST /api/staff/review/drops/:dropId/approve` → sets APPROVED (idempotent).
- `POST /api/staff/review/drops/:dropId/reject` body `{ reason }` → **revocation
  semantics, §6**. Idempotent: a second reject is a no-op 200.
- `GET /api/staff/sessions?status=&claimed=&shopId=&from=&to=&limit=&offset=` → all drop
  sessions including unclaimed/expired, with drop counts and claim state.
- `GET /api/staff/export/training?from=&to=&status=` → JSONL download
  (`Content-Type: application/x-ndjson`): one line per drop —
  `{ dropId, deviceId, shopId, sessionId, beforeUrl, afterUrl, reviewStatus,
  reviewNote, accepted, beamPatternJson, takenAt, selfReport? }`. This is the AI
  training corpus.

### 3.2 Live camera

- `POST /api/staff/devices/:id/snapshot` body `{ ir: boolean }` → enqueues
  `TAKE_PHOTO {ir}`; responds `{ commandId }`.
- `GET /api/staff/devices/:id/photos?reason=live&limit=10&afterId=` → newest photos
  (any reason filter). The live page: enqueue snapshot → poll this with `afterId` until
  the new photo appears; repeat for "live" viewing. IR toggle = the `ir` flag.

### 3.3 Alerts & notification prefs

- `GET /api/staff/alerts?deviceId=&active=true&limit=` → alert history
  (`active=true` ⇒ `resolvedAt is null`).
- `POST /api/staff/alerts/:id/resolve` → stamps `resolvedAt`.
- `GET /api/staff/notifications` / `PUT /api/staff/notifications` → the caller's own
  global-scope `notification_prefs` row (shopId null). PUT body
  `{ channelsJson?, eventsJson?, phone? }`, zod-validated per §5.3.

### 3.4 Devices & firmware

- `POST /api/staff/devices/:id/points-modifier` body
  `{ pointsPerVapeOverride: number | null }`.
- `GET /api/staff/firmware` / `POST /api/staff/firmware` (create release; body matches
  table) / `PATCH /api/staff/firmware/:id` (`{ active?, notes? }`).
- `POST /api/staff/devices/:id/ota` body `{ version | null }` → sets
  `targetFirmwareVersion` and enqueues `UPDATE_FIRMWARE` when non-null.
- `POST /api/staff/shops/:id/pair-code` → creates device row (PROVISIONING, generated
  serial) + `pairing_codes` row → `{ deviceId, serial, code, expiresAt }`. (Staff
  variant of pairing; partner variant in §4.4.)

---

## 4. Partner API additions (auth + membership check; STAFF bypasses)

### 4.1 Alerts & notification prefs (per shop)

- `GET /api/partner/shops/:id/alerts?active=&limit=`.
- `GET /api/partner/shops/:id/notifications` / `PUT ...` → caller's prefs row scoped to
  that shop. Same body as §3.3.

### 4.2 Team management

- `POST /api/partner/shops/:id/invites` body `{ email, role: OWNER|MANAGER|VIEWER }` —
  **OWNER-only** (the caller must be OWNER of the shop, or STAFF). Creates
  `partner_invites` (7-day expiry) and emails the accept link via Resend
  (`{baseUrl}/partner/invite/{token}`). Re-inviting the same email replaces the pending
  invite.
- `GET /api/partner/shops/:id/invites` (OWNER-only) — pending invites.
- `DELETE /api/partner/shops/:id/invites/:inviteId` (OWNER-only).
- `GET /api/partner/shops/:id/members` — list members with roles.
- `PATCH /api/partner/shops/:id/members/:userId` body `{ role }` (OWNER-only).
- `DELETE /api/partner/shops/:id/members/:userId` (OWNER-only; cannot remove the last
  OWNER).
- `POST /api/invites/accept` body `{ token }` (any authenticated user) — consumes the
  invite, upserts `shop_members`, flips the user's role to PARTNER if they were
  CUSTOMER. Idempotent on re-accept.
- **VIEWER enforcement**: existing mutating partner routes (settings PUT, rewards CRUD,
  mark-empty, redeem) must reject VIEWER members with 403. Add a helper
  `partnerRoleForShop(userId, shopId)` and use it in the new routes; retrofitting every
  legacy route is in scope only if trivial (helper swap), otherwise note as Phase 2.

### 4.3 Fill calibration

- `GET /api/partner/devices/:id/live-fill` → `{ fillPercent, rawDistanceMm,
  lastHeartbeatAt }` from the device row (fast poll for the slider UI).
- `POST /api/partner/devices/:id/calibrate` body `{ seconds?: 60 }` → enqueues
  `CALIBRATE_FILL`; firmware then streams 1 s telemetry incl. `rawDistanceMm` for that
  window. The UI slider maps `emptyDistanceMm` (0%) / `fullOffsetMm` (100%, distance
  from lid) and writes them via device settings (§7).

### 4.4 Pairing

- `POST /api/partner/shops/:id/pair-code` — same as §3.4 but partner-scoped (OWNER or
  MANAGER): creates the PROVISIONING device attached to that shop + pair code. The
  partner reads the code in the app, types it into the bin's SoftAP portal.

### 4.5 Per-device settings validation (existing route upgrade)

`PUT /api/partner/devices/:id/settings` now validates against the structured schema in
§7 (zod, `strict()` off — unknown keys preserved for forward-compat) before saving.

## 4.6 Customer additions

- `POST /api/customer/self-report` body `{ sessionId, brand?, model?, puffCount?,
  isThc?, notes? }` — session must be CLAIMED by this customer; upsert into
  `self_reports` (unique per session).
- `POST /api/auth/register` — accepts optional `claimToken`; after the customer row is
  created, atomically claim it (same logic as `/api/customer/claim/:token`, extracted
  into a shared helper `server/claims.ts`). Response gains
  `claim: { ok, batteries?, error? }` when a token was supplied. Login does **not**
  auto-claim (client redirects to `/claim/:token` after login).

---

## 5. Alert & notification engine (`server/notify.ts`)

### 5.1 Triggers

1. **Telemetry ingest** (§2.1): threshold evaluation (fill levels, FULL, offline-clear).
2. **Device events** (§2.2): FIRE / TEMP_HIGH / VOC_HIGH / errors — trust the device;
   it owns fire logic (fireMode 0-3 already implemented on the sensor board).
3. **Offline sweep**: `startOfflineSweep()` from `server/index.ts`, every 5 min; LIVE
   devices with `lastHeartbeatAt` older than 10 min ⇒ `OFFLINE` alert once
   (`offlineNotifiedAt` latch); heartbeat clears the latch and auto-resolves the alert.

### 5.2 Alert types (closed set)

`FILL_THRESHOLD` (WARNING, `dataJson: {level}`), `FULL` (CRITICAL), `TEMP_HIGH`
(WARNING), `VOC_HIGH` (WARNING), `FIRE` (CRITICAL), `OFFLINE` (WARNING), `SD_ERROR`,
`CAMERA_ERROR` (INFO).

### 5.3 Preferences (`eventsJson` shape, zod-validated)

```json
{
  "full": true,
  "fillLevels": [80],
  "fire": true,
  "tempHigh": true,
  "vocHigh": true,
  "offline": true,
  "drops": false
}
```

Defaults (used when a user has no prefs row — **FULL and FIRE are pre-enabled for
everyone**, exactly as the product requires): `full: true, fire: true, fillLevels: [],
tempHigh: true, vocHigh: true, offline: true, drops: false`.
`channelsJson` default: email only. SMS/call/push are stored but dispatched through a
provider interface (`server/notify.ts` exports `providers` with `email` wired to Resend
and `sms`/`call`/`push` as logged stubs) so Twilio/FCM drop in later without schema
changes.

### 5.4 Dedupe / hysteresis

`devices.alertStateJson` holds `{ notifiedFillLevels: number[], fullNotified: boolean }`.
A fill level notifies once when crossed upward; it re-arms when fill drops ≥10 points
below the level (and FULL re-arms below 90 or on `RESET_FILL_AND_COUNT` /
mark-empty, which must clear the state). FIRE/TEMP/VOC dedupe is the 10-minute
unresolved-alert refresh rule (§2.2).

### 5.5 Recipients

For an alert on device D (shop S): every STAFF user (global-scope prefs) + every member
of S (shop-scope prefs). Each recipient's own prefs decide events + channels. Email via
existing `server/email.ts` Resend wrapper; record per-recipient results in
`alerts.notifiedJson`.

---

## 6. Revocation semantics (staff reject of a drop)

In one DB transaction:

1. Load drop + session + reward config; if `drop.reviewStatus === "REJECTED"` → return
   (idempotent).
2. Set `reviewStatus=REJECTED, reviewedByUserId, reviewedAt, reviewNote=reason`.
3. Set `drops.accepted=false`; decrement `drop_sessions.acceptedDropCount` (floor 0).
4. **Shop points**: shop points were granted at finalize. Insert a compensating
   `shop_point_transactions` row: `type=ADJUST, status=POSTED,
   amount = -perVape` where `perVape = device.pointsPerVapeOverride ??
   config.shopPointsPerVape` (the same rate finalize used — read it from the session's
   award math: `shopPointsAwarded / max(acceptedDropCount_at_finalize,1)` is NOT stored,
   so recompute from current config+override and note the caveat in a comment),
   `description: "Drop #<id> rejected: <reason>"`.
5. **Customer batteries**:
   - Session CLAIMED → insert `battery_transactions`: `type=ADJUST, status=POSTED,
     amount = -batteriesPerVape`, customer = session.claimedByCustomerId. Balance may go
     negative — allowed by design (they may have spent already); the wallet UI shows it.
   - Session FINALIZED but unclaimed → decrement `batteriesEstimated` (floor 0) so a
     later claim pays the corrected amount.
   - Session OPEN → just the accepted-count decrement (finalize will compute correctly).
6. Set `pointsRevoked=true`.

Approve after reject: allowed, symmetric — write the reverse ADJUST entries and clear
`pointsRevoked`. Keep both directions in one helper so the ledger never drifts.

---

## 7. Structured device settings (`shared/deviceSettings.ts`)

Zod schema + TS type + defaults, exported for the settings PUT validation and documented
for firmware. All keys optional (partial updates merge server-side onto stored JSON):

```jsonc
{
  "fill": { "emptyDistanceMm": 500, "fullOffsetMm": 76 },   // calibration
  "policy": { "allowThcVapes": false },
  "fire": {
    "enabled": true, "mode": 2,            // 0 temp,1 voc,2 either,3 both
    "tempC": 40, "vocAnalog": 3000, "vocWarmupSec": 300,
    "onBoth": ["NOTIFY", "BIN_ALARM"],     // actions: NOTIFY|SMS|CALL|BIN_ALARM
    "onTempOnly": ["NOTIFY"],
    "onVocOnly": ["NOTIFY"]
  },
  "hours": { "enabled": false, "open": "09:00", "close": "21:00",
             "tz": "America/New_York" },
  "ui": { "theme": "default" },            // HMI wallpaper set
  "session": { "stackWindowSec": 6, "qrTtlSec": 30 },
  "telemetry": { "idleSec": 30, "activeSec": 5 },
  "camera": { "idleSnapshotSec": 8 }       // background reference cadence
}
```

Fire **actions** are executed server-side on a FIRE event: NOTIFY → §5 dispatch;
SMS/CALL → provider stubs; BIN_ALARM → enqueue `SOUND_ALARM {seconds: 60}` command.
(The bin also alarms locally and immediately — server actions are supplementary.)

---

## 8. Implementation layout

New files (feature-owned, mounted from `routes.ts`):

- `server/routes/review.ts` — §3.1
- `server/routes/alerts.ts` — §3.3, §4.1 (+ resolve)
- `server/routes/team.ts` — §4.2
- `server/routes/selfreport.ts` — §4.6 self-report
- `server/routes/devops.ts` — §3.2, §3.4, §4.3, §4.4, §2.3, §2.4 (device-side pairing/
  OTA live here too, mounted before device auth where needed)
- `server/notify.ts` — §5 engine; `server/ratelimit.ts` — §2.7;
  `server/claims.ts` — shared claim helper; `shared/deviceSettings.ts` — §7.

Tests (vitest, pure logic only — no DB): threshold/hysteresis evaluation, revocation
math, settings schema validation, pair-code alphabet/entropy, rate-limiter window.

`scripts/seed.ts` rewritten for the current schema (STAFF user, demo shop + partner,
demo device with known key, reward config, store items, notification prefs).
