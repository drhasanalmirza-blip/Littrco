# Phase 3 — Server Additions Spec

_The buildable/testable server work that enables the firmware milestones in
repo-root `PHASE3_FIRMWARE_PLAN.md` §8. This is the contract the sensor board
will call. Same conventions as `docs/API_DESIGN.md` (zod on every body/query,
`{ error }` shape, existing middleware, drizzle patterns). Owner decision:
offline drops award **shop points** but no customer batteries and no claim token._

---

## 1. Schema deltas (`shared/schema.ts`)

`devices` — add:
- `hmiVersion` text, nullable — HMI firmware version (sensor reports it in telemetry).
- `assetsVersion` text, nullable — HMI content-pack version the bin currently has.

`drop_sessions` — add:
- `offline` boolean, not null, default false — session captured while WiFi was down.

`drops` — add:
- `occurredAt` timestamp, nullable — true drop time (offline drops carry the real
  time; live drops leave null → `createdAt` is authoritative).

New enum value: `photo_reason` already has what we need; no change.

New table `content_files`:
- id serial PK, `board` text (`hmi` | `sensor`), `theme` text default `"default"`,
  `path` text (destination on the device SD, e.g. `/ui/rules_warning.raw` or
  `/config/hmi.json`), `version` integer not null default 1, `url` text,
  `sha256` text (64 hex), `sizeBytes` integer nullable, `active` boolean default
  true, `notes` text nullable, `createdAt` timestamp default now.
- Index on (`board`, `theme`). The "content version" for a (board, theme) is the
  **max `version`** across its active rows. Re-uploading the same path bumps its
  version (a new row; older rows for that path go `active=false`).

---

## 2. Settings schema (`shared/deviceSettings.ts`)

`policy` — add `allowOtherElectronics` boolean optional (DEFAULT **false**).

New `ui.carousel` object (all optional, bounded):
- `secPerPage` int 5–120 (DEFAULT **20**)
- `postSessionCounterSec` int 0–600 (DEFAULT **60**)

Update `DEFAULT_DEVICE_SETTINGS` accordingly. Keep the existing
`allowThcVapes: true` default (owner-confirmed). Unknown keys still pass through.

Update `server/__tests__/deviceSettings.test.ts` for the new defaults/fields.

---

## 3. Device API additions (`X-Device-Key`)

### 3.1 Telemetry (extend `POST /api/device/telemetry`)
Body gains optional `hmiVersion`, `assetsVersion` (strings) → persist onto the
device row. Everything else unchanged (alert engine still runs).

### 3.2 Content manifest — `GET /api/device/content`
Query: `board` (`hmi`|`sensor`, required), `theme` (default `"default"`),
`version` (int, the bin's current content version — optional).
- Compute server version = max active `version` for (board, theme). If none →
  `204`. If `version` param present and `>=` server version → `304`.
- Else `200 { version, files: [{ path, url, sha256, sizeBytes }] }` — all active
  files for (board, theme), so the device can delta-sync by comparing SHAs.

### 3.3 QR fallback — `GET /api/device/qr`
Query: `token` (a session `claimToken`). Auth: `X-Device-Key`; the token's
session must belong to the calling device (else `404`, do not leak). Generates
the QR for `{baseUrl}/claim/{token}` using the `qrcode` npm lib. Responds
`200 { url, size, modules }` where `size` = module count per side and `modules` =
base64 of the row-major 1-bpp matrix (bit i = module (row,col), MSB-first,
rows byte-aligned). Errors: `400` missing token, `404` unknown/foreign token.
Keep it small (≤ ~2 KB). Add a pure helper `server/qr.ts` (`qrMatrix(text) →
{ size, modules }`) unit-tested against known vectors (size only + determinism).

### 3.4 Offline drops (extend existing device routes)
- `POST /api/device/drop-sessions/start` body gains `offline?: boolean` → stored
  on the new `drop_sessions.offline`. Response unchanged (`{ sessionId }`).
- `POST /api/device/drops` body gains `occurredAt?: string` (ISO) → stored on
  `drops.occurredAt`. Counts still increment.
- `POST /api/device/drop-sessions/:id/finalize` — when `session.offline`:
  award shop points exactly as normal (`acceptedDropCount × perVape`), but set
  `batteriesEstimated = 0`, **mint no `claimToken`**, status `FINALIZED` (not
  EXPIRED — it has real drops), no `claimUrl`. Response
  `{ ok: true, offline: true, shopPoints, batteries: 0, claimToken: null,
  claimUrl: null }`. Live (non-offline) finalize is unchanged.

### 3.5 Commands (documented; enqueue via existing/new staff routes)
Firmware-facing command set now includes `board` on `UPDATE_FIRMWARE` and
`REBOOT`, plus `UPDATE_ASSETS {theme?, version?}`. See §4.

---

## 4. Staff API additions (`requireRole("STAFF")`)

### 4.1 Content management (`routes/devops.ts` or a new `routes/content.ts`)
- `GET /api/staff/content?board=&theme=` → content_files rows (newest first).
- `POST /api/staff/content` body `{ board, theme?, path, url, sha256 (64hex),
  sizeBytes?, notes? }` → creates a new active row, bumping the path's version
  and deactivating prior rows for that (board, theme, path). Mirrors the
  firmware-release create pattern.
- `PATCH /api/staff/content/:id` body `{ active?, notes? }`.
- `POST /api/staff/devices/:id/update-assets` body `{ theme?, version? }` →
  enqueues `UPDATE_ASSETS` command; `{ ok: true, commandId }`.

### 4.2 OTA / reboot board targeting
- `POST /api/staff/devices/:id/ota` (existing) body gains `board?: "sensor"|"hmi"`
  (default `sensor`); enqueues `UPDATE_FIRMWARE { version, board }` and, for
  `board=sensor`, still sets `devices.targetFirmwareVersion`. (HMI target version
  is tracked implicitly via content/telemetry; do not overwrite the sensor's
  `targetFirmwareVersion` when `board=hmi`.)
- Existing `POST /api/staff/devices/:id/commands` already enqueues arbitrary
  `{ type, payload }`, so `REBOOT { board }` needs no new route — just document it.

### 4.3 Device Ops display
Show `hmiVersion` and `assetsVersion` next to the sensor FW version in the staff
Device Ops panel.

---

## 5. Alerts (`server/notifyRules.ts`)
Add `UPDATE_FAILED` to the device-event enum + `ALERT_SEVERITY` (**WARNING**).
The device posts it via the existing `POST /api/device/events`. Update
`server/__tests__/notifyRules.test.ts` (severity map).

---

## 6. Review queue / training export (offline badge)
- `GET /api/staff/review/queue`, `/drops/:id`, `/sessions`, and
  `/export/training` include the session's `offline` flag so the UI can badge
  offline drops and the training corpus can exclude/label them. Add `offline` to
  each row/line where the session is joined.
- Client: staff ReviewQueue + Sessions show an "Offline" badge when
  `session.offline`.

---

## 7. Deps
Add `qrcode` (QR matrix generation) to dependencies. No other new deps.

## 8. Gates
`npm run check` clean, `npx vitest run server/__tests__/` green (with new tests
for `qrMatrix`, offline-finalize math if extracted pure, settings defaults,
severity map), `npx vite build` completes.

## 9. Docs
Update `docs/CLOUD_API.md` (new device + staff endpoints, telemetry fields,
offline finalize response), `docs/DEVICE_API.md` (content manifest, QR fallback,
offline drops, board-targeted commands), and `replit.md` (Phase 3 server
additions). Rewrite/extend `scripts/seed.ts` only if a new column breaks it.
