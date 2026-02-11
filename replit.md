# LITTR.co - Vape & Battery Recycling Platform

## Overview

LITTR.co is a production-ready vape and battery recycling platform for upstate New York (Buffalo, Rochester, Syracuse). The platform features:

- **Public Website**: Information about recycling services, drop-off locations, business bin programs, LITTR One smart bin showcase
- **Staff Portal**: Lead management, shop/device administration, redemption fulfillment
- **Partner Portal**: Shop analytics, reward configuration, pickup requests
- **Customer App**: Points wallet, rewards store, transaction history
- **ESP32 Device API**: Smart bin integration with QR-based rewards

## LITTR One Smart Bin Product Line

### Available Products
- **LITTR One** ($169.95, subsidized from $459.95): Standard smart bin with all sensors - NOW AVAILABLE
- **LITTR One Pro** (TBA): Enhanced capacity + premium display - COMING SOON
- **LITTR One Mini** (TBA): Compact design for smaller spaces - COMING SOON

### Smart Bin Features
- **Temperature Sensor**: DS18B20 for fire detection (alerts at 60°C, critical at 80°C)
- **VOC Sensor**: MQ135 for air quality monitoring
- **Ultrasonic Fill Sensor**: Measures fill level (0-100%)
- **LED Light Bar**: Visual fill indicator ring
- **QR Reward Screen**: Instant points for recycling
- **WiFi Connected**: Real-time monitoring and alerts
- **Location Security**: Sensors provide environmental monitoring as extra security layer

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Authentication & Authorization
- **Session-based auth**: X-Session-Id header, 7-day session duration
- **Password hashing**: bcrypt with salt rounds
- **Role-based access**: STAFF, PARTNER, CUSTOMER roles
- **Device auth**: SHA-256 hashed device keys via X-Device-Id and X-Device-Key headers

### Frontend Architecture
- **Framework**: React 18 with TypeScript, using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **Styling**: Tailwind CSS v4 with custom CSS variables for theming
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **State Management**: Zustand with persistence for auth state, TanStack React Query for server state
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **API Design**: RESTful endpoints under `/api/*` prefix
- **Auth Middleware**: Session validation and role-based authorization
- **Email**: Resend for transactional emails (notifications@littr.co)
- **Development**: Vite dev server with HMR proxied through Express
- **Production**: Static file serving from built client assets

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Tables**: users, sessions, leads, contacts, volunteers, shops, shopMembers, devices, rewardConfigs, dropEvents, claimTokens, customers, wallets, transactions, storeItems, redemptions, pickupRequests
- **Validation**: Drizzle-Zod for automatic schema-to-validation conversion

### Project Structure
```
├── client/                  # Frontend React application
│   ├── src/
│   │   ├── components/      # UI components (shadcn/ui + custom)
│   │   │   ├── auth/        # Login component
│   │   │   ├── layout/      # Header, Footer
│   │   │   └── ui/          # shadcn/ui components
│   │   ├── pages/           # Route page components
│   │   │   ├── staff/       # Staff dashboard
│   │   │   ├── partner/     # Partner dashboard
│   │   │   ├── customer/    # Customer app (wallet, claim)
│   │   │   └── admin/       # (Redirects to staff)
│   │   ├── hooks/           # Custom React hooks
│   │   └── lib/             # Utilities, query client, store
├── server/                  # Backend Express application
│   ├── routes.ts            # API route definitions
│   ├── storage.ts           # Database access layer
│   ├── auth.ts              # Authentication utilities
│   ├── email.ts             # Email service (Resend)
│   └── db.ts                # Database connection
├── shared/                  # Shared code between client/server
│   └── schema.ts            # Drizzle schema definitions
├── scripts/                 # Utility scripts
│   └── seed.ts              # Database seeding
├── docs/                    # Documentation
│   └── device.md            # ESP32 API documentation
└── migrations/              # Database migrations
```

## API Routes

### Authentication
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/register` - Register new customer
- `POST /api/auth/logout` - End session
- `GET /api/auth/me` - Get current user

### Staff Portal (requires STAFF role)
- `GET /api/staff/leads` - List all leads
- `PATCH /api/staff/leads/:id` - Update lead status
- `GET /api/staff/shops` - List all shops
- `POST /api/staff/shops` - Create shop
- `PATCH /api/staff/shops/:id/status` - Update shop status
- `POST /api/staff/shops/:shopId/members` - Add shop member
- `GET /api/staff/devices` - List all devices
- `POST /api/staff/devices` - Create device (returns one-time key)
- `GET /api/staff/drop-events` - List all drop events
- `GET /api/staff/store-items` - List store items
- `POST /api/staff/store-items` - Create store item
- `GET /api/staff/redemptions` - List redemptions
- `PATCH /api/staff/redemptions/:id` - Update redemption status
- `GET /api/staff/users` - List all users (excludes password hashes)
- `POST /api/staff/users` - Create new user account (email, password, role)
- `PATCH /api/staff/users/:id/role` - Update user role
- `PATCH /api/staff/users/:id/password` - Reset user password
- `DELETE /api/staff/users/:id` - Remove user (cannot delete self)
- `GET /api/staff/users/:id/shops` - Get shops assigned to a user
- `POST /api/staff/users/:id/shops` - Assign a shop to a user
- `DELETE /api/staff/users/:id/shops/:shopId` - Remove shop assignment from user

### Partner Portal (requires PARTNER role)
- `GET /api/partner/shops` - List partner's shops
- `GET /api/partner/shops/:shopId` - Get shop details
- `GET /api/partner/shops/:shopId/stats` - Get shop analytics
- `GET /api/partner/shops/:shopId/drop-events` - Get shop drop events
- `GET /api/partner/shops/:shopId/reward-config` - Get reward config
- `PATCH /api/partner/shops/:shopId/reward-config` - Update reward config
- `POST /api/partner/shops/:shopId/pickup-request` - Request pickup

### Customer Portal (requires CUSTOMER role)
- `GET /api/customer/wallet` - Get wallet balance
- `GET /api/customer/transactions` - Get transaction history
- `GET /api/customer/store` - List available rewards
- `POST /api/customer/redeem` - Redeem a reward
- `GET /api/customer/redemptions` - Get redemption history

### Claim Flow
- `POST /api/claim` - Claim points from QR code (token, optional email/password)

### Device API (ESP32) - Legacy
- `POST /api/device/spin` - Trigger reward spin (returns points + QR URL)
- `GET /api/device/status` - Get device status and config
- `POST /api/device/telemetry` - Report sensor data (temperature, VOC, fill level)
- `GET /api/device/telemetry/history` - Get historical sensor readings

### Device API V1 (LITTR Screen Pro) - Legacy
- `POST /api/v1/device/pair` - Pair device using shop PIN (returns deviceId, deviceKey)
- `POST /api/v1/device/spin` - Trigger spin with new weighted distribution
- `POST /api/v1/claim` - Claim points (supports auto-registration)

### Device API V2 (UID-based pairing + session stacking)
- `POST /api/v2/device/pair-request` - ESP32 sends UID, gets 6-char pair code (15min expiry)
- `GET /api/v2/device/pair-status?uid=X` - ESP32 polls to check if paired, gets config
- `POST /api/v2/device/pair-claim` - Staff/partner claims device to shop via pair code (auth required)
- `GET /api/v2/device/config?uid=X` - ESP32 fetches cloud config (session window, thresholds)
- `POST /api/v2/device/drop` - ESP32 reports drop, creates/extends reward session (idempotent via event_id)
- `POST /api/v2/claim` - User claims stacked session points (auto-register supported)
- `POST /api/v2/device/telemetry` - ESP32 reports sensor data (temperature, VOC, fill)
- `GET /api/v2/shop/:shopId/device-config` - Get shop device config (staff/partner)
- `PATCH /api/v2/shop/:shopId/device-config` - Update shop device config (staff/partner)
- `GET /api/v2/shop/:shopId/points-ledger` - Get partner points ledger (staff/partner)
- `GET /api/v2/staff/pair-requests` - List all pair requests (staff only)

V2 Design Principles:
- **UID-based auth**: Devices identify by hardware UID, no key exchange needed for drops
- **Session stacking**: Multiple drops within configurable window combine into one QR code
- **Idempotency**: `event_id` on drops prevents duplicate processing on network retry
- **Partner points**: Shop gets +1 per drop immediately, tracked in ledger
- **Cloud config**: Session window, sensor thresholds, display settings per shop

### Telemetry & Fire Alerts
The telemetry endpoint accepts sensor data from ESP32 bins:
- **DS18B20**: Temperature sensor (triggers fire alert at ≥60°C, critical at ≥80°C)
- **MQ135**: VOC sensor with analog (0-4095 ADC) and digital outputs
- **Fill Level**: Ultrasonic-based percentage (0-100%)

Fire alerts are auto-created when thresholds are exceeded and displayed in staff/partner dashboards.

Point Distribution (V1):
- 1 point: 70%
- 2 points: 15%
- 5 points: 10%
- 10 points: 4%
- 25 points: 0.9%
- 100 points: 0.1%

### Staff Shop PIN Management
- `PATCH /api/staff/shops/:id/pin` - Set 6-digit PIN for device pairing

## Test Credentials

```
Staff: admin@littr.co / admin123
Partner: partner@elite.com / partner123

ESP32 Device:
X-Device-Id: 1
X-Device-Key: demo-device-key-12345
```

## Key Design Patterns
- **Shared Schema**: Database types and validation schemas shared between frontend and backend
- **Storage Interface**: Abstract IStorage interface for database operations
- **Auth Middleware**: Session validation with role-based access control
- **apiRequest Helper**: Frontend utility that includes session headers automatically
- **Path Aliases**: `@/` for client source, `@shared/` for shared modules, `@assets/` for attached assets

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database queries and migrations
- **drizzle-kit**: Database migration tooling (`npm run db:push`)

### Authentication
- **bcryptjs**: Password hashing
- **crypto**: Session ID and device key generation

### Email
- **Resend**: Transactional email service (RESEND_API_KEY required)

### UI/Frontend Libraries
- **Radix UI**: Accessible component primitives
- **Lucide React**: Icon library
- **Embla Carousel**: Carousel functionality
- **date-fns**: Date formatting utilities

### Build & Development
- **Vite**: Frontend build tool with React plugin
- **esbuild**: Server bundling for production
- **tsx**: TypeScript execution for development

### Form & Validation
- **Zod**: Schema validation
- **React Hook Form**: Form state management
- **zod-validation-error**: Human-readable validation errors
