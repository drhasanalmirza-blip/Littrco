import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  serial,
  timestamp,
  integer,
  boolean,
  jsonb,
  pgEnum,
  unique,
  doublePrecision,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ==================== Enums ====================
export const userRoleEnum = pgEnum("user_role", ["STAFF", "PARTNER", "CUSTOMER"]);
export const shopStatusEnum = pgEnum("shop_status", ["PENDING", "VERIFIED", "SUSPENDED"]);
export const shopMemberRoleEnum = pgEnum("shop_member_role", ["OWNER", "MANAGER", "VIEWER"]);
export const leadStatusEnum = pgEnum("lead_status", ["NEW", "CONTACTED", "CONVERTED", "REJECTED"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["EARN", "REDEEM", "ADJUST"]);
export const redemptionStatusEnum = pgEnum("redemption_status", ["PENDING", "APPROVED", "FULFILLED", "REJECTED"]);

// New device system enums
export const deviceStatusEnum = pgEnum("device_status_v2", ["PROVISIONING", "LIVE", "OFFLINE", "RETIRED"]);
export const dropSessionStatusEnum = pgEnum("drop_session_status", ["OPEN", "FINALIZED", "CLAIMED", "EXPIRED"]);
export const deviceCommandStatusEnum = pgEnum("device_command_status", ["PENDING", "SENT", "ACKED", "FAILED"]);
export const ledgerStatusEnum = pgEnum("ledger_status", ["PENDING", "POSTED", "VOID"]);
export const ledgerTypeEnum = pgEnum("ledger_type", ["EARNED", "REDEEMED", "ADJUST"]);
export const photoReasonEnum = pgEnum("photo_reason", ["idle", "drop_before", "drop_after", "maintenance", "calibration", "live"]);
export const dropReviewStatusEnum = pgEnum("drop_review_status", ["UNREVIEWED", "APPROVED", "REJECTED"]);
export const alertSeverityEnum = pgEnum("alert_severity", ["INFO", "WARNING", "CRITICAL"]);

// ==================== Users / Sessions ====================
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  role: userRoleEnum("role").notNull().default("CUSTOMER"),
  themePreference: text("theme_preference").default("light"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type Session = typeof sessions.$inferSelect;

// ==================== Shops ====================
export const shops = pgTable("shops", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  serviceArea: text("service_area").notNull(),
  phone: text("phone"),
  secretPin: text("secret_pin"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  status: shopStatusEnum("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertShopSchema = createInsertSchema(shops).omit({ id: true, createdAt: true });
export type InsertShop = z.infer<typeof insertShopSchema>;
export type Shop = typeof shops.$inferSelect;

export const shopMembers = pgTable("shop_members", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  shopId: integer("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
  role: shopMemberRoleEnum("role").notNull().default("MANAGER"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueUserShop: unique().on(table.userId, table.shopId),
}));
export const insertShopMemberSchema = createInsertSchema(shopMembers).omit({ id: true, createdAt: true });
export type InsertShopMember = z.infer<typeof insertShopMemberSchema>;
export type ShopMember = typeof shopMembers.$inferSelect;

// ==================== Leads / Contacts / Volunteers / Pickups ====================
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  businessName: text("business_name").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  volume: text("volume"),
  status: leadStatusEnum("status").notNull().default("NEW"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true, createdAt: true, status: true, notes: true,
});
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertContactSchema = createInsertSchema(contacts).omit({ id: true, createdAt: true });
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

export const volunteers = pgTable("volunteers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  interest: text("interest").notNull(),
  availability: text("availability").notNull(),
  notes: text("notes").default("").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertVolunteerSchema = createInsertSchema(volunteers).omit({ id: true, createdAt: true });
export type InsertVolunteer = z.infer<typeof insertVolunteerSchema>;
export type Volunteer = typeof volunteers.$inferSelect;

export const pickupRequests = pgTable("pickup_requests", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").notNull().references(() => shops.id),
  requestedById: varchar("requested_by_id").notNull().references(() => users.id),
  notes: text("notes"),
  status: text("status").notNull().default("PENDING"),
  scheduledAt: timestamp("scheduled_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertPickupRequestSchema = createInsertSchema(pickupRequests).omit({
  id: true, createdAt: true, completedAt: true,
});
export type InsertPickupRequest = z.infer<typeof insertPickupRequestSchema>;
export type PickupRequest = typeof pickupRequests.$inferSelect;

// ==================== Customers / Wallets / Transactions / Store ====================
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  publicId: text("public_id").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

export const wallets = pgTable("wallets", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }).unique(),
  pointsBalance: integer("points_balance").notNull().default(0),
  lifetimeEarned: integer("lifetime_earned").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type Wallet = typeof wallets.$inferSelect;

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  walletId: integer("wallet_id").notNull().references(() => wallets.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  type: transactionTypeEnum("type").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export const storeItems = pgTable("store_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  pointsCost: integer("points_cost").notNull(),
  imageUrl: text("image_url"),
  category: text("category").notNull().default("customer"),
  active: boolean("active").notNull().default(true),
  stock: integer("stock"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertStoreItemSchema = createInsertSchema(storeItems).omit({ id: true, createdAt: true });
export type InsertStoreItem = z.infer<typeof insertStoreItemSchema>;
export type StoreItem = typeof storeItems.$inferSelect;

export const redemptions = pgTable("redemptions", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  storeItemId: integer("store_item_id").notNull().references(() => storeItems.id),
  pointsSpent: integer("points_spent").notNull(),
  status: redemptionStatusEnum("status").notNull().default("PENDING"),
  fulfilledAt: timestamp("fulfilled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertRedemptionSchema = createInsertSchema(redemptions).omit({
  id: true, createdAt: true, fulfilledAt: true,
});
export type InsertRedemption = z.infer<typeof insertRedemptionSchema>;
export type Redemption = typeof redemptions.$inferSelect;

// Keep rewardConfigs (per-shop tuning kept for compatibility)
export const rewardConfigs = pgTable("reward_configs", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }).unique(),
  enabled: boolean("enabled").notNull().default(true),
  batteriesPerVape: integer("batteries_per_vape").notNull().default(5),
  shopPointsPerVape: integer("shop_points_per_vape").notNull().default(1),
  sessionWindowSec: integer("session_window_sec").notNull().default(60),
  claimExpirySec: integer("claim_expiry_sec").notNull().default(7 * 24 * 3600),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertRewardConfigSchema = createInsertSchema(rewardConfigs).omit({ id: true, createdAt: true });
export type InsertRewardConfig = z.infer<typeof insertRewardConfigSchema>;
export type RewardConfig = typeof rewardConfigs.$inferSelect;

// ==================== NEW BIN SYSTEM ====================

// Devices — the bin (single ESP32 brain). One device key per device.
export const devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  serial: text("serial").notNull().unique(),
  deviceKeyHash: text("device_key_hash").notNull().unique(),
  shopId: integer("shop_id").references(() => shops.id, { onDelete: "set null" }),
  partnerId: varchar("partner_id").references(() => users.id, { onDelete: "set null" }),
  status: deviceStatusEnum("status").notNull().default("PROVISIONING"),
  firmwareVersion: text("firmware_version"),
  lastHeartbeatAt: timestamp("last_heartbeat_at"),
  vapesSinceEmpty: integer("vapes_since_empty").notNull().default(0),
  fillPercent: integer("fill_percent").notNull().default(0),
  tempC: real("temp_c"),
  vocRaw: integer("voc_raw"),
  wifiRssi: integer("wifi_rssi"),
  sdFreeMb: integer("sd_free_mb"),
  errorLog: text("error_log"),
  latestPhotoUrl: text("latest_photo_url"),
  latestPhotoTakenAt: timestamp("latest_photo_taken_at"),
  // Per-bin shop-points modifier; finalize uses it instead of reward_configs.shopPointsPerVape when set
  pointsPerVapeOverride: integer("points_per_vape_override"),
  lastDistanceMm: integer("last_distance_mm"),
  targetFirmwareVersion: text("target_firmware_version"),
  offlineNotifiedAt: timestamp("offline_notified_at"),
  // Threshold hysteresis state: { notifiedFillLevels: number[], fullNotified: boolean }
  alertStateJson: jsonb("alert_state_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertDeviceSchema = createInsertSchema(devices).omit({
  id: true, createdAt: true, lastHeartbeatAt: true, latestPhotoTakenAt: true,
});
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devices.$inferSelect;

// Pairing nonce (one-time, written over BLE to bin, redeemed by /api/device/claim)
export const pairingNonces = pgTable("pairing_nonces", {
  id: serial("id").primaryKey(),
  nonce: text("nonce").notNull().unique(),
  deviceId: integer("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  consumedAt: timestamp("consumed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type PairingNonce = typeof pairingNonces.$inferSelect;

// Device settings (cloud-configurable, version-stamped so device polls only when newer)
export const deviceSettings = pgTable("device_settings", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }).unique(),
  settingsJson: jsonb("settings_json").notNull().default(sql`'{}'::jsonb`),
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type DeviceSettings = typeof deviceSettings.$inferSelect;

// Commands queued for the device (polled via GET /api/device/commands)
export const deviceCommands = pgTable("device_commands", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  payload: jsonb("payload"),
  status: deviceCommandStatusEnum("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  ackedAt: timestamp("acked_at"),
  ackResult: text("ack_result"),
}, (t) => ({
  deviceIdx: index("device_commands_device_idx").on(t.deviceId),
}));
export type DeviceCommand = typeof deviceCommands.$inferSelect;

// Drop sessions — first IR beam starts a session, last beam + countdown finalizes
export const dropSessions = pgTable("drop_sessions", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
  shopId: integer("shop_id").references(() => shops.id, { onDelete: "set null" }),
  status: dropSessionStatusEnum("status").notNull().default("OPEN"),
  detectedDropCount: integer("detected_drop_count").notNull().default(0),
  acceptedDropCount: integer("accepted_drop_count").notNull().default(0),
  batteriesEstimated: integer("batteries_estimated").notNull().default(0),
  batteriesConfirmed: integer("batteries_confirmed").notNull().default(0),
  shopPointsAwarded: integer("shop_points_awarded").notNull().default(0),
  claimToken: text("claim_token").unique(),
  claimedByCustomerId: integer("claimed_by_customer_id").references(() => customers.id, { onDelete: "set null" }),
  claimedAt: timestamp("claimed_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  finalizedAt: timestamp("finalized_at"),
});
export type DropSession = typeof dropSessions.$inferSelect;

// Individual drops within a session
export const drops = pgTable("drops", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => dropSessions.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  beforePhotoId: integer("before_photo_id"),
  afterPhotoId: integer("after_photo_id"),
  beamPatternJson: jsonb("beam_pattern_json"),
  tempC: real("temp_c"),
  vocRaw: integer("voc_raw"),
  fillPercent: integer("fill_percent"),
  accepted: boolean("accepted").notNull().default(true),
  reviewStatus: dropReviewStatusEnum("review_status").notNull().default("UNREVIEWED"),
  reviewedByUserId: varchar("reviewed_by_user_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNote: text("review_note"),
  // Set once compensation ledger rows are written on reject (idempotency latch)
  pointsRevoked: boolean("points_revoked").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type Drop = typeof drops.$inferSelect;

// Photos — uploaded by device, attached to device/session/drop
export const photos = pgTable("photos", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
  sessionId: integer("session_id").references(() => dropSessions.id, { onDelete: "set null" }),
  dropId: integer("drop_id").references(() => drops.id, { onDelete: "set null" }),
  storageUrl: text("storage_url").notNull(),
  reason: photoReasonEnum("reason").notNull().default("idle"),
  takenAt: timestamp("taken_at").defaultNow().notNull(),
});
export type Photo = typeof photos.$inferSelect;

// Customer "Batteries" ledger
export const batteryTransactions = pgTable("battery_transactions", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  sessionId: integer("session_id").references(() => dropSessions.id, { onDelete: "set null" }),
  amount: integer("amount").notNull(),
  type: ledgerTypeEnum("type").notNull(),
  status: ledgerStatusEnum("status").notNull().default("POSTED"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  customerIdx: index("battery_tx_customer_idx").on(t.customerId),
  sessionUniq: unique("battery_tx_session_uniq").on(t.sessionId),
}));
export type BatteryTransaction = typeof batteryTransactions.$inferSelect;

// Shop "Points" ledger
export const shopPointTransactions = pgTable("shop_point_transactions", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
  deviceId: integer("device_id").references(() => devices.id, { onDelete: "set null" }),
  sessionId: integer("session_id").references(() => dropSessions.id, { onDelete: "set null" }),
  amount: integer("amount").notNull(),
  type: ledgerTypeEnum("type").notNull(),
  status: ledgerStatusEnum("status").notNull().default("POSTED"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  shopIdx: index("shop_pt_shop_idx").on(t.shopId),
}));
export type ShopPointTransaction = typeof shopPointTransactions.$inferSelect;

// Shop reward store (partner-managed)
export const shopRewards = pgTable("shop_rewards", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  cost: integer("cost").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertShopRewardSchema = createInsertSchema(shopRewards).omit({ id: true, createdAt: true });
export type InsertShopReward = z.infer<typeof insertShopRewardSchema>;
export type ShopReward = typeof shopRewards.$inferSelect;

export const shopRewardRedemptions = pgTable("shop_reward_redemptions", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
  rewardId: integer("reward_id").notNull().references(() => shopRewards.id, { onDelete: "cascade" }),
  redeemedByUserId: varchar("redeemed_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  cost: integer("cost").notNull(),
  redeemedAt: timestamp("redeemed_at").defaultNow().notNull(),
});
export type ShopRewardRedemption = typeof shopRewardRedemptions.$inferSelect;

// ==================== ALERTS & NOTIFICATIONS ====================

// Alerts — threshold/event alerts per device. `type` is the closed set:
// FILL_THRESHOLD | FULL | TEMP_HIGH | VOC_HIGH | FIRE | OFFLINE | SD_ERROR | CAMERA_ERROR
export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
  shopId: integer("shop_id").references(() => shops.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  severity: alertSeverityEnum("severity").notNull(),
  message: text("message").notNull(),
  dataJson: jsonb("data_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
  notifiedJson: jsonb("notified_json"),
}, (t) => ({
  deviceCreatedIdx: index("alerts_device_created_idx").on(t.deviceId, t.createdAt),
}));
export const insertAlertSchema = createInsertSchema(alerts).omit({ id: true, createdAt: true });
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alerts.$inferSelect;

// Notification prefs — one row per user per scope. shopId null = global scope (STAFF).
// Postgres treats NULLs as distinct in unique constraints, so the (userId, shopId)
// unique alone would allow duplicate global rows; the partial unique index on userId
// where shopId is null enforces at most one global-scope row per user.
export const notificationPrefs = pgTable("notification_prefs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  shopId: integer("shop_id").references(() => shops.id, { onDelete: "cascade" }),
  channelsJson: jsonb("channels_json").notNull()
    .default(sql`'{"email":true,"sms":false,"call":false,"push":false}'::jsonb`),
  eventsJson: jsonb("events_json").notNull()
    .default(sql`'{"full":true,"fillLevels":[],"fire":true,"tempHigh":true,"vocHigh":true,"offline":true,"drops":false}'::jsonb`),
  phone: text("phone"), // legacy single number; superseded by phonesJson
  // [{ number, sms, call, minSeverity }] — up to 5 numbers, each with its own
  // channels and minimum alert level. Deduped across accounts at dispatch time.
  phonesJson: jsonb("phones_json"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  userShopUniq: unique("notification_prefs_user_shop_uniq").on(t.userId, t.shopId),
  userGlobalUniq: uniqueIndex("notification_prefs_user_global_uniq")
    .on(t.userId)
    .where(sql`${t.shopId} is null`),
}));
export const insertNotificationPrefsSchema = createInsertSchema(notificationPrefs).omit({ id: true, updatedAt: true });
export type InsertNotificationPrefs = z.infer<typeof insertNotificationPrefsSchema>;
export type NotificationPrefs = typeof notificationPrefs.$inferSelect;

// ==================== PARTNER TEAM INVITES ====================
export const partnerInvites = pgTable("partner_invites", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: shopMemberRoleEnum("role").notNull(),
  token: text("token").notNull().unique(),
  invitedByUserId: varchar("invited_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  acceptedByUserId: varchar("accepted_by_user_id").references(() => users.id),
});
export const insertPartnerInviteSchema = createInsertSchema(partnerInvites).omit({ id: true, createdAt: true });
export type InsertPartnerInvite = z.infer<typeof insertPartnerInviteSchema>;
export type PartnerInvite = typeof partnerInvites.$inferSelect;

// ==================== CUSTOMER SELF-REPORTS ====================
export const selfReports = pgTable("self_reports", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => dropSessions.id, { onDelete: "cascade" }),
  customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  brand: text("brand"),
  model: text("model"),
  puffCount: integer("puff_count"),
  isThc: boolean("is_thc"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  sessionUniq: unique("self_reports_session_uniq").on(t.sessionId),
}));
export const insertSelfReportSchema = createInsertSchema(selfReports).omit({ id: true, createdAt: true });
export type InsertSelfReport = z.infer<typeof insertSelfReportSchema>;
export type SelfReport = typeof selfReports.$inferSelect;

// ==================== FIRMWARE RELEASES (OTA) ====================
export const firmwareReleases = pgTable("firmware_releases", {
  id: serial("id").primaryKey(),
  board: text("board").notNull(), // "sensor" | "hmi"
  version: text("version").notNull(),
  channel: text("channel").notNull().default("stable"), // "stable" | "beta"
  url: text("url").notNull(),
  sha256: text("sha256").notNull(),
  sizeBytes: integer("size_bytes"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  boardVersionChannelUniq: unique("firmware_board_version_channel_uniq").on(t.board, t.version, t.channel),
}));
export const insertFirmwareReleaseSchema = createInsertSchema(firmwareReleases).omit({ id: true, createdAt: true });
export type InsertFirmwareRelease = z.infer<typeof insertFirmwareReleaseSchema>;
export type FirmwareRelease = typeof firmwareReleases.$inferSelect;

// ==================== PAIRING CODES (QR/SoftAP flow) ====================
// Replaces nothing; BLE pairing_nonces stays for back-compat.
export const pairingCodes = pgTable("pairing_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // 6 chars, uppercase alphanumeric, alphabet excludes 0/O/1/I
  deviceId: integer("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id),
  expiresAt: timestamp("expires_at").notNull(), // 10-minute TTL
  consumedAt: timestamp("consumed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type PairingCode = typeof pairingCodes.$inferSelect;
