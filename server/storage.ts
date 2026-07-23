import {
  type User, type InsertUser,
  type Session,
  type Shop, type InsertShop,
  type ShopMember, type InsertShopMember,
  type Lead, type InsertLead,
  type Contact, type InsertContact,
  type Volunteer, type InsertVolunteer,
  type PickupRequest, type InsertPickupRequest,
  type Customer, type InsertCustomer,
  type Wallet,
  type Transaction, type InsertTransaction,
  type StoreItem, type InsertStoreItem,
  type Redemption, type InsertRedemption,
  type RewardConfig, type InsertRewardConfig,
  type Device, type InsertDevice,
  type PairingNonce,
  type DeviceSettings,
  type DeviceCommand,
  type DropSession,
  type Drop,
  type Photo,
  type BatteryTransaction,
  type ShopPointTransaction,
  type ShopReward, type InsertShopReward,
  type ShopRewardRedemption,
  users, sessions, shops, shopMembers, leads, contacts, volunteers,
  pickupRequests, customers, wallets, transactions, storeItems, redemptions,
  rewardConfigs, devices, pairingNonces, deviceSettings, deviceCommands,
  dropSessions, drops, photos, batteryTransactions, shopPointTransactions,
  shopRewards, shopRewardRedemptions,
} from "@shared/schema";
import { db } from "./db";
import { desc, eq, and, gt, lt, sql, inArray, isNull } from "drizzle-orm";

export const storage = {
  // ====== Users ======
  async getUser(id: string): Promise<User | undefined> {
    const [u] = await db.select().from(users).where(eq(users.id, id));
    return u;
  },
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [u] = await db.select().from(users).where(eq(users.email, email));
    return u;
  },
  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  },
  async createUser(data: InsertUser): Promise<User> {
    const [u] = await db.insert(users).values(data).returning();
    return u;
  },
  async updateUserPassword(userId: string, passwordHash: string) {
    const [u] = await db.update(users).set({ passwordHash }).where(eq(users.id, userId)).returning();
    return u;
  },
  async updateUserRole(userId: string, role: any) {
    const [u] = await db.update(users).set({ role }).where(eq(users.id, userId)).returning();
    return u;
  },
  async updateUserTheme(userId: string, theme: string) {
    await db.update(users).set({ themePreference: theme }).where(eq(users.id, userId));
  },
  async deleteUser(userId: string) {
    const r = await db.delete(users).where(eq(users.id, userId));
    return (r.rowCount ?? 0) > 0;
  },

  // ====== Sessions ======
  async createSession(userId: string, expiresAt: Date): Promise<Session> {
    const [s] = await db.insert(sessions).values({ userId, expiresAt }).returning();
    return s;
  },
  async getSession(id: string): Promise<Session | undefined> {
    const [s] = await db.select().from(sessions).where(eq(sessions.id, id));
    if (!s) return undefined;
    if (s.expiresAt < new Date()) {
      await db.delete(sessions).where(eq(sessions.id, id));
      return undefined;
    }
    return s;
  },
  async deleteSession(id: string) {
    await db.delete(sessions).where(eq(sessions.id, id));
  },

  // ====== Contacts / Leads / Volunteers ======
  async createContact(data: InsertContact): Promise<Contact> {
    const [c] = await db.insert(contacts).values(data).returning();
    return c;
  },
  async getAllContacts() {
    return db.select().from(contacts).orderBy(desc(contacts.createdAt));
  },
  async createLead(data: InsertLead): Promise<Lead> {
    const [l] = await db.insert(leads).values(data).returning();
    return l;
  },
  async getAllLeads() {
    return db.select().from(leads).orderBy(desc(leads.createdAt));
  },
  async updateLeadStatus(id: number, status: any, notes?: string) {
    const [l] = await db.update(leads).set({ status, notes }).where(eq(leads.id, id)).returning();
    return l;
  },
  async createVolunteer(data: InsertVolunteer): Promise<Volunteer> {
    const [v] = await db.insert(volunteers).values(data).returning();
    return v;
  },
  async getAllVolunteers() {
    return db.select().from(volunteers).orderBy(desc(volunteers.createdAt));
  },

  // ====== Shops ======
  async createShop(data: InsertShop): Promise<Shop> {
    const [s] = await db.insert(shops).values(data).returning();
    return s;
  },
  async getShop(id: number): Promise<Shop | undefined> {
    const [s] = await db.select().from(shops).where(eq(shops.id, id));
    return s;
  },
  async getAllShops(): Promise<Shop[]> {
    return db.select().from(shops).orderBy(desc(shops.createdAt));
  },
  async getVerifiedShops(): Promise<Shop[]> {
    return db.select().from(shops).where(eq(shops.status, "VERIFIED"));
  },
  async updateShopStatus(id: number, status: any) {
    const [s] = await db.update(shops).set({ status }).where(eq(shops.id, id)).returning();
    return s;
  },
  async getShopsByMemberId(userId: string): Promise<Shop[]> {
    const rows = await db
      .select({ shop: shops })
      .from(shopMembers)
      .innerJoin(shops, eq(shops.id, shopMembers.shopId))
      .where(eq(shopMembers.userId, userId));
    return rows.map(r => r.shop);
  },
  async createShopMember(data: InsertShopMember): Promise<ShopMember> {
    const [m] = await db.insert(shopMembers).values(data).returning();
    return m;
  },
  async isShopMember(userId: string, shopId: number): Promise<boolean> {
    const [m] = await db.select().from(shopMembers).where(and(eq(shopMembers.userId, userId), eq(shopMembers.shopId, shopId)));
    return !!m;
  },

  // ====== Pickups ======
  async createPickupRequest(data: InsertPickupRequest) {
    const [p] = await db.insert(pickupRequests).values(data).returning();
    return p;
  },
  async getPickupRequestsByShop(shopId: number) {
    return db.select().from(pickupRequests).where(eq(pickupRequests.shopId, shopId)).orderBy(desc(pickupRequests.createdAt));
  },
  async getAllPickupRequests() {
    return db.select().from(pickupRequests).orderBy(desc(pickupRequests.createdAt));
  },

  // ====== Customers / Wallets ======
  async createCustomer(data: InsertCustomer): Promise<Customer> {
    const [c] = await db.insert(customers).values(data).returning();
    return c;
  },
  async getCustomerByUserId(userId: string): Promise<Customer | undefined> {
    const [c] = await db.select().from(customers).where(eq(customers.userId, userId));
    return c;
  },
  async createWallet(customerId: number): Promise<Wallet> {
    const [w] = await db.insert(wallets).values({ customerId }).returning();
    return w;
  },
  async getWallet(customerId: number): Promise<Wallet | undefined> {
    const [w] = await db.select().from(wallets).where(eq(wallets.customerId, customerId));
    return w;
  },
  // Battery balance = SUM EARNED - SUM REDEEMED + SUM ADJUST (ledger-based).
  // ADJUST amounts are signed (negative on staff reject, positive on restore —
  // spec §6); balance may go negative by design.
  async getBatteryBalance(customerId: number): Promise<{ balance: number; lifetimeEarned: number }> {
    const [row] = await db
      .select({
        earned: sql<number>`COALESCE(SUM(CASE WHEN ${batteryTransactions.type} = 'EARNED' THEN ${batteryTransactions.amount} ELSE 0 END), 0)`,
        redeemed: sql<number>`COALESCE(SUM(CASE WHEN ${batteryTransactions.type} = 'REDEEMED' THEN ${batteryTransactions.amount} ELSE 0 END), 0)`,
        adjusted: sql<number>`COALESCE(SUM(CASE WHEN ${batteryTransactions.type} = 'ADJUST' THEN ${batteryTransactions.amount} ELSE 0 END), 0)`,
      })
      .from(batteryTransactions)
      .where(and(eq(batteryTransactions.customerId, customerId), eq(batteryTransactions.status, "POSTED")));
    const earned = Number(row?.earned ?? 0);
    const redeemed = Number(row?.redeemed ?? 0);
    const adjusted = Number(row?.adjusted ?? 0);
    return { balance: earned - redeemed + adjusted, lifetimeEarned: earned };
  },
  async getBatteryTransactions(customerId: number, limit = 50) {
    return db.select().from(batteryTransactions)
      .where(eq(batteryTransactions.customerId, customerId))
      .orderBy(desc(batteryTransactions.createdAt))
      .limit(limit);
  },
  async createBatteryTransaction(data: typeof batteryTransactions.$inferInsert) {
    const [t] = await db.insert(batteryTransactions).values(data).returning();
    return t;
  },

  // ====== Store / Redemptions ======
  async getActiveStoreItems(category = "customer"): Promise<StoreItem[]> {
    return db.select().from(storeItems).where(and(eq(storeItems.active, true), eq(storeItems.category, category)));
  },
  async getStoreItem(id: number) {
    const [s] = await db.select().from(storeItems).where(eq(storeItems.id, id));
    return s;
  },
  async createStoreItem(data: InsertStoreItem) {
    const [s] = await db.insert(storeItems).values(data).returning();
    return s;
  },
  async createRedemption(data: InsertRedemption) {
    const [r] = await db.insert(redemptions).values(data).returning();
    return r;
  },
  async getRedemptionsByCustomer(customerId: number) {
    return db.select().from(redemptions).where(eq(redemptions.customerId, customerId)).orderBy(desc(redemptions.createdAt));
  },

  // ====== Reward Configs ======
  async getRewardConfig(shopId: number) {
    const [c] = await db.select().from(rewardConfigs).where(eq(rewardConfigs.shopId, shopId));
    return c;
  },
  async upsertRewardConfig(shopId: number, data: Partial<InsertRewardConfig>) {
    const existing = await this.getRewardConfig(shopId);
    if (existing) {
      const [c] = await db.update(rewardConfigs).set(data).where(eq(rewardConfigs.shopId, shopId)).returning();
      return c;
    }
    const [c] = await db.insert(rewardConfigs).values({ shopId, ...data } as any).returning();
    return c;
  },

  // ====== Devices ======
  async createDevice(data: InsertDevice): Promise<Device> {
    const [d] = await db.insert(devices).values(data).returning();
    return d;
  },
  async getDevice(id: number): Promise<Device | undefined> {
    const [d] = await db.select().from(devices).where(eq(devices.id, id));
    return d;
  },
  async getDeviceBySerial(serial: string): Promise<Device | undefined> {
    const [d] = await db.select().from(devices).where(eq(devices.serial, serial));
    return d;
  },
  async getDeviceByKeyHash(hash: string): Promise<Device | undefined> {
    const [d] = await db.select().from(devices).where(eq(devices.deviceKeyHash, hash));
    return d;
  },
  async getAllDevices(): Promise<Device[]> {
    return db.select().from(devices).orderBy(desc(devices.createdAt));
  },
  async getDevicesByShop(shopId: number): Promise<Device[]> {
    return db.select().from(devices).where(eq(devices.shopId, shopId));
  },
  async getDevicesByPartner(partnerId: string): Promise<Device[]> {
    return db.select().from(devices).where(eq(devices.partnerId, partnerId));
  },
  async updateDevice(id: number, patch: Partial<typeof devices.$inferInsert>) {
    const [d] = await db.update(devices).set(patch).where(eq(devices.id, id)).returning();
    return d;
  },
  async deleteDevice(id: number) {
    await db.delete(devices).where(eq(devices.id, id));
  },

  // ====== Pairing nonces ======
  async createPairingNonce(deviceId: number, nonce: string, expiresAt: Date): Promise<PairingNonce> {
    const [p] = await db.insert(pairingNonces).values({ deviceId, nonce, expiresAt }).returning();
    return p;
  },
  async consumePairingNonce(nonce: string): Promise<PairingNonce | undefined> {
    const [p] = await db.select().from(pairingNonces).where(eq(pairingNonces.nonce, nonce));
    if (!p) return undefined;
    if (p.consumedAt) return undefined;
    if (p.expiresAt < new Date()) return undefined;
    const [updated] = await db.update(pairingNonces).set({ consumedAt: new Date() }).where(and(eq(pairingNonces.id, p.id), isNull(pairingNonces.consumedAt))).returning();
    return updated;
  },

  // ====== Device settings ======
  async getDeviceSettings(deviceId: number): Promise<DeviceSettings | undefined> {
    const [s] = await db.select().from(deviceSettings).where(eq(deviceSettings.deviceId, deviceId));
    return s;
  },
  async upsertDeviceSettings(deviceId: number, settingsJson: any): Promise<DeviceSettings> {
    const existing = await this.getDeviceSettings(deviceId);
    if (existing) {
      const [s] = await db.update(deviceSettings)
        .set({ settingsJson, version: existing.version + 1, updatedAt: new Date() })
        .where(eq(deviceSettings.deviceId, deviceId))
        .returning();
      return s;
    }
    const [s] = await db.insert(deviceSettings).values({ deviceId, settingsJson, version: 1 }).returning();
    return s;
  },

  // ====== Device commands ======
  async enqueueCommand(deviceId: number, type: string, payload?: any): Promise<DeviceCommand> {
    const [c] = await db.insert(deviceCommands).values({ deviceId, type, payload }).returning();
    return c;
  },
  async getPendingCommands(deviceId: number, sinceId = 0): Promise<DeviceCommand[]> {
    return db.select().from(deviceCommands)
      .where(and(
        eq(deviceCommands.deviceId, deviceId),
        gt(deviceCommands.id, sinceId),
        inArray(deviceCommands.status, ["PENDING", "SENT"]),
      ))
      .orderBy(deviceCommands.id);
  },
  async getCommandsByDevice(deviceId: number, limit = 50): Promise<DeviceCommand[]> {
    return db.select().from(deviceCommands)
      .where(eq(deviceCommands.deviceId, deviceId))
      .orderBy(desc(deviceCommands.id))
      .limit(limit);
  },
  async ackCommand(commandId: number, deviceId: number, result?: string) {
    const [c] = await db.update(deviceCommands)
      .set({ status: "ACKED", ackedAt: new Date(), ackResult: result })
      .where(and(eq(deviceCommands.id, commandId), eq(deviceCommands.deviceId, deviceId)))
      .returning();
    return c;
  },
  // Cancel a still-PENDING command (staff misclick). Only PENDING can be cancelled —
  // once the bin has polled it (SENT/ACKED) it cannot be recalled. Returns the
  // updated row, or undefined if it was not found / no longer PENDING.
  async cancelCommand(commandId: number, deviceId: number) {
    const [c] = await db.update(deviceCommands)
      .set({ status: "FAILED", ackedAt: new Date(), ackResult: "cancelled by staff" })
      .where(and(
        eq(deviceCommands.id, commandId),
        eq(deviceCommands.deviceId, deviceId),
        eq(deviceCommands.status, "PENDING"),
      ))
      .returning();
    return c;
  },

  // ====== Drop sessions / drops ======
  async createDropSession(deviceId: number, shopId: number | null): Promise<DropSession> {
    const [s] = await db.insert(dropSessions).values({ deviceId, shopId }).returning();
    return s;
  },
  async getDropSession(id: number): Promise<DropSession | undefined> {
    const [s] = await db.select().from(dropSessions).where(eq(dropSessions.id, id));
    return s;
  },
  async getDropSessionByClaimToken(token: string): Promise<DropSession | undefined> {
    const [s] = await db.select().from(dropSessions).where(eq(dropSessions.claimToken, token));
    return s;
  },
  async getRecentSessionsByShops(shopIds: number[], limit = 50): Promise<DropSession[]> {
    if (shopIds.length === 0) return [];
    return db.select().from(dropSessions)
      .where(inArray(dropSessions.shopId, shopIds))
      .orderBy(desc(dropSessions.createdAt))
      .limit(limit);
  },
  async updateDropSession(id: number, patch: Partial<typeof dropSessions.$inferInsert>) {
    const [s] = await db.update(dropSessions).set(patch).where(eq(dropSessions.id, id)).returning();
    return s;
  },
  async createDrop(data: typeof drops.$inferInsert): Promise<Drop> {
    const [d] = await db.insert(drops).values(data).returning();
    return d;
  },
  async updateDrop(id: number, patch: Partial<typeof drops.$inferInsert>): Promise<Drop | undefined> {
    const [d] = await db.update(drops).set(patch).where(eq(drops.id, id)).returning();
    return d;
  },
  async getDropsBySession(sessionId: number): Promise<Drop[]> {
    return db.select().from(drops).where(eq(drops.sessionId, sessionId)).orderBy(drops.sequence);
  },
  async getDrop(id: number): Promise<Drop | undefined> {
    const [d] = await db.select().from(drops).where(eq(drops.id, id));
    return d;
  },

  // ====== Photos ======
  async createPhoto(data: typeof photos.$inferInsert): Promise<Photo> {
    const [p] = await db.insert(photos).values(data).returning();
    return p;
  },
  async getPhoto(id: number): Promise<Photo | undefined> {
    const [p] = await db.select().from(photos).where(eq(photos.id, id));
    return p;
  },

  // ====== Shop points ======
  async createShopPointTransaction(data: typeof shopPointTransactions.$inferInsert) {
    const [t] = await db.insert(shopPointTransactions).values(data).returning();
    return t;
  },
  // Signed ADJUST rows (staff reject/restore, spec §6) count toward the balance
  async getShopPointBalance(shopId: number): Promise<number> {
    const [row] = await db
      .select({
        earned: sql<number>`COALESCE(SUM(CASE WHEN ${shopPointTransactions.type} = 'EARNED' THEN ${shopPointTransactions.amount} ELSE 0 END), 0)`,
        redeemed: sql<number>`COALESCE(SUM(CASE WHEN ${shopPointTransactions.type} = 'REDEEMED' THEN ${shopPointTransactions.amount} ELSE 0 END), 0)`,
        adjusted: sql<number>`COALESCE(SUM(CASE WHEN ${shopPointTransactions.type} = 'ADJUST' THEN ${shopPointTransactions.amount} ELSE 0 END), 0)`,
      })
      .from(shopPointTransactions)
      .where(and(eq(shopPointTransactions.shopId, shopId), eq(shopPointTransactions.status, "POSTED")));
    return Number(row?.earned ?? 0) - Number(row?.redeemed ?? 0) + Number(row?.adjusted ?? 0);
  },
  async getShopPointTransactions(shopId: number, limit = 100) {
    return db.select().from(shopPointTransactions)
      .where(eq(shopPointTransactions.shopId, shopId))
      .orderBy(desc(shopPointTransactions.createdAt))
      .limit(limit);
  },

  // ====== Shop rewards ======
  async createShopReward(data: InsertShopReward): Promise<ShopReward> {
    const [r] = await db.insert(shopRewards).values(data).returning();
    return r;
  },
  async getShopRewards(shopId: number): Promise<ShopReward[]> {
    return db.select().from(shopRewards).where(eq(shopRewards.shopId, shopId)).orderBy(shopRewards.cost);
  },
  async getShopReward(id: number): Promise<ShopReward | undefined> {
    const [r] = await db.select().from(shopRewards).where(eq(shopRewards.id, id));
    return r;
  },
  async updateShopReward(id: number, patch: Partial<InsertShopReward>) {
    const [r] = await db.update(shopRewards).set(patch).where(eq(shopRewards.id, id)).returning();
    return r;
  },
  async deleteShopReward(id: number) {
    await db.delete(shopRewards).where(eq(shopRewards.id, id));
  },
  async createShopRewardRedemption(data: typeof shopRewardRedemptions.$inferInsert): Promise<ShopRewardRedemption> {
    const [r] = await db.insert(shopRewardRedemptions).values(data).returning();
    return r;
  },
  async getShopRewardRedemptions(shopId: number) {
    return db.select().from(shopRewardRedemptions).where(eq(shopRewardRedemptions.shopId, shopId)).orderBy(desc(shopRewardRedemptions.redeemedAt));
  },
};

export type IStorage = typeof storage;
