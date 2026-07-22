# LITTR Cloud API Reference

Complete reference for the LITTR.co backend HTTP API as implemented in
`server/routes.ts` and `server/routes/*.ts`. This documents the **code as built**
(existing endpoints + the Phase 1 additions). For the design rationale behind the
Phase 1 work see `docs/API_DESIGN.md`; for the firmware-facing device contract see
`docs/DEVICE_API.md`; for the ledger semantics see `docs/REWARD_ECONOMY.md`.

---

## Conventions

### Authentication

Three auth schemes are used, applied per-route by middleware from `server/auth.ts`:

| Scheme | How | Middleware |
|--------|-----|------------|
| **User session** | `X-Session-Id: <id>` header **or** `sessionId` cookie | `authMiddleware` |
| **Role gate** | On top of a session, the user's `role` must match | `requireRole(...roles)` |
| **Device key** | `X-Device-Key: <hex>` header (server SHA-256 hashes it and matches `devices.deviceKeyHash`) | `deviceAuthMiddleware` |

- User roles: `STAFF`, `PARTNER`, `CUSTOMER`.
- A **STAFF** user bypasses shop-membership checks everywhere partner routes enforce them.
- **Partner shop membership** roles (`shop_members.role`): `OWNER`, `MANAGER`, `VIEWER`.
  `VIEWER` is read-only — mutating partner routes reject it with `403`.
- `deviceAuthMiddleware` rejects a missing key with `401`, an unknown key with `401`,
  and a `RETIRED` device with `403`.

In the tables below the **Auth** column uses shorthand:
`none` (public), `session` (any logged-in user), `CUSTOMER` / `PARTNER` / `STAFF`
(role-gated), `PARTNER+STAFF` (either role, membership enforced for PARTNER), and
`device-key`.

### Error responses

Route handlers return errors as `{ "error": "<message>" }` with an appropriate
status code. Zod validation failures return `400` with a human-readable message
(via `zod-validation-error` where wired). The top-level Express error handler
(`server/index.ts`) is the exception: an *unhandled* throw becomes
`{ "message": "<message>" }` with status `500`.

Common status codes: `400` invalid input, `401` unauthenticated, `403` forbidden
(wrong role / not a shop member / VIEWER), `404` not found, `409` conflict,
`410` gone (expired claim/invite), `429` rate limited (with `Retry-After`),
`304` not modified, `204` no content.

### Rate limits (`server/ratelimit.ts`)

In-memory sliding windows (per process — a multi-instance deploy needs a shared store):

| Limiter | Scope | Applies to |
|---------|-------|------------|
| `deviceLimiter` | 120 req/min **per device** (shared singleton) | all general `/api/device/*` routes |
| `photoLimiter` | 30 req/min per device | device photo uploads |
| `authLimiter` | 10 req/min per IP | `/api/auth/login`, `/api/auth/register` |
| `claimLimiter` | 20 req/min per IP | `GET /api/claim/:token`, `POST /api/customer/claim/:token` |
| `claimByCodeLimiter` | 10 req/min per IP | `POST /api/device/claim-by-code` |

`req.ip` derives from `X-Forwarded-For` with `trust proxy = 1` (one trusted hop).

---

## Auth  (`/api/auth/*`)

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/auth/login` | none (rate: authLimiter) |
| POST | `/api/auth/register` | none (rate: authLimiter) |
| POST | `/api/auth/logout` | session |
| GET | `/api/auth/me` | session |
| PATCH | `/api/auth/theme` | session |
| POST | `/api/auth/change-password` | session |

### POST `/api/auth/login`
Body: `{ email, password }`.
Response `200`: `{ user: { id, email, role, themePreference }, sessionId }`.
Errors: `400` missing email/password, `401` invalid credentials, `500` login failed.

### POST `/api/auth/register`
Body: `{ email, password, role?, claimToken? }`.
- `role` is honored only when `"PARTNER"`; anything else registers a `CUSTOMER`.
  The reserved staff email (`server/auth.ts` `STAFF_EMAIL`) is always forced to `STAFF`.
- A `CUSTOMER` registration also creates a `customers` row + wallet.
- If `claimToken` is supplied, the new session's customer claims it immediately
  (shared helper `claimSessionForCustomer`, spec §4.6).

Response `200`: `{ user: { id, email, role }, sessionId, claim? }` where `claim`
(present only when a token was supplied) is `{ ok: true, batteries }` or
`{ ok: false, error }`.
Errors: `400` missing fields / email already registered, `500`.

### POST `/api/auth/logout`
Deletes the session. Response `200`: `{ success: true }`.

### GET `/api/auth/me`
Response `200`: `{ user: { id, email, role, themePreference } }`.

### PATCH `/api/auth/theme`
Body: `{ theme: "light" | "dark" }`. Response `200`: `{ success: true }`.
Errors: `400` invalid theme.

### POST `/api/auth/change-password`
Body: `{ currentPassword, newPassword }`. Response `200`: `{ success: true }`.
Errors: `401` current password incorrect, `404` user not found, `500`.

---

## Public  (no auth)

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/contact` | none |
| POST | `/api/leads` | none |
| POST | `/api/volunteers` | none |
| GET | `/api/shops` | none |

### POST `/api/contact`
Body validated by `insertContactSchema`: `{ name, email, message }`. Fires an email
notification (best-effort). Response `200`: the created contact. Errors: `400` zod.

### POST `/api/leads`
Body validated by `insertLeadSchema`: `{ businessName, contactName, email, phone,
address, volume? }` (bin-request lead). Fires an email notification. Response `200`:
the created lead. Errors: `400` zod.

### POST `/api/volunteers`
Body validated by `insertVolunteerSchema`: `{ name, email, interest, availability,
notes? }`. Fires an email notification. Response `200`: the created volunteer.
Errors: `400` zod.

### GET `/api/shops`
Response `200`: array of **VERIFIED** shops only.

---

## Customer  (`/api/customer/*`)

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/customer/wallet` | CUSTOMER |
| GET | `/api/customer/transactions` | CUSTOMER |
| GET | `/api/customer/redemptions` | CUSTOMER |
| GET | `/api/customer/store` | **none** (public catalog) |
| POST | `/api/customer/redeem` | CUSTOMER |
| POST | `/api/customer/self-report` | CUSTOMER |

### GET `/api/customer/wallet`
Response `200`: `{ customer: { id, publicId }, wallet: { pointsBalance, lifetimeEarned } }`.
Balance is **derived** from `battery_transactions` (EARNED − REDEEMED + signed ADJUST,
`status = POSTED`) and may be negative after a revocation (see REWARD_ECONOMY.md).
Errors: `404` customer profile not found.

### GET `/api/customer/transactions`
Response `200`: array of `{ id, amount, type, description, createdAt }` (newest first,
max 100). `amount` is rendered negative for `REDEEMED`. Returns `[]` if no customer profile.

### GET `/api/customer/redemptions`
Response `200`: the customer's redemption history. `[]` if no profile.

### GET `/api/customer/store`
Response `200`: active `store_items` with `category = "customer"`. Public — no auth.

### POST `/api/customer/redeem`
Body: `{ itemId: number }`. Checks balance ≥ cost, inserts a `REDEEMED`
`battery_transactions` row and a `PENDING` `redemptions` row.
Response `200`: `{ ok: true, redemption, balance }`.
Errors: `400` itemId required / insufficient batteries, `404` customer or item not found.

### POST `/api/customer/self-report`  (spec §4.6, `routes/selfreport.ts`)
Body: `{ sessionId, brand?, model?, puffCount?, isThc?, notes? }`. The session must be
`CLAIMED` by the calling customer. Upserts into `self_reports` (unique per session) —
omitted fields overwrite with `null` (full replace on re-submit).
Response `200`: `{ ok: true, selfReport }`.
Errors: `400` zod, `403` session not claimed by you, `404` customer or session not found.

---

## Claim & Invites

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/claim/:token` | none (rate: claimLimiter) |
| POST | `/api/customer/claim/:token` | CUSTOMER (rate: claimLimiter) |
| POST | `/api/invites/accept` | session (any role) |

### GET `/api/claim/:token`
Public landing lookup. Response `200`: `{ sessionId, batteries, acceptedDrops,
claimed, shop: { id, name, city } | null, expiresAt }`.
Errors: `404` invalid token, `410` claim expired.

### POST `/api/customer/claim/:token`
Claims a finalized session for the logged-in customer (transactional, `SELECT … FOR
UPDATE`; `UNIQUE(session_id)` on `battery_transactions` blocks double-claims).
Response `200`: `{ ok: true, batteries, balance }`.
Errors: `404` invalid token / no customer profile, `409` already claimed, `410` expired.

### POST `/api/invites/accept`  (`routes/team.ts`)
Body: `{ token }`. Consumes a partner invite, upserts `shop_members`, and promotes a
`CUSTOMER` to `PARTNER`. Idempotent for the same accepting user.
Response `200`: `{ ok: true, shopId, role }`.
Errors: `400` token required, `404` invalid invite, `409` already used (by another
user), `410` invite expired.

---

## Partner  (`/api/partner/*`)

All partner routes require `requireRole("PARTNER", "STAFF")`. For a PARTNER, shop /
device membership is enforced (`isShopMember` / `partnerRoleForShop`); **STAFF bypasses**.
Mutating routes additionally reject `VIEWER` members with `403 Forbidden`
(`mutableShopError`). Non-member PARTNER gets `403 "Not your shop"`.

### Shops, sessions & points

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/partner/shops` | PARTNER+STAFF | STAFF sees all shops; PARTNER sees own memberships |
| GET | `/api/partner/shops/:id/devices` | PARTNER+STAFF | devices for the shop |
| GET | `/api/partner/shops/:id/sessions` | PARTNER+STAFF | recent drop sessions (max 50) |
| GET | `/api/partner/shops/:id/points/balance` | PARTNER+STAFF | `{ balance }` (derived) |
| GET | `/api/partner/shops/:id/points/transactions` | PARTNER+STAFF | ledger (max 100) |

### Shop reward store

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/partner/shops/:id/rewards` | PARTNER+STAFF | catalog |
| POST | `/api/partner/shops/:id/rewards` | PARTNER+STAFF (not VIEWER) | body `insertShopRewardSchema` (`{ name, description?, cost, active? }`, `shopId` injected) |
| PATCH | `/api/partner/shops/:id/rewards/:rewardId` | PARTNER+STAFF (not VIEWER) | partial update |
| DELETE | `/api/partner/shops/:id/rewards/:rewardId` | PARTNER+STAFF (not VIEWER) | `{ ok: true }` |
| POST | `/api/partner/shops/:id/rewards/:rewardId/redeem` | PARTNER+STAFF (not VIEWER) | checks balance, inserts `REDEEMED` shop-point row + redemption |
| GET | `/api/partner/shops/:id/redemption-history` | PARTNER+STAFF | redemptions list |

Redeem response `200`: `{ ok: true, redemption, balance }`. Errors: `400` insufficient
points, `404` reward not found / inactive.

### Per-device settings & maintenance

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/partner/devices/:id/settings` | PARTNER+STAFF | `{ settingsJson, version }` |
| PUT | `/api/partner/devices/:id/settings` | PARTNER+STAFF (not VIEWER) | validated + merged |
| POST | `/api/partner/devices/:id/mark-empty` | PARTNER+STAFF (not VIEWER) | enqueues `RESET_FILL_AND_COUNT` |

- **PUT settings** validates the body against the structured schema in
  `shared/deviceSettings.ts` (`validateDeviceSettings`; unknown keys preserved), then
  **deep-merges** the partial patch onto the stored JSON (`mergeDeviceSettings`) and
  bumps `version`. Errors: `400` invalid settings, `403`, `404` device not found.
- **mark-empty** also zeroes `vapesSinceEmpty`/`fillPercent` server-side and clears
  `alertStateJson` (re-arms fill/FULL alerts, spec §5.4). Response `{ ok: true, command }`.

### Alerts & notification prefs (per shop, spec §4.1 — `routes/alerts.ts`)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/partner/shops/:id/alerts` | PARTNER+STAFF | query `active?`, `deviceId?`, `limit?` |
| GET | `/api/partner/shops/:id/notifications` | PARTNER+STAFF | caller's shop-scoped prefs |
| PUT | `/api/partner/shops/:id/notifications` | PARTNER+STAFF | update caller's shop-scoped prefs |

- Alerts query: `active` = `"true"` (unresolved) / `"false"` (resolved); `deviceId`
  int; `limit` 1–500 (default 50). Rows are **redacted** for partners —
  `notifiedJson` and `dataJson` are stripped (they hold staff/other-member emails);
  the human-readable `message` is kept.
- Prefs GET returns the **effective** (defaults-merged) prefs even before a row
  exists: `{ shopId, channelsJson, eventsJson, phone, updatedAt }`.
- Prefs PUT body (`notificationPrefsPutSchema`, `.strict()`): `{ channelsJson?,
  eventsJson?, phone? }`. `channelsJson` keys `email|sms|call|push` (booleans);
  `eventsJson` keys `full, fillLevels (int[1..100], max 10), fire, tempHigh, vocHigh,
  offline, drops`. Partial patches merge; `fillLevels` replaces wholesale. Errors:
  `400` with `path: message`, `403`/`404` per shop access.

### Team management (spec §4.2 — `routes/team.ts`)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/partner/shops/:id/invites` | OWNER (STAFF acts as OWNER) | create/replace pending invite |
| GET | `/api/partner/shops/:id/invites` | OWNER | pending, unexpired invites |
| DELETE | `/api/partner/shops/:id/invites/:inviteId` | OWNER | `{ ok: true }` |
| GET | `/api/partner/shops/:id/members` | OWNER/MANAGER/VIEWER | member list |
| PATCH | `/api/partner/shops/:id/members/:userId` | OWNER | `{ role }` |
| DELETE | `/api/partner/shops/:id/members/:userId` | OWNER | remove member |

- **Invite** body: `{ email, role: OWNER|MANAGER|VIEWER }`. 7-day expiry; re-inviting
  the same email replaces the pending invite; emails an accept link
  (`{baseUrl}/partner/invite/{token}`, best-effort). Response: the invite row + `acceptUrl`.
- **Members list** returns `{ userId, email, role, createdAt }[]`. Any member (incl.
  VIEWER) may read it.
- **PATCH/DELETE member** cannot demote or remove the **last OWNER** (`400`).
- Non-OWNER callers on OWNER-only routes get `403 Forbidden`; non-members `403 Not
  your shop`; bad shop id `400`; missing shop `404`.

### Fill calibration & pairing (spec §4.3/§4.4 — `routes/devops.ts`)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/partner/devices/:id/live-fill` | PARTNER+STAFF | fast poll for slider |
| POST | `/api/partner/devices/:id/calibrate` | PARTNER+STAFF (not VIEWER) | enqueues `CALIBRATE_FILL` |
| POST | `/api/partner/shops/:id/pair-code` | OWNER or MANAGER (STAFF bypass) | SoftAP pair code |

- **live-fill** response: `{ fillPercent, rawDistanceMm, lastHeartbeatAt }`
  (`rawDistanceMm` = `devices.lastDistanceMm`).
- **calibrate** body: `{ seconds?: 5..600, default 60 }` → `{ ok: true, commandId }`.
- **pair-code** creates a `PROVISIONING` device attached to the shop + a `pairing_codes`
  row → `{ deviceId, serial, code, expiresAt }` (10-min TTL). VIEWER (or a role other
  than OWNER/MANAGER) is rejected `403`.

### BLE pairing (legacy, kept — `routes.ts`)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/partner/bins/pair-init` | PARTNER+STAFF (not VIEWER) | body `{ shopId }` |

Creates a `PROVISIONING` device + `pairing_nonces` row; returns
`{ deviceId, serial, deviceKey, nonce, ttlMs }`. The bin then calls
`POST /api/device/claim` (see Device). See also the newer QR/SoftAP flow (pair-code +
`/api/device/claim-by-code`).

---

## Staff  (`/api/staff/*`, `requireRole("STAFF")`)

### Devices, shops, users & CRM (`routes.ts`)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/staff/devices` | all devices |
| GET | `/api/staff/devices/:id/commands` | command history (max 100) |
| POST | `/api/staff/devices/:id/commands` | body `{ type, payload? }`; `RESET_FILL_AND_COUNT` also clears `alertStateJson` |
| DELETE | `/api/staff/devices/:id` | delete device → `{ ok: true }` |
| GET | `/api/staff/shops` | all shops |
| POST | `/api/staff/shops` | body `insertShopSchema` |
| PATCH | `/api/staff/shops/:id/status` | body `{ status }` |
| POST | `/api/staff/shops/:id/members` | body `{ userId, role?: OWNER\|MANAGER }` (default MANAGER) |
| GET | `/api/staff/users` | `{ id, email, role, createdAt }[]` |
| PATCH | `/api/staff/users/:id/role` | body `{ role }` |
| GET | `/api/staff/leads` | all leads |
| GET | `/api/staff/contacts` | all contacts |
| GET | `/api/staff/volunteers` | all volunteers |
| GET | `/api/staff/pickups` | all pickup requests |

### Drop review & training export (spec §3.1 — `routes/review.ts`)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/staff/review/queue` | review queue with before/after photo URLs |
| GET | `/api/staff/review/drops/:dropId` | full drop detail |
| POST | `/api/staff/review/drops/:dropId/approve` | approve (idempotent) |
| POST | `/api/staff/review/drops/:dropId/reject` | reject + revoke (idempotent) |
| GET | `/api/staff/sessions` | all drop sessions incl. unclaimed/expired |
| GET | `/api/staff/export/training` | JSONL training corpus |

- **queue** query (all optional): `status` (`UNREVIEWED|APPROVED|REJECTED|all`),
  `shopId`, `deviceId`, `limit` (1–200, default 50), `offset` (default 0). Empty-string
  params are treated as unset. Each row = drop fields + `beforeUrl`, `afterUrl`,
  `session`, `device` (`{id,serial,status}`), `shop` (`{id,name,city}`), newest first.
- **detail** response: `{ drop, beforeUrl, afterUrl, photos[], session, device, shop,
  selfReport | null }`. Errors: `400` invalid id, `404` drop/session not found.
- **approve** → `{ ok: true, drop }`. Idempotent (second approve is a no-op). If the
  drop was previously REJECTED and points were revoked, it writes the symmetric
  restore ledger entries and clears `pointsRevoked` (see REWARD_ECONOMY.md §Revocation).
- **reject** body: `{ reason }` (1–1000 chars). Runs the full revocation transaction
  (spec §6). Idempotent (second reject is a no-op `200`). → `{ ok: true, drop }`.
- **sessions** query: `status` (`OPEN|FINALIZED|CLAIMED|EXPIRED|all`), `claimed`
  (`"true"|"false"`), `shopId`, `from`, `to` (dates), `limit` (1–200, default 50),
  `offset`. Each row = session fields + `device` (`{id,serial}`) + `shop`.
- **export/training** query: `from`, `to`, `status`. Streams
  `Content-Type: application/x-ndjson` (`littr-training.jsonl`), one JSON line per drop:
  `{ dropId, deviceId, shopId, sessionId, beforeUrl, afterUrl, reviewStatus,
  reviewNote, accepted, beamPatternJson, takenAt, selfReport? }`. Batched (500/page).

### Live camera (spec §3.2 — `routes/devops.ts`)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/staff/devices/:id/snapshot` | body `{ ir: boolean }` → enqueues `TAKE_PHOTO {ir}`, `{ commandId }` |
| GET | `/api/staff/devices/:id/photos` | newest photos, optional `reason`/`afterId` filter |

- **photos** query: `reason` (`idle|drop_before|drop_after|maintenance|calibration|live`),
  `limit` (1–100, default 10), `afterId` (returns photos with `id > afterId`). Newest
  first. Live-view loop: `snapshot` → poll `photos?afterId=` until the new photo lands.

### Alerts & notification prefs (spec §3.3 — `routes/alerts.ts`)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/staff/alerts` | alert history; query `deviceId?`, `active?`, `limit?` |
| POST | `/api/staff/alerts/:id/resolve` | stamps `resolvedAt` (idempotent) |
| GET | `/api/staff/notifications` | caller's **global-scope** prefs (shopId null) |
| PUT | `/api/staff/notifications` | update caller's global prefs |

- Staff alert rows are returned **in full** (incl. `dataJson`, `notifiedJson`) —
  unlike the partner variant.
- `resolve`: `404` if not found; returns the existing row unchanged if already resolved.
- Prefs GET/PUT: same shapes as the partner prefs above, but scope is global
  (`shopId = null`). PUT body = `notificationPrefsPutSchema`.

### Devices & firmware (spec §3.4 — `routes/devops.ts`)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/staff/devices/:id/points-modifier` | body `{ pointsPerVapeOverride: int 0..1000 \| null }` |
| GET | `/api/staff/firmware` | all firmware releases, newest first |
| POST | `/api/staff/firmware` | create a release |
| PATCH | `/api/staff/firmware/:id` | body `{ active?, notes? }` |
| POST | `/api/staff/devices/:id/ota` | body `{ version: string \| null }` |
| POST | `/api/staff/shops/:id/pair-code` | staff variant of pair-code |

- **points-modifier** → `{ ok: true, pointsPerVapeOverride }`. Sets the per-bin
  shop-points override used at finalize (spec §1.2).
- **POST firmware** body (`firmwareCreateBody`): `{ board: "sensor"|"hmi", version,
  channel: "stable"|"beta" (default stable), url, sha256 (64 hex), sizeBytes?, notes?,
  active? }`. Returns the created row. `409` on duplicate `(board, version, channel)`.
- **PATCH firmware** requires at least one of `active`/`notes` (`400` otherwise);
  `404` if release not found.
- **ota** sets `devices.targetFirmwareVersion`; when non-null also enqueues
  `UPDATE_FIRMWARE {version}`. → `{ ok: true, targetFirmwareVersion, commandId? }`.
- **pair-code** → `{ deviceId, serial, code, expiresAt }` (creates a PROVISIONING device
  for the shop). `404` if shop not found.

---

## Device  (`/api/device/*`)

Every route requires `X-Device-Key` **except** `POST /api/device/claim` (uses a nonce)
and `POST /api/device/claim-by-code` (uses a pair code). See `docs/DEVICE_API.md` for
the firmware-oriented walkthrough; the table here is the API-surface summary.

| Method | Path | Auth | Rate |
|--------|------|------|------|
| POST | `/api/device/claim` | none (nonce) | deviceLimiter |
| POST | `/api/device/claim-by-code` | none (pair code, TLS) | claimByCodeLimiter (10/min/IP) |
| POST | `/api/device/telemetry` | device-key | deviceLimiter |
| POST | `/api/device/events` | device-key | deviceLimiter |
| GET | `/api/device/settings` | device-key | deviceLimiter |
| GET | `/api/device/commands` | device-key | deviceLimiter |
| POST | `/api/device/commands/ack` | device-key | deviceLimiter |
| GET | `/api/device/firmware` | device-key | deviceLimiter |
| POST | `/api/device/drop-sessions/start` | device-key | deviceLimiter |
| POST | `/api/device/drops` | device-key | deviceLimiter |
| POST | `/api/device/drops/:dropId/photos` | device-key | photoLimiter (30/min) |
| POST | `/api/device/photos` | device-key | photoLimiter (30/min) |
| POST | `/api/device/drop-sessions/:id/finalize` | device-key | deviceLimiter |

### POST `/api/device/claim`  (BLE nonce)
Body: `{ nonce, serial?, firmwareVersion? }`. Consumes a single-use nonce, flips the
device `LIVE`. Response `200`: `{ deviceId, serial, shopId }`.
Errors: `400` invalid/expired nonce or serial mismatch, `404` device not found.

### POST `/api/device/claim-by-code`  (SoftAP)
Body: `{ code (6 chars, upper-cased), uid (4–64 chars), firmwareVersion? }`. Consumes
the pair code atomically, mints a **fresh device key**, stores its hash, sets `LIVE`.
Response `200`: `{ deviceId, serial, deviceKey, shopId }` — `deviceKey` is returned
exactly once. Errors: `400` bad body / invalid or expired code, `404` device not found.

### POST `/api/device/telemetry`
Body (all optional): `{ vapesSinceEmpty, fillPercent, tempC, vocRaw, wifiRssi,
sdFreeMb, rawDistanceMm, firmwareVersion, state, errorLog }`. Persists onto `devices`
(`rawDistanceMm → lastDistanceMm`; `state` is accepted but not persisted), stamps
`lastHeartbeatAt`, then runs the alert engine (fill thresholds / FULL / offline-clear).
Response `200`: `{ ok: true }`. Errors: `400` bad telemetry.

### POST `/api/device/events`
Device-initiated alert. Body: `{ type: "FIRE"|"TEMP_HIGH"|"VOC_HIGH"|"SD_ERROR"|
"CAMERA_ERROR", tempC?, vocAnalog?, fillPercent?, message? }`. Creates an `alerts` row
and dispatches notifications; an unresolved same-type alert within 10 min is refreshed,
not duplicated. Response `202`: `{ alertId: number | null }`. Errors: `400` bad event.

### GET `/api/device/settings?version=<n>`
`200 { version, settings }` when the stored version is newer; `304` when not.

### GET `/api/device/commands?lastCommandId=<n>`
`200 { commands: [...] }` — commands with `id > n` in status `PENDING|SENT`.

### POST `/api/device/commands/ack`
Body: `{ commandId, result? }`. Marks the command `ACKED`. `404` if not found.

### GET `/api/device/firmware?board=&channel=&version=`  (OTA check)
Query: `board` (`sensor|hmi`, required), `channel` (`stable|beta`, default stable),
`version?` (currently installed). A device's `targetFirmwareVersion` pin wins; else the
newest `active` release for `(board, channel)`. `204` when already on the target/newest
or nothing applies; else `200 { version, url, sha256, sizeBytes }`. Errors: `400` bad query.

### POST `/api/device/drop-sessions/start`
Response `200`: `{ sessionId }`.

### POST `/api/device/drops`
Body: `{ sessionId, sequence, beamPatternJson?, tempC?, vocRaw?, fillPercent?,
accepted? }`. Session must exist, belong to the device, and be `OPEN`. Increments
detected/accepted counts. Response `200`: `{ dropId }`. Errors: `400` bad body / session
not open, `404` session not found.

### POST `/api/device/drops/:dropId/photos`
Body: `{ imageRole: "before"|"after", imageBase64 }`. Ownership checked (drop → session
→ device). JPEG hardening: ≤ 4 MB decoded, must start with `FF D8 FF`. Links the photo
onto the drop (`beforePhotoId`/`afterPhotoId`); `after` also sets the device
`latestPhotoUrl`. Response `200`: `{ photoId, url }`. Errors: `400` bad image / not JPEG /
too large, `403` not your drop, `404` drop not found.

### POST `/api/device/photos`  (untied to a drop)
Body: `{ reason: "idle"|"maintenance"|"calibration"|"live", imageBase64, sessionId? }`.
Same JPEG hardening. Sets device `latestPhotoUrl`. Response `200`: `{ photoId, url }`.
The `live` reason answers staff snapshot commands.

### POST `/api/device/drop-sessions/:id/finalize`
Transactional (`SELECT … FOR UPDATE` on the session). Computes
`batteriesEstimated = acceptedDropCount × batteriesPerVape`, awards shop points
immediately (`acceptedDropCount × (device.pointsPerVapeOverride ?? shopPointsPerVape)`),
issues a `claimToken`/`claimUrl`. `acceptedDropCount == 0` → session `EXPIRED`, no token.
Response `200`: `{ ok: true, batteries, shopPoints, claimToken, claimUrl, expiresAt }`
(or `{ ok: true, batteries: 0, claimToken: null, claimUrl: null, expired: true }`).
Errors: `400` already finalized, `404` session not found.

### Device command types

Enqueued by the server, polled via `GET /api/device/commands`:
`RESET_FILL_AND_COUNT`, `REBOOT`, `PING`, `TAKE_PHOTO {ir}`, `CALIBRATE_FILL {seconds}`,
`SOUND_ALARM {seconds}`, `UPDATE_FIRMWARE {version}`. (Firmware executes them; the server
only enqueues.)
