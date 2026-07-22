# LITTR.co — Vape & Battery Recycling Platform

## Overview
LITTR.co is a recycling platform for vapes and batteries, targeting upstate New York. The system has been rebuilt around a single, simple workflow:

- A partner clicks **Add Bin**, pairs the bin over Web Bluetooth, and the bin goes live within seconds.
- The bin (ESP32) only ever pushes telemetry/drops/photos and polls for commands — there is no MQTT, no real-time push.
- A customer's visit groups multiple vape drops into a **drop session**; the bin's screen counts down and displays a single QR claim receipt.
- Customers earn **Batteries**; shops earn **Points**. Two separate ledgers, two separate stores.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
React 18 + TypeScript + Vite. Tailwind v4, shadcn/ui (Radix), Wouter for routing, TanStack Query for server state, Zustand for client state, React Hook Form + Zod for forms.

### Backend
Node.js + Express. Session-based auth for users; SHA-256 hashed `X-Device-Key` for bins. Drizzle ORM over PostgreSQL.

### Bin pairing (BLE-only)
1. Partner dashboard → **Add Bin** dialog → `POST /api/partner/bins/pair-init` returns `{ deviceKey, nonce, serial }`.
2. Browser (Web Bluetooth) writes those three fields to the bin's pairing characteristic.
3. Bin connects to WiFi and calls `POST /api/device/claim { nonce, serial }` — server flips the device to `LIVE`.
4. From then on the bin uses `X-Device-Key` to authenticate every request.

There is no pair-request approval step, no PENDING_SETUP, no admin claim, no module token, no separate camera-app API. Browsers without Web Bluetooth (Firefox, iOS Safari) see a friendly fallback instead of a fake flow.

### Device API surface (`/api/device/*`)
`claim`, `telemetry`, `settings`, `commands`, `commands/ack`, `drop-sessions/start`, `drops`, `drops/:id/photos`, `photos`, `drop-sessions/:id/finalize`. See `docs/DEVICE_API.md`.

### Drop sessions & dual-currency rewards
- `drop_sessions` groups all drops from one visit.
- `finalize` awards shop **Points** immediately and issues a customer **claimToken**.
- The customer claim (`POST /api/customer/claim/:token`) inserts the EARNED row in `battery_transactions`. A `UNIQUE` constraint on `(sessionId)` makes double-claims impossible.
- Balances are derived (`SUM(EARNED) - SUM(REDEEMED)` where `status = POSTED`).
- See `docs/REWARD_ECONOMY.md`.

### Dashboards
- **Partner**: Bins (fill %, vapes-since-empty, Mark Empty), Activity (recent sessions), Point Shop (catalog + redeem), Settings (per-device JSON editor that bumps the settings version).
- **Staff**: Devices (raw telemetry — fill, temp, VOC, RSSI, SD free, firmware, errors), Command Queue (per-device PENDING/ACKED), Shops, Users (role assignment + member assignment), Leads.
- **Customer (`/app`)**: Wallet (battery balance + transactions), Store (redeem batteries), public Claim landing at `/claim/:token`.

## Storage
PostgreSQL via `DATABASE_URL`. Photos saved to local disk under `uploads/photos/{deviceId}/` and served at `/uploads/...`.

## Key tables
`users`, `sessions`, `shops`, `shop_members`, `leads`, `contacts`, `volunteers`, `pickup_requests`, `customers`, `wallets`, `transactions`, `store_items`, `redemptions`, `reward_configs`, `devices`, `pairing_nonces`, `device_settings`, `device_commands`, `drop_sessions`, `drops`, `photos`, `battery_transactions`, `shop_point_transactions`, `shop_rewards`, `shop_reward_redemptions`.

## Phase 1 additions

Server-side Phase 1 work (design spec: `docs/API_DESIGN.md`; full endpoint reference:
`docs/CLOUD_API.md`). Everything below is additive — existing behavior is unchanged.

### New tables
`alerts`, `notification_prefs`, `partner_invites`, `self_reports`, `firmware_releases`,
`pairing_codes`. Plus new enums `drop_review_status`, `alert_severity`, a `VIEWER`
`shop_member_role`, and a `live` `photo_reason`. New `devices` columns:
`pointsPerVapeOverride`, `lastDistanceMm`, `targetFirmwareVersion`, `offlineNotifiedAt`,
`alertStateJson`. New `drops` columns: `reviewStatus`, `reviewedByUserId`, `reviewedAt`,
`reviewNote`, `pointsRevoked`.

### New route modules (mounted from `server/routes.ts`)
- `server/routes/review.ts` — staff drop review queue, approve/reject (revocation), staff
  sessions listing, JSONL training export.
- `server/routes/alerts.ts` — staff + partner alert history + per-scope notification prefs.
- `server/routes/team.ts` — partner team invites/members (OWNER-gated) + `POST
  /api/invites/accept`; exports `partnerRoleForShop` for VIEWER enforcement.
- `server/routes/selfreport.ts` — `POST /api/customer/self-report`.
- `server/routes/devops.ts` — live camera (snapshot/photos), firmware releases + OTA
  (`GET /api/device/firmware`), points-modifier, fill calibration, and the QR/SoftAP
  pairing exchange (`POST /api/device/claim-by-code`).

### Notify engine & pure helpers
- `server/notify.ts` — the alert & notification engine (I/O side): creates `alerts` rows,
  gathers recipients (all STAFF global-scope prefs + shop members' shop-scope prefs),
  dispatches via a provider interface (email wired to Resend; sms/call/push are logged
  stubs), and runs `startOfflineSweep()` (5-min interval, kicked off from
  `server/index.ts`). Three triggers: telemetry ingest, device events, offline sweep.
- `server/notifyRules.ts` — **pure** decision logic (fill hysteresis, prefs merge,
  recipient filtering, fire-action classification, default messages). No db import.
- `server/reviewRules.ts` — **pure** revocation math (`planReject`/`planApprove`).
- `server/claims.ts` — shared claim helper (`claimSessionForCustomer`) used by both the
  claim route and claim-on-register.
- `server/ratelimit.ts` — in-memory sliding-window limiters (per-device + per-IP).
- `server/paircode.ts` — pair-code generator (32-char alphabet, no look-alikes).
- `shared/deviceSettings.ts` — structured device-settings zod schema + defaults + merge.

The three pure `*Rules`/`paircode`/`deviceSettings` modules avoid importing `server/db.ts`
(which throws without `DATABASE_URL`), so the vitest suite in `server/__tests__/` covers
them without a database.

## External Dependencies
- **Database**: PostgreSQL (`DATABASE_URL`)
- **ORM**: Drizzle ORM, drizzle-kit
- **Email**: Resend (transactional notifications for contacts/leads/volunteers)
- **Auth**: bcryptjs + crypto
- **Frontend**: React 18, Vite, Wouter, Tailwind v4, shadcn/ui, Radix, Lucide, TanStack Query, Zustand

## Removed in the rebuild
The old AI classifier, VeriScan, drop-event verdict pipeline, brands/subtypes/flavors taxonomy, MQTT realtime, partner-points-ledger v1, pair requests, bin modules / module tokens, and the v2 device API have all been deleted. The corresponding tables were dropped and never migrated — the bin system is a true blank slate.
