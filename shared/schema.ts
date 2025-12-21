import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, timestamp, integer, boolean, jsonb, pgEnum, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", ["STAFF", "PARTNER", "CUSTOMER"]);
export const shopStatusEnum = pgEnum("shop_status", ["PENDING", "VERIFIED", "SUSPENDED"]);
export const shopMemberRoleEnum = pgEnum("shop_member_role", ["OWNER", "MANAGER"]);
export const leadStatusEnum = pgEnum("lead_status", ["NEW", "CONTACTED", "CONVERTED", "REJECTED"]);
export const deviceStatusEnum = pgEnum("device_status", ["ACTIVE", "INACTIVE", "MAINTENANCE"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["EARN", "REDEEM", "ADJUST"]);
export const redemptionStatusEnum = pgEnum("redemption_status", ["PENDING", "APPROVED", "FULFILLED", "REJECTED"]);

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

// Devices table - ESP32 devices
export const devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  deviceKeyHash: text("device_key_hash").notNull(),
  status: deviceStatusEnum("status").notNull().default("ACTIVE"),
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

// DropEvents - records each vape drop
export const dropEvents = pgTable("drop_events", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").notNull().references(() => shops.id),
  deviceId: integer("device_id").notNull().references(() => devices.id),
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
