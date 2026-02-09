import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, timestamp, integer, boolean, jsonb, pgEnum, unique, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", ["STAFF", "PARTNER", "CUSTOMER"]);
export const shopStatusEnum = pgEnum("shop_status", ["PENDING", "VERIFIED", "SUSPENDED"]);
export const shopMemberRoleEnum = pgEnum("shop_member_role", ["OWNER", "MANAGER"]);
export const leadStatusEnum = pgEnum("lead_status", ["NEW", "CONTACTED", "CONVERTED", "REJECTED"]);
export const deviceStatusEnum = pgEnum("device_status", ["ACTIVE", "INACTIVE", "MAINTENANCE"]);
export const binStatusEnum = pgEnum("bin_status", ["ONLINE", "OFFLINE", "FIRE_ALERT", "MAINTENANCE"]);
export const alertSeverityEnum = pgEnum("alert_severity", ["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["EARN", "REDEEM", "ADJUST"]);
export const redemptionStatusEnum = pgEnum("redemption_status", ["PENDING", "APPROVED", "FULFILLED", "REJECTED"]);
export const rewardSessionStatusEnum = pgEnum("reward_session_status", ["PENDING", "CLAIMED", "EXPIRED"]);

// Users table - expanded with roles
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  role: userRoleEnum("role").notNull().default("CUSTOMER"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Sessions table for auth
export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Session = typeof sessions.$inferSelect;

// Shops table - partner locations
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

export const insertShopSchema = createInsertSchema(shops).omit({
  id: true,
  createdAt: true,
});
export type InsertShop = z.infer<typeof insertShopSchema>;
export type Shop = typeof shops.$inferSelect;

// ShopMembers - link users to shops
export const shopMembers = pgTable("shop_members", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  shopId: integer("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
  role: shopMemberRoleEnum("role").notNull().default("MANAGER"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueUserShop: unique().on(table.userId, table.shopId),
}));

export const insertShopMemberSchema = createInsertSchema(shopMembers).omit({
  id: true,
  createdAt: true,
});
export type InsertShopMember = z.infer<typeof insertShopMemberSchema>;
export type ShopMember = typeof shopMembers.$inferSelect;

// Leads table - bin request leads (replacing old bin_requests)
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
  id: true,
  createdAt: true,
  status: true,
  notes: true,
});
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

// Devices table - ESP32 devices (uid-based, shopId nullable for unpaired)
export const devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  uid: text("uid").unique(),
  shopId: integer("shop_id").references(() => shops.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  deviceKeyHash: text("device_key_hash"),
  firmwareVersion: text("firmware_version"),
  trusted: boolean("trusted").notNull().default(false),
  status: deviceStatusEnum("status").notNull().default("INACTIVE"),
  lastSeenAt: timestamp("last_seen_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDeviceSchema = createInsertSchema(devices).omit({
  id: true,
  createdAt: true,
  lastSeenAt: true,
});
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devices.$inferSelect;

// RewardConfigs - per-shop reward settings
export const rewardConfigs = pgTable("reward_configs", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }).unique(),
  enabled: boolean("enabled").notNull().default(true),
  minSecondsBetweenSpins: integer("min_seconds_between_spins").notNull().default(30),
  dailySpinCap: integer("daily_spin_cap").notNull().default(50),
  dailyPointCap: integer("daily_point_cap").notNull().default(200),
  rewardTableJson: jsonb("reward_table_json").notNull().default(sql`'[{"points": 1, "weight": 50}, {"points": 2, "weight": 30}, {"points": 3, "weight": 15}, {"points": 5, "weight": 4}, {"points": 10, "weight": 1}]'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRewardConfigSchema = createInsertSchema(rewardConfigs).omit({
  id: true,
  createdAt: true,
});
export type InsertRewardConfig = z.infer<typeof insertRewardConfigSchema>;
export type RewardConfig = typeof rewardConfigs.$inferSelect;

// DropEvents - records each vape drop (with idempotency and session linking)
export const dropEvents = pgTable("drop_events", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").notNull().references(() => shops.id),
  deviceId: integer("device_id").notNull().references(() => devices.id),
  deviceEventId: text("device_event_id").unique(),
  sessionId: integer("session_id"),
  pointsAwarded: integer("points_awarded").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDropEventSchema = createInsertSchema(dropEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertDropEvent = z.infer<typeof insertDropEventSchema>;
export type DropEvent = typeof dropEvents.$inferSelect;

// ClaimTokens - short-lived tokens for QR claims
export const claimTokens = pgTable("claim_tokens", {
  id: serial("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  dropEventId: integer("drop_event_id").notNull().references(() => dropEvents.id),
  expiresAt: timestamp("expires_at").notNull(),
  claimedAt: timestamp("claimed_at"),
  claimedByUserId: varchar("claimed_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ClaimToken = typeof claimTokens.$inferSelect;

// Customers - customer profile data
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  publicId: text("public_id").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
});
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

// Wallets - customer point balances
export const wallets = pgTable("wallets", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }).unique(),
  pointsBalance: integer("points_balance").notNull().default(0),
  lifetimeEarned: integer("lifetime_earned").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Wallet = typeof wallets.$inferSelect;

// Transactions - wallet point history
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  walletId: integer("wallet_id").notNull().references(() => wallets.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  type: transactionTypeEnum("type").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

// StoreItems - redeemable rewards
export const storeItems = pgTable("store_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  pointsCost: integer("points_cost").notNull(),
  imageUrl: text("image_url"),
  active: boolean("active").notNull().default(true),
  stock: integer("stock"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStoreItemSchema = createInsertSchema(storeItems).omit({
  id: true,
  createdAt: true,
});
export type InsertStoreItem = z.infer<typeof insertStoreItemSchema>;
export type StoreItem = typeof storeItems.$inferSelect;

// Redemptions - store item redemptions
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
  id: true,
  createdAt: true,
  fulfilledAt: true,
});
export type InsertRedemption = z.infer<typeof insertRedemptionSchema>;
export type Redemption = typeof redemptions.$inferSelect;

// Contacts table - general inquiries (keeping existing)
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
});
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

// Volunteers table - volunteer applications (keeping existing)
export const volunteers = pgTable("volunteers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  interest: text("interest").notNull(),
  availability: text("availability").notNull(),
  notes: text("notes").default("").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVolunteerSchema = createInsertSchema(volunteers).omit({
  id: true,
  createdAt: true,
});
export type InsertVolunteer = z.infer<typeof insertVolunteerSchema>;
export type Volunteer = typeof volunteers.$inferSelect;

// Pickup requests from partners
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
  id: true,
  createdAt: true,
  completedAt: true,
});
export type InsertPickupRequest = z.infer<typeof insertPickupRequestSchema>;
export type PickupRequest = typeof pickupRequests.$inferSelect;

// Bins table - smart recycling bins with sensors
export const bins = pgTable("bins", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
  deviceId: integer("device_id").references(() => devices.id),
  name: text("name").notNull(),
  binType: text("bin_type").notNull().default("vape"),
  status: binStatusEnum("status").notNull().default("OFFLINE"),
  fillLevel: integer("fill_level").notNull().default(0),
  vapeCount: integer("vape_count").notNull().default(0),
  lastTemperature: doublePrecision("last_temperature"),
  lastAirQuality: integer("last_air_quality"),
  lastVocAnalog: integer("last_voc_analog"),
  lastVocDigital: boolean("last_voc_digital"),
  lastSeenAt: timestamp("last_seen_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBinSchema = createInsertSchema(bins).omit({
  id: true,
  createdAt: true,
  lastSeenAt: true,
});
export type InsertBin = z.infer<typeof insertBinSchema>;
export type Bin = typeof bins.$inferSelect;

// BinReadings table - sensor data history
export const binReadings = pgTable("bin_readings", {
  id: serial("id").primaryKey(),
  binId: integer("bin_id").notNull().references(() => bins.id, { onDelete: "cascade" }),
  temperature: doublePrecision("temperature"),
  airQuality: integer("air_quality"),
  vocAnalog: integer("voc_analog"),
  vocDigital: boolean("voc_digital"),
  fillLevel: integer("fill_level"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBinReadingSchema = createInsertSchema(binReadings).omit({
  id: true,
  createdAt: true,
});
export type InsertBinReading = z.infer<typeof insertBinReadingSchema>;
export type BinReading = typeof binReadings.$inferSelect;

// FireAlerts table - fire detection events
export const fireAlerts = pgTable("fire_alerts", {
  id: serial("id").primaryKey(),
  binId: integer("bin_id").notNull().references(() => bins.id, { onDelete: "cascade" }),
  shopId: integer("shop_id").notNull().references(() => shops.id),
  severity: alertSeverityEnum("severity").notNull().default("HIGH"),
  temperature: doublePrecision("temperature"),
  temperatureRise: doublePrecision("temperature_rise"),
  acknowledged: boolean("acknowledged").notNull().default(false),
  acknowledgedAt: timestamp("acknowledged_at"),
  acknowledgedById: varchar("acknowledged_by_id").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFireAlertSchema = createInsertSchema(fireAlerts).omit({
  id: true,
  createdAt: true,
  acknowledgedAt: true,
  resolvedAt: true,
});
export type InsertFireAlert = z.infer<typeof insertFireAlertSchema>;
export type FireAlert = typeof fireAlerts.$inferSelect;

// Mailboxes table - staff email accounts
export const mailboxes = pgTable("mailboxes", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  emailAddress: text("email_address").notNull().unique(),
  displayName: text("display_name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMailboxSchema = createInsertSchema(mailboxes).omit({
  id: true,
  createdAt: true,
});
export type InsertMailbox = z.infer<typeof insertMailboxSchema>;
export type Mailbox = typeof mailboxes.$inferSelect;

// Internal messages table - email-like messages between staff
export const internalMessages = pgTable("internal_messages", {
  id: serial("id").primaryKey(),
  fromMailboxId: integer("from_mailbox_id").notNull().references(() => mailboxes.id, { onDelete: "cascade" }),
  toMailboxId: integer("to_mailbox_id").references(() => mailboxes.id, { onDelete: "set null" }),
  toExternal: text("to_external"),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  isArchived: boolean("is_archived").notNull().default(false),
  isOutbound: boolean("is_outbound").notNull().default(false),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInternalMessageSchema = createInsertSchema(internalMessages).omit({
  id: true,
  createdAt: true,
  sentAt: true,
});
export type InsertInternalMessage = z.infer<typeof insertInternalMessageSchema>;
export type InternalMessage = typeof internalMessages.$inferSelect;

// ==================== V2 SMART BIN API TABLES ====================

// PairRequests - device pairing flow
export const pairRequests = pgTable("pair_requests", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull(),
  pairCode: text("pair_code").notNull().unique(),
  firmwareVersion: text("firmware_version"),
  expiresAt: timestamp("expires_at").notNull(),
  claimed: boolean("claimed").notNull().default(false),
  claimedByUserId: varchar("claimed_by_user_id").references(() => users.id),
  shopId: integer("shop_id").references(() => shops.id),
  deviceId: integer("device_id").references(() => devices.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPairRequestSchema = createInsertSchema(pairRequests).omit({
  id: true,
  createdAt: true,
  claimed: true,
  claimedByUserId: true,
  shopId: true,
  deviceId: true,
});
export type InsertPairRequest = z.infer<typeof insertPairRequestSchema>;
export type PairRequest = typeof pairRequests.$inferSelect;

// RewardSessions - stacking point sessions per device
export const rewardSessions = pgTable("reward_sessions", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").notNull().references(() => devices.id),
  shopId: integer("shop_id").notNull().references(() => shops.id),
  token: text("token").notNull().unique(),
  status: rewardSessionStatusEnum("status").notNull().default("PENDING"),
  pointsTotal: integer("points_total").notNull().default(0),
  dropCount: integer("drop_count").notNull().default(0),
  lastDropAt: timestamp("last_drop_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  claimedByUserId: varchar("claimed_by_user_id").references(() => users.id),
  claimedAt: timestamp("claimed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRewardSessionSchema = createInsertSchema(rewardSessions).omit({
  id: true,
  createdAt: true,
  claimedByUserId: true,
  claimedAt: true,
});
export type InsertRewardSession = z.infer<typeof insertRewardSessionSchema>;
export type RewardSession = typeof rewardSessions.$inferSelect;

// DeviceConfigs - shop-tunable cloud config for ESP32 bins
export const deviceConfigs = pgTable("device_configs", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }).unique(),
  sessionWindowSec: integer("session_window_sec").notNull().default(60),
  acceptedHoldMs: integer("accepted_hold_ms").notNull().default(12000),
  warnEnabled: boolean("warn_enabled").notNull().default(true),
  warnTempC: doublePrecision("warn_temp_c").notNull().default(55.0),
  warnVocAnalog: integer("warn_voc_analog").notNull().default(900),
  warnUseVocDigital: boolean("warn_use_voc_digital").notNull().default(false),
  rawSwapBytes: boolean("raw_swap_bytes").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDeviceConfigSchema = createInsertSchema(deviceConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDeviceConfig = z.infer<typeof insertDeviceConfigSchema>;
export type DeviceConfig = typeof deviceConfigs.$inferSelect;

// PartnerPointsLedger - tracks shop points earned from drops
export const partnerPointsLedger = pgTable("partner_points_ledger", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").notNull().references(() => shops.id),
  deviceId: integer("device_id").references(() => devices.id),
  points: integer("points").notNull(),
  reason: text("reason").notNull(),
  dropEventId: integer("drop_event_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPartnerPointsLedgerSchema = createInsertSchema(partnerPointsLedger).omit({
  id: true,
  createdAt: true,
});
export type InsertPartnerPointsLedger = z.infer<typeof insertPartnerPointsLedgerSchema>;
export type PartnerPointsLedger = typeof partnerPointsLedger.$inferSelect;
