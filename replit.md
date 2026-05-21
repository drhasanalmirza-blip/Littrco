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

## External Dependencies
- **Database**: PostgreSQL (`DATABASE_URL`)
- **ORM**: Drizzle ORM, drizzle-kit
- **Email**: Resend (transactional notifications for contacts/leads/volunteers)
- **Auth**: bcryptjs + crypto
- **Frontend**: React 18, Vite, Wouter, Tailwind v4, shadcn/ui, Radix, Lucide, TanStack Query, Zustand

## Removed in the rebuild
The old AI classifier, VeriScan, drop-event verdict pipeline, brands/subtypes/flavors taxonomy, MQTT realtime, partner-points-ledger v1, pair requests, bin modules / module tokens, and the v2 device API have all been deleted. The corresponding tables were dropped and never migrated — the bin system is a true blank slate.
