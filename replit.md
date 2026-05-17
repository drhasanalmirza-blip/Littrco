# LITTR.co - Vape & Battery Recycling Platform

## Overview
LITTR.co is a production-ready recycling platform for vapes and batteries, targeting upstate New York. It aims to streamline recycling efforts for businesses and individuals through a comprehensive ecosystem. The platform includes a public website for information, portals for staff and partners, a customer-facing mobile app, and an API for smart recycling bins. The project's vision is to expand smart recycling infrastructure with innovative devices like the LITTR One smart bin, which features advanced sensors for environmental monitoring and QR-based reward systems, encouraging widespread adoption and sustainable practices.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend utilizes React 18 with TypeScript, built with Vite. Styling is handled by Tailwind CSS v4, complemented by custom CSS variables for theming. UI components are built using shadcn/ui, which leverages Radix UI primitives for accessibility and robust design. State management uses Zustand for client-side state and TanStack React Query for server-side data, with React Hook Form and Zod for form handling and validation.

### Technical Implementations
The backend is built with Node.js and Express.js, offering RESTful API endpoints. Authentication employs session-based mechanisms for users and SHA-256 hashed keys for devices, with bcrypt for password hashing and role-based access control (STAFF, PARTNER, CUSTOMER). An AI service, using an adapter pattern for providers like OpenAI Vision, classifies dropped items with cost control and deduplication. Realtime capabilities are planned with an adapter pattern for future MQTT integration.

### Classifier Pipeline (Task #5)
- Phase 0 (default): pass-through fallback — every capture is "uncertain @ 0.5", hand-labeled via `/admin/review`. Zero AI cost. App runs without `ANTHROPIC_API_KEY`.
- Phase 1 (opt-in via `CLASSIFIER_PROVIDER=anthropic`): Claude Haiku 4.5 vision with pHash dedupe, prompt caching, and a daily USD budget cap (`CLASSIFIER_DAILY_BUDGET_USD`, default $5). On budget exceed → Phase 0 fallback.
- Hard rule: classifier is only invoked from `processCapture` in `server/classifier/worker.ts`, triggered exclusively by `POST /api/bin-module/drop-capture` for `after`/`crop` image roles. Never on boot, page load, or cron.
- Verdict applied per-bin via `bins.rejectNonVapes` / `rejectThcVapes`; ambiguous results land in `classifier_corrections` after staff review.
- See `docs/CLASSIFIER.md` and `docs/BIN_MODULE_API.md` (Phase 1 section).

### Feature Specifications
- **Smart Bin Features**: LITTR One bins include temperature (DS18B20), VOC (MQ135), and ultrasonic fill sensors. They feature an LED light bar for visual fill indication, a QR reward screen, and WiFi connectivity for real-time monitoring and alerts.
- **Device API (V2)**: Implements UID-based pairing, session stacking for rewards, idempotent drop reporting, and cloud-configurable settings for bins.
- **Drop Pipeline**: Manages the lifecycle of recycling drops, from creation to AI classification and potential customer appeals.
- **VeriScan**: A system for validating items during the recycling process, including photo uploads and AI-assisted classification.
- **Telemetry & Fire Alerts**: Bins report sensor data, automatically triggering fire alerts if temperature thresholds are exceeded, which are visible in staff and partner dashboards.

### System Design Choices
- **Authentication**: Robust session-based and device-key-based authentication with role-based access control.
- **Data Storage**: PostgreSQL database managed with Drizzle ORM, ensuring type-safe schema definitions shared between frontend and backend.
- **Modularity**: A clear project structure separates client, server, and shared logic. Key design patterns include a shared schema, an abstract storage interface, and an API request helper for consistent client-server interaction.

## External Dependencies

- **Database**: PostgreSQL (via `DATABASE_URL`)
- **ORM**: Drizzle ORM, drizzle-kit for migrations
- **Email Service**: Resend (for transactional emails)
- **AI/Vision**: OpenAI Vision (GPT-4o Vision), with a `nullProvider` option
- **Authentication**: bcryptjs, crypto
- **Frontend Libraries**: React 18, Vite, Wouter, Tailwind CSS v4, shadcn/ui, Radix UI, Lucide React, Embla Carousel, date-fns
- **Form & Validation**: Zod, React Hook Form, zod-validation-error
- **Build Tools**: esbuild, tsx