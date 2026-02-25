# LITTR Platform Roadmap

## Phase 1 (Complete)

### Database & Schema
- New tables for enhanced drop tracking: `drops`, `dropImages`, `aiJobs`, `appeals`
- AI classification taxonomy: `brands`, `subtypes`, `flavors`
- VeriScan tables: `veriscanSessions`, `veriscanItems`
- Bin camera capabilities: `binCapabilities`
- Seed data for Upstate NY vape brands (Geek Bar, Hyde, VIHO, Lost Mary, Elf Bar, RAZ, etc.)

### API Endpoints
- Drop pipeline: start → images → submit → AI job → status polling
- VeriScan flow: validate QR → start session → add items → confirm → arm bin
- Taxonomy CRUD: brands, subtypes, flavors management
- Bin module API: camera module registration, config, heartbeat, image upload
- Comprehensive LITTR App API: guest, customer, partner, staff endpoints
- Appeals and self-report system

### AI Service
- Provider pattern with `nullProvider` (safe default) and `openaiVisionProvider`
- Hash-based deduplication to avoid redundant API calls
- Configurable confidence threshold
- Cost control: AI only runs on explicit submission, never on deploy/page load/cron

### Realtime Infrastructure
- No-op `RealtimeAdapter` interface for future MQTT integration
- `sendArmVeriScan` and `sendRewardUpdate` method stubs

### Staff UI
- Drop review with status filters, image viewing, manual override
- Taxonomy manager for brands, subtypes, flavors
- Bin capabilities editor

### Customer UI
- Drops history page with appeal and self-report
- VeriScan web page with camera capture and AI autofill

---

## Phase 2 (Planned)

### MQTT Wiring
- Replace `NoOpAdapter` with live MQTT adapter
- Topic structure: `bins/{binId}/events` (bin → server), `bins/{binId}/commands` (server → bin)
- Event types: `drop_detected`, `sensor_reading`, `heartbeat`, `fire_alert`
- Command types: `arm_veriscan`, `reward_update`, `config_update`, `reboot`
- TLS-secured broker connection

### Real AI Provider Integration
- Production OpenAI Vision deployment with rate limiting and cost monitoring
- Batch processing queue for high-volume drops
- Model version tracking and A/B testing
- Confidence calibration based on real-world accuracy data

### VeriScan UI Polish
- Animated countdown timer after arming
- Session history with receipt-style summaries
- Multi-item batch scanning with progress indicators
- Tips overlay with skip/never-show-again preference

### Camera Upload Policies
- Implement `drop_plus_baseline` policy (upload baselines for diff computation)
- Implement `debug_all` policy (upload all frames for debugging)
- Server-side baseline diff computation
- Image compression and bandwidth optimization for ESP32-S3-CAM modules

### LITTR Mobile App (React Native)
- Native camera integration for VeriScan
- Push notifications (points earned, reward ready, appeal resolved)
- Offline mode with sync queue
- Biometric authentication
- Map view with real-time bin availability

### Advanced Analytics
- Partner dashboard with trend charts (drops per day/week/month)
- Top brands and flavors by region
- Bin fill prediction and pickup scheduling optimization
- Customer engagement metrics

### Security Hardening
- Signed QR payloads with HMAC verification
- Module token rotation
- Rate limiting per IP and per user
- Image upload size limits and content validation

---

## Phase 3 (Future)

### Multi-Region Expansion
- Multi-tenant architecture for different cities/regions
- Regional reward configurations
- Partner onboarding automation

### Sustainability Reporting
- Environmental impact dashboards
- Compliance reporting for local regulations
- Carbon offset calculations

### Hardware V2
- LITTR One Pro with enhanced capacity and premium display
- LITTR One Mini for compact spaces
- OTA firmware update system
- Remote diagnostics
