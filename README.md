# LITTR.co — Vape & Battery Recycling Platform

LITTR.co is a recycling platform for vapes and batteries, targeting upstate New York. The system is built around a single, simple workflow:

- A partner clicks **Add Bin**, pairs the bin over Web Bluetooth, and the bin goes live within seconds.
- The bin (ESP32) only pushes telemetry/drops/photos and polls for commands — there is no MQTT, no real-time push.
- A customer's visit groups multiple vape drops into a **drop session**; when the bin's countdown ends, a QR shows a single claim receipt.
- Customers earn **Batteries**; shops earn **Points**. Two separate ledgers, two separate stores.

## Quick Start
```bash
npm install
npm run db:migrate   # apply the committed migrations to DATABASE_URL
npm run dev          # starts Express + Vite on port 5000
```

Schema changes: edit `shared/schema.ts` → `npx drizzle-kit generate` → commit the
new `migrations/*.sql` **and** `migrations/meta/`. Production applies schema only
with `npm run db:migrate`; `npm run db:push` is for throwaway local databases —
it rewrites the live DB in place and can drop tables/columns, and it only prompts
for ones that contain rows. Adopting migrations on a database that `push` created
is the one-time `npm run db:baseline` step. See
[`migrations/README.md`](migrations/README.md).

## Architecture

### Frontend
React 18 + TypeScript + Vite. Tailwind v4, shadcn/ui (Radix), Wouter for routing, TanStack Query for server state, Zustand for client state.

### Backend
Node.js + Express. Session-based auth for users; SHA-256 hashed `X-Device-Key` for bins. Drizzle ORM over PostgreSQL.

### Bin pairing (BLE-only)
1. Partner dashboard → **Add Bin** dialog → `POST /api/partner/bins/pair-init` returns `{ deviceKey, nonce, serial }`.
2. Browser (Web Bluetooth) writes those three fields to the bin's pairing characteristic.
3. Bin connects to WiFi and calls `POST /api/device/claim { nonce, serial }` — server flips the device to `LIVE`.
4. From then on the bin uses `X-Device-Key` to authenticate every request.

Browsers without Web Bluetooth (Firefox, iOS Safari) get a friendly fallback message.

### Device API surface (`/api/device/*`)
`claim`, `telemetry`, `settings`, `commands`, `commands/ack`, `drop-sessions/start`, `drops`, `drops/:id/photos`, `photos`, `drop-sessions/:id/finalize`. See [`docs/DEVICE_API.md`](docs/DEVICE_API.md).

### Drop sessions & dual-currency rewards
- `drop_sessions` groups all drops from one visit.
- `finalize` awards shop **Points** immediately and issues a customer **claimToken**.
- The customer claim (`POST /api/customer/claim/:token`) inserts the EARNED row in `battery_transactions`. A `UNIQUE` constraint on `(sessionId)` makes double-claims impossible.
- Balances are derived (`SUM(EARNED) - SUM(REDEEMED)` where `status = POSTED`).
- See [`docs/REWARD_ECONOMY.md`](docs/REWARD_ECONOMY.md).

### Dashboards
- **Partner** (`/partner/dashboard`): Bins (fill %, vapes-since-empty, Mark Empty), Activity (recent sessions), Point Shop (catalog + redeem), Settings (per-device JSON editor that bumps the settings version).
- **Staff** (`/staff/dashboard`): Devices (raw telemetry — fill, temp, VOC, RSSI, SD free, firmware, errors), Command Queue (per-device PENDING/ACKED), Shops, Users (role assignment + member assignment), Leads.
- **Customer** (`/app`): Wallet (battery balance + transactions), Store (redeem batteries), public Claim landing at `/claim/:token`.

## Storage
PostgreSQL via `DATABASE_URL`.

Blobs (device photos, firmware `.bin` / content `.raw` artifacts) go through the
`StorageDriver` seam in `server/blobstore/`. `STORAGE_DRIVER` unset (the default)
selects `LocalDiskDriver`: photos under `uploads/photos/{deviceId}/`, artifacts
content-addressed under `uploads/artifacts/{firmware|content}/{sha256}{.ext}`,
both served at `/uploads/...`. Local disk is per-instance, so a multi-instance
deploy needs a bucket driver — the contract one must satisfy (including the
device's pinned-CA and no-redirect requirements) is the `TODO(s3)` block in
`server/blobstore/driver.ts`.

## Key tables
`users`, `sessions`, `shops`, `shop_members`, `leads`, `contacts`, `volunteers`, `pickup_requests`, `customers`, `wallets`, `transactions`, `store_items`, `redemptions`, `reward_configs`, `devices`, `pairing_nonces`, `device_settings`, `device_commands`, `drop_sessions`, `drops`, `photos`, `battery_transactions`, `shop_point_transactions`, `shop_rewards`, `shop_reward_redemptions`.

## Environment
- `DATABASE_URL` — PostgreSQL connection string
- `RESEND_API_KEY` — transactional email
- `VITE_MAPBOX_TOKEN` — shop map on dropoff page

## Removed in the rebuild
The old AI classifier, VeriScan, drop-event verdict pipeline, brands/subtypes/flavors taxonomy, MQTT realtime, partner-points-ledger v1, pair requests, bin modules / module tokens, and the v2 device API have all been deleted. The corresponding tables were dropped and never migrated — the bin system is a true blank slate.
