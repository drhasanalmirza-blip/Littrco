# LITTR System Specification

## Architecture Overview

LITTR is a full-stack vape and battery recycling platform consisting of:

1. **Web Application** — React frontend + Express backend
2. **Smart Bins** — ESP32-based hardware with sensors and QR displays
3. **Camera Modules** — ESP32-S3-CAM or Android (Pixel 3a) units for item classification
4. **AI Classification Service** — OpenAI Vision for automated vape identification
5. **VeriScan** — QR-based pre-identification system for 2x bonus points

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│  LITTR Web  │     │  LITTR App  │     │  VeriScan    │
│  (React)    │     │  (Mobile)   │     │  (QR Page)   │
└──────┬──────┘     └──────┬──────┘     └──────┬───────┘
       │                   │                    │
       └───────────┬───────┴────────────────────┘
                   │
            ┌──────▼──────┐
            │   Express   │
            │   Backend   │
            └──────┬──────┘
                   │
      ┌────────────┼────────────┐
      │            │            │
┌─────▼────┐ ┌────▼─────┐ ┌───▼────────┐
│PostgreSQL │ │ OpenAI   │ │  Realtime  │
│  (Drizzle)│ │ Vision   │ │  Adapter   │
└──────────┘ └──────────┘ └────────────┘
                                │
                         ┌──────▼──────┐
                         │  Smart Bins │
                         │  (ESP32)    │
                         └─────────────┘
```

## User Roles

| Role | Description | Capabilities |
|------|-------------|-------------|
| **GUEST** | Unauthenticated visitor | Browse shops, view brand catalog, register |
| **CUSTOMER** | Registered recycler | Claim points, view wallet, appeal drops, VeriScan, redeem rewards |
| **PARTNER** | Shop owner/manager | View shop analytics, manage bins, configure rewards, request pickups |
| **STAFF** | LITTR administrator | Full system access, drop review, taxonomy management, user admin |

## Drop Pipeline

The drop pipeline tracks a vape item from physical deposit to point award.

### Flow

```
1. Item deposited in bin
   └→ ESP32 detects item via sensor
      └→ POST /api/v2/device/drop (creates DropEvent + RewardSession)
         └→ QR code displayed on bin screen

2. Camera module captures images (if equipped)
   └→ POST /api/bin-module/drop-capture (stores images, does NOT trigger AI)

3. Drop submitted for AI classification
   └→ POST /api/drops/:dropId/submit
      └→ AI job created (status: queued → running → done/failed)
         └→ Drop classified: Nicotine|THC|Trash|Unknown
            └→ Status set: approved (Nicotine) or denied (THC/Trash/Unknown)

4. Customer scans QR code
   └→ POST /api/v2/claim (claims stacked session points)
      └→ Points added to wallet

5. If denied, customer can appeal
   └→ POST /api/drops/:dropId/appeal
      └→ Staff reviews and resolves
```

### Drop Statuses

| Status | Description |
|--------|-------------|
| `awaiting_ai` | Drop submitted, waiting for AI classification |
| `approved` | AI classified as Nicotine, points awarded |
| `denied` | AI classified as THC/Trash/Unknown, no points |
| `appealed` | Customer submitted appeal on denied drop |
| `corrected` | Staff manually corrected classification |

### Drop Categories

| Category | Description | Points |
|----------|-------------|--------|
| `Nicotine` | Disposable vapes, e-cigarettes, nicotine pods | Awarded |
| `THC` | Cannabis vape cartridges or disposables | Denied |
| `Trash` | Non-vape items | Denied |
| `Unknown` | Cannot determine from image | Denied (default) |

## AI Classification

### Provider Pattern

The AI service uses a provider pattern with two implementations:

- **`nullProvider`**: Always returns `{ category: "Unknown", confidence: 0 }`. Used when no API key is configured. Safe default that requires no external services.
- **`openaiVisionProvider`**: Calls OpenAI Vision (GPT-4o) with the item image. Returns structured classification JSON with category, brand, subtype, flavor, and confidence score.

### Cost Controls

1. AI is **only** called from the drop submit path (`POST /api/drops/:dropId/submit`)
2. AI is **never** triggered on deploy, page load, cron, or automatic processes
3. Hash-based deduplication prevents re-classifying the same image
4. Configurable confidence threshold (default 0.3) — below threshold returns "Unknown"

### Classification Flow

```
Image submitted → Check hash cache → (cached? return cached result)
                                    → (new? call provider)
                                       → Parse response
                                       → Apply confidence threshold
                                       → Return result
```

## VeriScan System

VeriScan allows customers to pre-identify items before depositing them, earning a 2x point multiplier.

### Flow

```
1. Customer scans QR code on bin
   └→ Lands on /veriscan?binId=X&shopId=Y

2. Start VeriScan session
   └→ POST /api/veriscan/session/start

3. For each item:
   a. Take photo with phone camera
   b. Submit for AI autofill
      └→ POST /api/veriscan/session/:id/items
   c. Review/edit brand classification
   d. Confirm
      └→ POST /api/veriscan/session/:id/items/:itemId/confirm

4. Arm the bin
   └→ POST /api/veriscan/session/:id/arm
   └→ Server sends arm command via realtime adapter (no-op in Phase 1)
   └→ Countdown begins (default 60 seconds)

5. Customer deposits items in bin
   └→ Drops matched to VeriScan items → 2x modifier applied
```

### VeriScan Statuses

| Status | Description |
|--------|-------------|
| `active` | Session in progress, items being added |
| `armed` | Bin armed for deposit, countdown running |
| `completed` | All items deposited and matched |
| `expired` | Session timed out |
| `cancelled` | Session cancelled by user |

## Bin Camera Modules

Smart bins can be equipped with camera modules for automated image capture.

### Module Types

| Type | Hardware | Description |
|------|----------|-------------|
| `none` | No camera | Default, no image capture |
| `s3cam` | ESP32-S3-CAM | Low-cost integrated camera module |
| `android_cam` | Android phone (Pixel 3a) | Higher quality camera via phone |

### Upload Policies

| Policy | Behavior |
|--------|----------|
| `drop_only` | Only upload images during drop events |
| `drop_plus_baseline` | Upload drop images + periodic baselines for diff computation |
| `debug_all` | Upload all frames (for development/debugging) |

### Capture Cadence

Camera modules operate with configurable timing:

```json
{
  "idleIntervalSec": 60,
  "burstIntervalSec": 1,
  "burstDurationSec": 15,
  "cooldownIntervalSec": 5,
  "cooldownDurationSec": 60
}
```

- **Idle**: Low-frequency baseline captures
- **Burst**: High-frequency captures during drop detection
- **Cooldown**: Reduced frequency after burst to save resources

## Reward System

### Session Stacking (V2)

Multiple drops within a configurable time window (default 60 seconds) combine into a single reward session:

1. First drop creates new session with random 1-3 points
2. Subsequent drops within window add 1-3 points and extend expiration
3. Single QR code displayed covers all stacked drops
4. Customer scans once to claim total points

### Point Distribution

| Points | Weight | Probability |
|--------|--------|-------------|
| 1 | 70 | ~70% |
| 2 | 15 | ~15% |
| 5 | 10 | ~10% |
| 10 | 4 | ~4% |
| 25 | 0.9 | ~0.9% |
| 100 | 0.1 | ~0.1% |

### Partner Points

Shops earn +1 point per accepted drop, tracked in a separate partner points ledger. Partner points can be redeemed in the partner store.

## Realtime Adapter

The `RealtimeAdapter` interface provides an abstraction for real-time communication with bins.

### Interface

```typescript
interface RealtimeAdapter {
  sendArmVeriScan(binId, sessionId, expiresAt, expectedCount): Promise<void>;
  sendRewardUpdate(binId, dropId, status, points): Promise<void>;
}
```

### Phase 1: No-Op Adapter

In Phase 1, the `NoOpAdapter` logs calls to console and takes no action. This allows the full API to function without MQTT infrastructure.

### Phase 2: MQTT Adapter

Will publish JSON messages to MQTT topics for real-time bin communication.

## Database Tables

### Core Tables
- `users` — User accounts with roles (STAFF, PARTNER, CUSTOMER)
- `sessions` — Auth sessions (7-day expiry)
- `shops` — Partner shop locations
- `shopMembers` — User-to-shop role assignments
- `devices` — ESP32 bin controllers
- `bins` — Smart recycling bins with sensor data

### Reward Tables
- `rewardConfigs` — Per-shop reward settings
- `rewardSessions` — Stacked point sessions
- `dropEvents` — Legacy drop events
- `claimTokens` — QR claim tokens
- `customers` — Customer profiles
- `wallets` — Point balances
- `transactions` — Point history
- `storeItems` — Redeemable rewards
- `redemptions` — Customer redemptions

### Camera/AI Tables
- `binCapabilities` — Camera mode, weight sensor, upload policy per bin
- `drops` — Enhanced drops with AI classification data
- `dropImages` — Images associated with drops (baseline, after, crop, debug)
- `aiJobs` — AI classification job tracking
- `appeals` — Customer appeals and self-reports

### Taxonomy Tables
- `brands` — Vape brand catalog
- `subtypes` — Product lines per brand
- `flavors` — Flavor catalog

### VeriScan Tables
- `veriscanSessions` — Pre-identification sessions
- `veriscanItems` — Individual items in a VeriScan session

## Authentication

### User Authentication
- Session-based via `X-Session-Id` header
- 7-day session expiry
- Password hashing with bcrypt

### Device Authentication
- ESP32 V2: UID-based identification (no key exchange for drops)
- ESP32 Legacy: `X-Device-Id` + `X-Device-Key` headers
- Camera modules: `X-Module-Token` header (issued during registration)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `OPENAI_API_KEY` | No | OpenAI API key for Vision classification |
| `RESEND_API_KEY` | No | Resend API key for transactional emails |
| `AI_CONFIDENCE_THRESHOLD` | No | Minimum confidence for AI results (default: 0.3) |
| `RECAPTCHA_SECRET_KEY` | No | reCAPTCHA v3 secret for form protection |
