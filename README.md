# LITTR — Smart Recycling Platform

LITTR is a recycling platform for vapes and batteries, built for upstate New York. It connects smart recycling bins, partner shops, staff operations, and customers through a unified system with AI-powered item classification, real-time telemetry, and a rewards program.

## Quick Start

```bash
# Install dependencies
npm install

# Push database schema
npm run db:push

# Seed initial data (brands, subtypes)
npx tsx scripts/seed.ts

# Start development server
npm run dev
```

The app runs at `http://localhost:5000`.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `RESEND_API_KEY` | No | Resend.com API key for transactional emails |
| `OPENAI_API_KEY` | No | OpenAI API key for Vision classification (uses null provider if absent) |
| `VITE_MAPBOX_TOKEN` | No | Mapbox token for shop map display |
| `SESSION_SECRET` | No | Secret for session signing (auto-generated if absent) |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS v4, shadcn/ui |
| Backend | Node.js, Express.js |
| Database | PostgreSQL, Drizzle ORM |
| Auth | Session-based (users), SHA-256 hashed keys (devices), module tokens (cameras) |
| AI | OpenAI Vision (GPT-4o) with null provider fallback |
| State | Zustand (client), TanStack React Query (server) |
| Routing | Wouter (client) |

## Project Structure

```
├── client/src/
│   ├── pages/
│   │   ├── staff/Dashboard.tsx      # Staff admin dashboard
│   │   ├── partner/Dashboard.tsx    # Partner shop dashboard
│   │   ├── customer/Drops.tsx       # Customer drop history
│   │   └── VeriScan.tsx             # VeriScan web page
│   ├── components/                  # Shared UI components
│   └── lib/store.ts                 # Zustand store + API helper
├── server/
│   ├── index.ts                     # Express server entry
│   ├── routes.ts                    # All API routes
│   ├── storage.ts                   # Database storage layer (IStorage)
│   ├── ai.ts                        # AI classification providers
│   └── realtime.ts                  # Realtime adapter (no-op Phase 1)
├── shared/
│   └── schema.ts                    # Drizzle schema + Zod types
├── scripts/
│   └── seed.ts                      # Database seeder
└── docs/                            # Detailed documentation
```

## User Roles

| Role | Description | Auth Method |
|------|-------------|-------------|
| **STAFF** | Platform administrators | Session + email/password |
| **PARTNER** | Shop owners/managers | Session + email/password |
| **CUSTOMER** | End users who recycle | Session + email/password |
| **Device** | LITTR smart bins | SHA-256 hashed API key |
| **Camera Module** | Bin camera units | Module token (`X-Module-Token`) |

---

# API Reference

All API endpoints are organized by audience. Authenticated endpoints require the session cookie (web) or `X-Session-Id` header (mobile). All responses return JSON.

## Authentication

### POST /api/auth/login
Login with email and password.

```json
// Request
{ "email": "user@example.com", "password": "password123" }

// Response
{ "user": { "id": 1, "email": "...", "role": "STAFF" }, "sessionId": "uuid" }
```

### POST /api/auth/register
Register a new customer account.

```json
// Request
{ "email": "user@example.com", "password": "password123" }

// Response
{ "user": { "id": 1, "email": "...", "role": "CUSTOMER" }, "sessionId": "uuid" }
```

### POST /api/auth/logout
End the current session. Requires auth.

### GET /api/auth/me
Get current user profile. Requires auth.

### POST /api/auth/change-password
Change password. Requires auth.

```json
{ "currentPassword": "old", "newPassword": "new" }
```

### PATCH /api/auth/theme
Update UI theme preference. Requires auth.

```json
{ "theme": "dark" }
```

---

## Public Endpoints

### POST /api/contact
Submit a contact form inquiry.

```json
{ "name": "Jane", "email": "jane@example.com", "message": "Interested in bins" }
```

### POST /api/lead
Submit a business lead for LITTR partnership.

```json
{ "businessName": "Vape Shop", "email": "owner@shop.com", "phone": "555-1234", "address": "123 Main St" }
```

### POST /api/bin-request
Request a recycling bin for a location.

```json
{ "businessName": "...", "email": "...", "address": "...", "reason": "..." }
```

### POST /api/volunteer
Sign up as a volunteer.

```json
{ "name": "...", "email": "...", "phone": "..." }
```

---

## Customer Endpoints

All require `CUSTOMER` auth.

### GET /api/customer/wallet
Returns wallet balance and points summary.

### GET /api/customer/transactions
Returns paginated transaction history.

Query params: `?page=1&limit=20`

### GET /api/customer/store
List available reward items for redemption.

### POST /api/customer/redeem
Redeem a reward from the store.

```json
{ "itemId": 1, "quantity": 1 }
```

### GET /api/customer/redemptions
List user's redemption history.

### POST /api/customer/survey
Submit a recycling behavior survey.

### GET /api/customer/survey/status
Check if user has completed the survey.

---

## Claim & Reward Flow

### POST /api/claim
Claim points from a QR code token. Supports both authenticated and guest (auto-register) flows.

```json
{ "token": "qr-token-string" }
```

---

## Device API (V1)

Endpoints for the main ESP32 bin controller. Authenticated via `X-Device-Key` header.

### POST /api/v1/device/pair
Pair a new device with a shop.

```json
{ "pairCode": "ABC123" }
```

### POST /api/v1/device/spin
Report a recycling event (drop) and get a reward spin result.

```json
{ "deviceKey": "sha256-key", "binId": 1 }
```

### POST /api/v1/bin/telemetry
Report sensor telemetry data.

```json
{
  "deviceKey": "sha256-key",
  "temperature": 23.5,
  "vocLevel": 120,
  "fillPercent": 45,
  "humidity": 55
}
```

### GET /api/v1/bin/config
Fetch current bin configuration (session window, reward settings, thresholds).

Query params: `?deviceKey=sha256-key`

### POST /api/v1/claim
Alternative claim endpoint for V1 devices.

---

## Device API (V2)

Enhanced device endpoints with session stacking and UID pairing.

### POST /api/device/spin
Report a drop event with V2 session stacking support.

### GET /api/device/status
Get device and bin status.

### POST /api/device/telemetry
Report telemetry with fire alert auto-detection.

### GET /api/device/telemetry/history
Query historical telemetry data.

---

## Drop Pipeline

Endpoints for the full drop lifecycle with AI classification.

### POST /api/drops/start
Create a new drop record.

```json
{ "binId": 1, "shopId": 1 }
```

Response: `{ "dropId": 123 }`

### POST /api/drops/:dropId/weight
Attach a weight measurement to the drop.

```json
{ "weightGrams": 45.2 }
```

### POST /api/drops/:dropId/images
Upload an image for the drop (does NOT trigger AI).

```json
{ "imageRole": "after", "storageUrl": "https://...", "hash": "sha256..." }
```

Image roles: `baseline` (never triggers AI), `after`, `crop`, `debug`

### POST /api/drops/:dropId/submit
Submit the drop for AI classification. Only triggers AI if a `crop` or `after` image exists.

### GET /api/drops/:dropId
Poll drop status and classification result.

```json
{
  "id": 123,
  "status": "approved",
  "category": "Nicotine",
  "brand": "Geek Bar",
  "subtype": "Pulse X",
  "flavor": "Watermelon Ice",
  "aiConfidence": 0.92,
  "pointsAwarded": 10
}
```

### POST /api/drops/:dropId/appeal
Submit a customer appeal on a denied drop. Requires auth.

```json
{ "type": "appeal", "payload": { "reason": "This was a vape, not trash" } }
```

### POST /api/drops/:dropId/self-report
Self-report brand/subtype/flavor for bonus points. Requires auth.

```json
{ "type": "self_report", "payload": { "brand": "Geek Bar", "subtype": "Pulse X", "flavor": "Blue Razz" } }
```

---

## VeriScan

VeriScan lets customers pre-scan items before dropping them in a bin. Pre-scanned items get a 2x point modifier. The QR code on the bin contains a signed payload.

### GET /api/veriscan
Validate a signed QR payload.

Query params: `?binId=1&shopId=1&nonce=abc&exp=1700000000&sig=hmac-hex`

### POST /api/veriscan/session/start
Start a VeriScan session.

```json
{ "shopId": 1, "binId": 1 }
```

### POST /api/veriscan/session/:id/items
Add an item to the session with a photo. Returns AI autofill (or placeholder).

```json
{ "imageUrl": "https://...", "hash": "sha256..." }
```

### POST /api/veriscan/session/:id/items/:itemId/confirm
Confirm the AI classification (or edit it). Locks in the 2x modifier.

```json
{ "brand": "Elf Bar", "subtype": null, "flavor": "Strawberry" }
```

### POST /api/veriscan/session/:id/arm
Arm the bin for deposit. Sets a 60-second window.

```json
{ "expectedItemCount": 3 }
```

---

## Bin Camera Module API

Endpoints for ESP32-S3-CAM and Android camera units mounted inside bins. Authenticated via `X-Module-Token` header.

> Full integration guide: [docs/BIN_MODULE_API.md](docs/BIN_MODULE_API.md)

### POST /api/bin-module/register
Register a camera module with the server. Returns a module token.

```json
{ "binId": 1, "moduleType": "s3cam", "firmwareVersion": "1.0.0" }
```

Response: `{ "ok": true, "data": { "moduleToken": "64-char-hex" } }`

### GET /api/bin-module/config
Fetch capture cadence and upload policy configuration.

Response includes: `idleIntervalSec`, `burstIntervalSec`, `burstDurationSec`, `cooldownIntervalSec`, `cooldownDurationSec`, `uploadPolicy`, `debugMode`

### POST /api/bin-module/heartbeat
Report alive status and storage stats.

```json
{ "freeBytes": 1048576, "totalFrames": 120, "oldestFrame": "2025-01-01T00:00:00Z" }
```

### POST /api/bin-module/drop-capture
Upload images for a drop event.

```json
{ "dropId": 123, "imageRole": "after", "imageData": "base64...", "hash": "sha256..." }
```

### POST /api/bin-module/baseline
Upload a periodic baseline frame (for visual diff, not AI).

```json
{ "imageData": "base64...", "hash": "sha256..." }
```

### GET /api/bin-module/pending-drops
Poll for drops that need image capture.

---

## LITTR Mobile App API

Unified API for the LITTR mobile app, serving all roles. All endpoints under `/api/app/`.

> Full reference: [docs/LITTR_APP_API.md](docs/LITTR_APP_API.md)

### Guest Endpoints (No Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/app/shops` | List all verified shops with location data |
| GET | `/api/app/shops/:id` | Single shop detail |
| GET | `/api/app/brands` | Brand catalog with subtypes |
| POST | `/api/app/auth/register` | Register new customer |
| POST | `/api/app/auth/login` | Login, returns session token |
| POST | `/api/app/auth/forgot-password` | Request password reset |

### Customer Endpoints (CUSTOMER Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/app/me` | User profile, wallet balance |
| PATCH | `/api/app/me/password` | Change password |
| GET | `/api/app/wallet` | Wallet balance + recent transactions |
| GET | `/api/app/drops` | Drop history (paginated, filterable) |
| GET | `/api/app/drops/:id` | Drop detail with images and classification |
| POST | `/api/app/drops/:id/appeal` | Appeal a denied drop |
| POST | `/api/app/drops/:id/self-report` | Self-report for bonus points |
| GET | `/api/app/store` | Available rewards |
| POST | `/api/app/store/redeem` | Redeem a reward |
| GET | `/api/app/redemptions` | Redemption history |
| POST | `/api/app/claim` | Claim points from QR token |
| POST | `/api/app/scan` | Phone scan: photograph a vape for ID |
| GET | `/api/app/notifications` | User notifications |

### VeriScan Endpoints (Customer Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/app/veriscan/validate` | Validate QR payload |
| POST | `/api/app/veriscan/session/start` | Start VeriScan session |
| POST | `/api/app/veriscan/session/:id/items` | Add item with photo |
| POST | `/api/app/veriscan/session/:id/items/:itemId/confirm` | Confirm classification |
| POST | `/api/app/veriscan/session/:id/arm` | Arm bin for deposit |
| GET | `/api/app/veriscan/sessions` | VeriScan history |

### Partner Endpoints (PARTNER Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/app/partner/shops` | Partner's shops with stats |
| GET | `/api/app/partner/shops/:id` | Shop detail (bins, alerts, drops) |
| GET | `/api/app/partner/shops/:id/stats` | Analytics (drops, points, top brands) |
| GET | `/api/app/partner/shops/:id/drops` | Shop drop history (paginated) |
| GET | `/api/app/partner/shops/:id/bins` | Bins with sensor data and fill levels |
| GET | `/api/app/partner/shops/:id/alerts` | Fire/safety alerts |
| POST | `/api/app/partner/shops/:id/alerts/:alertId/acknowledge` | Acknowledge alert |
| POST | `/api/app/partner/shops/:id/pickup` | Request pickup |
| GET | `/api/app/partner/shops/:id/reward-config` | View reward config |
| PATCH | `/api/app/partner/shops/:id/reward-config` | Update reward config |
| GET | `/api/app/partner/notifications` | Partner notifications |

### Staff Endpoints (STAFF Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/app/staff/dashboard` | Overview stats |
| GET | `/api/app/staff/drops` | All drops with filters |
| GET | `/api/app/staff/drops/:id` | Drop detail with images + AI result |
| PATCH | `/api/app/staff/drops/:id/override` | Override classification |
| GET | `/api/app/staff/appeals` | Pending appeals list |
| PATCH | `/api/app/staff/appeals/:id/resolve` | Resolve appeal |
| GET | `/api/app/staff/flagged-users` | Users with repeat violations |
| GET | `/api/app/staff/bins` | All bins with status and capabilities |
| POST | `/api/app/staff/pair-claim` | Claim a device pair request |

---

## Staff Admin Endpoints

Staff-only endpoints for platform management.

### Shops & Leads

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/staff/leads` | List business leads |
| PATCH | `/api/staff/leads/:id` | Update lead status |
| GET | `/api/staff/shops` | List all shops |
| POST | `/api/staff/shops` | Create a shop |
| PATCH | `/api/staff/shops/:id/status` | Update shop status |
| POST | `/api/staff/shops/:shopId/members` | Add a shop member |
| DELETE | `/api/staff/shops/:id` | Delete a shop |
| PATCH | `/api/staff/shops/:id/pin` | Set shop map coordinates |
| PATCH | `/api/staff/shops/:id/coordinates` | Update shop coordinates |

### Devices & Bins

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/staff/devices` | List all devices |
| POST | `/api/staff/devices` | Create a new device |
| GET | `/api/staff/bins` | List all bins with telemetry |
| POST | `/api/staff/bins` | Create a new bin |
| DELETE | `/api/staff/bins/:id` | Delete a bin |
| PATCH | `/api/bins/:binId/capabilities` | Update bin camera/weight config |
| GET | `/api/v2/staff/pair-requests` | List pending pair requests |

### Fire Alerts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/staff/fire-alerts` | List fire alerts |
| PATCH | `/api/staff/fire-alerts/:id/acknowledge` | Acknowledge an alert |
| PATCH | `/api/staff/fire-alerts/:id/resolve` | Resolve an alert |

### Drop Review & AI

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/staff/drops` | List all drops with classification |
| PATCH | `/api/staff/drops/:id/override` | Manual override classification |
| POST | `/api/staff/drops/:id/rerun-ai` | Re-run AI on a drop |
| GET | `/api/staff/appeals` | List pending appeals |
| PATCH | `/api/staff/appeals/:id/resolve` | Resolve an appeal |

### Taxonomy

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/staff/brands` | List all brands |
| POST | `/api/staff/brands` | Create a brand |
| PATCH | `/api/staff/brands/:id` | Update a brand |
| DELETE | `/api/staff/brands/:id` | Delete a brand |
| GET | `/api/staff/subtypes` | List subtypes (optionally `?brandId=1`) |
| POST | `/api/staff/subtypes` | Create a subtype |
| DELETE | `/api/staff/subtypes/:id` | Delete a subtype |
| GET | `/api/staff/flavors` | List all flavors |
| POST | `/api/staff/flavors` | Create a flavor |
| DELETE | `/api/staff/flavors/:id` | Delete a flavor |

### Store & Redemptions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/staff/store-items` | List store items |
| POST | `/api/staff/store-items` | Create a store item |
| GET | `/api/staff/redemptions` | List customer redemptions |
| PATCH | `/api/staff/redemptions/:id` | Update redemption status |
| GET | `/api/staff/partner-redemptions` | List partner redemptions |
| PATCH | `/api/staff/partner-redemptions/:id` | Update partner redemption |

### Activity & Communications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/staff/activity-log` | Recent activity log |
| GET | `/api/staff/drop-events` | Drop event history |
| GET | `/api/staff/contacts` | Contact form submissions |
| GET | `/api/staff/volunteers` | Volunteer sign-ups |
| GET | `/api/staff/pickup-requests` | Pickup requests from partners |
| POST | `/api/admin/send-email` | Send an email via Resend |

### Inbox

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/staff/mailboxes` | List mailbox configs |
| POST | `/api/staff/mailboxes` | Create a mailbox |
| PATCH | `/api/staff/mailboxes/:id` | Update a mailbox |
| DELETE | `/api/staff/mailboxes/:id` | Delete a mailbox |
| GET | `/api/inbox/mailbox` | Get user's assigned mailbox |
| GET | `/api/inbox/messages` | Inbox messages |
| GET | `/api/inbox/sent` | Sent messages |
| GET | `/api/inbox/messages/:id` | Single message detail |
| POST | `/api/inbox/send` | Send a message |
| PATCH | `/api/inbox/messages/:id/archive` | Archive a message |

---

## Partner Endpoints

Partner-only endpoints for shop management.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/partner/shops` | Partner's shops |
| GET | `/api/partner/shops/:shopId` | Shop detail with bins and alerts |
| GET | `/api/partner/shops/:shopId/reward-config` | Reward configuration |
| PATCH | `/api/partner/shops/:shopId/reward-config` | Update reward config |
| GET | `/api/partner/shops/:shopId/drop-events` | Shop drop events |
| GET | `/api/partner/shops/:shopId/stats` | Shop statistics |
| POST | `/api/partner/shops/:shopId/pickup-request` | Request a pickup |
| GET | `/api/partner/store` | Partner store items |
| POST | `/api/partner/redeem` | Redeem partner points |
| GET | `/api/partner/redemptions` | Partner redemption history |

---

## AI Classification

The AI service uses a provider pattern defined in `server/ai.ts`:

- **nullProvider** (default): Returns `{ category: "Unknown", confidence: 0 }` — no API key needed
- **openaiVisionProvider**: Calls OpenAI Vision (GPT-4o) for real classification

AI is only invoked when a drop is explicitly submitted via `POST /api/drops/:dropId/submit` with a `crop` or `after` image. It never runs on deploy, page load, idle, or cron.

Classification output:
```json
{
  "category": "Nicotine",
  "brand": "Geek Bar",
  "subtype": "Pulse X",
  "flavor": "Watermelon Ice",
  "confidence": 0.92
}
```

Categories: `Nicotine`, `THC`, `Trash`, `Unknown`

---

## Database Schema

The database is managed with Drizzle ORM. Schema is defined in `shared/schema.ts`. Key table groups:

**Core:** `users`, `sessions`, `shops`, `shop_members`, `leads`, `devices`, `contacts`, `volunteers`

**Bins & Telemetry:** `bins` (virtual, managed via devices), `bin_capabilities`, `fire_alerts`, `pickup_requests`

**Rewards:** `reward_configs`, `drop_events`, `claim_tokens`, `customers`, `wallets`, `transactions`, `store_items`, `redemptions`, `reward_sessions`, `partner_points_ledger`, `partner_redemptions`

**Drops & AI:** `drops`, `drop_images`, `ai_jobs`, `appeals`

**Taxonomy:** `brands`, `subtypes`, `flavors`

**VeriScan:** `veriscan_sessions`, `veriscan_items`

**Device Pairing:** `pair_requests`, `device_configs`

**Communication:** `mailboxes` (managed in staff inbox)

Run `npm run db:push` to apply schema changes.

---

## Further Documentation

| Document | Description |
|----------|-------------|
| [docs/SYSTEM_SPEC.md](docs/SYSTEM_SPEC.md) | Full system architecture and design decisions |
| [docs/BIN_MODULE_API.md](docs/BIN_MODULE_API.md) | Integration guide for bin camera modules |
| [docs/LITTR_APP_API.md](docs/LITTR_APP_API.md) | Complete mobile app API reference with examples |
| [docs/MQTT_PROTOCOL.md](docs/MQTT_PROTOCOL.md) | MQTT topics and message schemas (Phase 2) |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phased feature plan |
| [docs/device.md](docs/device.md) | Device hardware integration guide |

---

## License

Proprietary. All rights reserved.
