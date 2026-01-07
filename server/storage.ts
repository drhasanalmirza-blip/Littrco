import { 
  type User, 
  type InsertUser,
  type Contact,
  type InsertContact,
  type Volunteer,
  type InsertVolunteer,
  type Lead,
  type InsertLead,
  type Shop,
  type InsertShop,
  type ShopMember,
  type InsertShopMember,
  type Device,
  type InsertDevice,
  type RewardConfig,
  type InsertRewardConfig,
  type DropEvent,
  type InsertDropEvent,
  type ClaimToken,
  type Customer,
  type InsertCustomer,
  type Wallet,
  type Transaction,
  type InsertTransaction,
  type StoreItem,
  type InsertStoreItem,
  type Redemption,
  type InsertRedemption,
  type Session,
  type PickupRequest,
  type InsertPickupRequest,
  type Bin,
  type InsertBin,
  type BinReading,
  type InsertBinReading,
  type FireAlert,
  type InsertFireAlert,
  users,
  contacts,
  volunteers,
  leads,
  shops,
  shopMembers,
  devices,
  rewardConfigs,
  dropEvents,
  claimTokens,
  customers,
  wallets,
  transactions,
  storeItems,
  redemptions,
  sessions,
  pickupRequests,
  bins,
  binReadings,
  fireAlerts,
} from "@shared/schema";
import { db } from "./db";
import { desc, eq, and, gte, sql, lt, inArray } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(userId: string, newPasswordHash: string): Promise<User | undefined>;
  
  // Sessions
  createSession(userId: string, expiresAt: Date): Promise<Session>;
  getSession(id: string): Promise<Session | undefined>;
  deleteSession(id: string): Promise<void>;
  deleteExpiredSessions(): Promise<void>;
  
  // Contacts
  createContact(contact: InsertContact): Promise<Contact>;
  getAllContacts(): Promise<Contact[]>;
  
  // Leads (formerly bin_requests for new submissions)
  createLead(lead: InsertLead): Promise<Lead>;
  getAllLeads(): Promise<Lead[]>;
  updateLeadStatus(id: number, status: string, notes?: string): Promise<Lead | undefined>;
  
  // Shops
  createShop(shop: InsertShop): Promise<Shop>;
  getShop(id: number): Promise<Shop | undefined>;
  getShopByPin(pin: string): Promise<Shop | undefined>;
  getAllShops(): Promise<Shop[]>;
  updateShopStatus(id: number, status: string): Promise<Shop | undefined>;
  updateShopPin(id: number, pin: string): Promise<Shop | undefined>;
  getShopsByMemberId(userId: string): Promise<Shop[]>;
  
  // Shop Members
  createShopMember(member: InsertShopMember): Promise<ShopMember>;
  getShopMembers(shopId: number): Promise<ShopMember[]>;
  
  // Devices
  createDevice(device: InsertDevice): Promise<Device>;
  getDevice(id: number): Promise<Device | undefined>;
  getDevicesByShop(shopId: number): Promise<Device[]>;
  updateDeviceLastSeen(id: number): Promise<void>;
  
  // Reward Configs
  createRewardConfig(config: InsertRewardConfig): Promise<RewardConfig>;
  getRewardConfig(shopId: number): Promise<RewardConfig | undefined>;
  updateRewardConfig(shopId: number, config: Partial<InsertRewardConfig>): Promise<RewardConfig | undefined>;
  
  // Drop Events
  createDropEvent(event: InsertDropEvent): Promise<DropEvent>;
  getDropEventsByShop(shopId: number): Promise<DropEvent[]>;
  getTodayDropEventsByDevice(deviceId: number): Promise<DropEvent[]>;
  getDropEvent(id: number): Promise<DropEvent | undefined>;
  
  // Claim Tokens
  createClaimToken(tokenHash: string, dropEventId: number, expiresAt: Date): Promise<ClaimToken>;
  getClaimToken(tokenHash: string): Promise<ClaimToken | undefined>;
  claimToken(tokenHash: string, userId: string): Promise<boolean>;
  
  // Customers
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  getCustomerByUserId(userId: string): Promise<Customer | undefined>;
  
  // Wallets
  createWallet(customerId: number): Promise<Wallet>;
  getWallet(customerId: number): Promise<Wallet | undefined>;
  updateWalletBalance(customerId: number, pointsDelta: number, isEarning: boolean): Promise<Wallet | undefined>;
  
  // Transactions
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransactionsByWallet(walletId: number): Promise<Transaction[]>;
  
  // Store Items
  createStoreItem(item: InsertStoreItem): Promise<StoreItem>;
  getStoreItem(id: number): Promise<StoreItem | undefined>;
  getAllStoreItems(): Promise<StoreItem[]>;
  updateStoreItem(id: number, item: Partial<InsertStoreItem>): Promise<StoreItem | undefined>;
  
  // Redemptions
  createRedemption(redemption: InsertRedemption): Promise<Redemption>;
  getRedemption(id: number): Promise<Redemption | undefined>;
  getRedemptionsByCustomer(customerId: number): Promise<Redemption[]>;
  getAllRedemptions(): Promise<Redemption[]>;
  updateRedemptionStatus(id: number, status: string): Promise<Redemption | undefined>;
  
  // Pickup Requests
  createPickupRequest(request: InsertPickupRequest): Promise<PickupRequest>;
  getPickupRequestsByShop(shopId: number): Promise<PickupRequest[]>;
  getAllPickupRequests(): Promise<PickupRequest[]>;
  
  // Volunteers
  createVolunteer(volunteer: InsertVolunteer): Promise<Volunteer>;
  getAllVolunteers(): Promise<Volunteer[]>;
  
  // Bins
  createBin(bin: InsertBin): Promise<Bin>;
  getBin(id: number): Promise<Bin | undefined>;
  getBinByDeviceId(deviceId: number): Promise<Bin | undefined>;
  getBinsByShop(shopId: number): Promise<Bin[]>;
  getAllBins(): Promise<Bin[]>;
  getAllBinsWithDevice(): Promise<(Bin & { device?: { id: number; name: string; status: string; lastSeenAt: Date | null } })[]>;
  updateBinStatus(id: number, status: string): Promise<Bin | undefined>;
  updateBinSensorData(id: number, data: { fillLevel?: number; lastTemperature?: number; lastAirQuality?: number; lastVocAnalog?: number; lastVocDigital?: boolean; vapeCount?: number }): Promise<Bin | undefined>;
  deleteBin(id: number): Promise<boolean>;
  
  // Bin Readings
  createBinReading(reading: InsertBinReading): Promise<BinReading>;
  getBinReadings(binId: number, limit?: number): Promise<BinReading[]>;
  
  // Fire Alerts
  createFireAlert(alert: InsertFireAlert): Promise<FireAlert>;
  getFireAlert(id: number): Promise<FireAlert | undefined>;
  getActiveFireAlerts(): Promise<FireAlert[]>;
  getFireAlertsByShop(shopId: number): Promise<FireAlert[]>;
  acknowledgeFireAlert(id: number, userId: string): Promise<FireAlert | undefined>;
  resolveFireAlert(id: number): Promise<FireAlert | undefined>;
  
  // Shop coordinates
  updateShopCoordinates(id: number, lat: number, lng: number): Promise<Shop | undefined>;
  getVerifiedShopsWithCoordinates(): Promise<Shop[]>;
  
  // Staff check
  hasAnyStaff(): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserPassword(userId: string, newPasswordHash: string): Promise<User | undefined> {
    const [user] = await db.update(users).set({ passwordHash: newPasswordHash }).where(eq(users.id, userId)).returning();
    return user;
  }
  
  // Sessions
  async createSession(userId: string, expiresAt: Date): Promise<Session> {
    const [session] = await db.insert(sessions).values({ userId, expiresAt }).returning();
    return session;
  }
  
  async getSession(id: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(
      and(eq(sessions.id, id), gte(sessions.expiresAt, new Date()))
    );
    return session;
  }
  
  async deleteSession(id: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.id, id));
  }
  
  async deleteExpiredSessions(): Promise<void> {
    await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  }

  // Contacts
  async createContact(insertContact: InsertContact): Promise<Contact> {
    const [contact] = await db.insert(contacts).values(insertContact).returning();
    return contact;
  }

  async getAllContacts(): Promise<Contact[]> {
    return await db.select().from(contacts).orderBy(desc(contacts.createdAt));
  }

  // Leads
  async createLead(insertLead: InsertLead): Promise<Lead> {
    const [lead] = await db.insert(leads).values(insertLead).returning();
    return lead;
  }

  async getAllLeads(): Promise<Lead[]> {
    return await db.select().from(leads).orderBy(desc(leads.createdAt));
  }
  
  async updateLeadStatus(id: number, status: string, notes?: string): Promise<Lead | undefined> {
    const updateData: any = { status };
    if (notes !== undefined) updateData.notes = notes;
    const [lead] = await db.update(leads).set(updateData).where(eq(leads.id, id)).returning();
    return lead;
  }
  
  // Shops
  async createShop(insertShop: InsertShop): Promise<Shop> {
    const [shop] = await db.insert(shops).values(insertShop).returning();
    return shop;
  }
  
  async getShop(id: number): Promise<Shop | undefined> {
    const [shop] = await db.select().from(shops).where(eq(shops.id, id));
    return shop;
  }

  async getShopByPin(pin: string): Promise<Shop | undefined> {
    const [shop] = await db.select().from(shops).where(eq(shops.secretPin, pin));
    return shop;
  }
  
  async getAllShops(): Promise<Shop[]> {
    return await db.select().from(shops).orderBy(desc(shops.createdAt));
  }
  
  async updateShopStatus(id: number, status: string): Promise<Shop | undefined> {
    const [shop] = await db.update(shops).set({ status: status as any }).where(eq(shops.id, id)).returning();
    return shop;
  }

  async updateShopPin(id: number, pin: string): Promise<Shop | undefined> {
    const [shop] = await db.update(shops).set({ secretPin: pin }).where(eq(shops.id, id)).returning();
    return shop;
  }
  
  async getShopsByMemberId(userId: string): Promise<Shop[]> {
    const members = await db.select().from(shopMembers).where(eq(shopMembers.userId, userId));
    if (members.length === 0) return [];
    const shopIds = members.map(m => m.shopId);
    return await db.select().from(shops).where(inArray(shops.id, shopIds));
  }
  
  // Shop Members
  async createShopMember(member: InsertShopMember): Promise<ShopMember> {
    const [shopMember] = await db.insert(shopMembers).values(member).returning();
    return shopMember;
  }
  
  async getShopMembers(shopId: number): Promise<ShopMember[]> {
    return await db.select().from(shopMembers).where(eq(shopMembers.shopId, shopId));
  }
  
  // Devices
  async createDevice(device: InsertDevice): Promise<Device> {
    const [newDevice] = await db.insert(devices).values(device).returning();
    return newDevice;
  }
  
  async getDevice(id: number): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.id, id));
    return device;
  }
  
  async getDevicesByShop(shopId: number): Promise<Device[]> {
    return await db.select().from(devices).where(eq(devices.shopId, shopId));
  }
  
  async updateDeviceLastSeen(id: number): Promise<void> {
    await db.update(devices).set({ lastSeenAt: new Date() }).where(eq(devices.id, id));
  }
  
  // Reward Configs
  async createRewardConfig(config: InsertRewardConfig): Promise<RewardConfig> {
    const [rewardConfig] = await db.insert(rewardConfigs).values(config).returning();
    return rewardConfig;
  }
  
  async getRewardConfig(shopId: number): Promise<RewardConfig | undefined> {
    const [config] = await db.select().from(rewardConfigs).where(eq(rewardConfigs.shopId, shopId));
    return config;
  }
  
  async updateRewardConfig(shopId: number, config: Partial<InsertRewardConfig>): Promise<RewardConfig | undefined> {
    const [updated] = await db.update(rewardConfigs).set(config).where(eq(rewardConfigs.shopId, shopId)).returning();
    return updated;
  }
  
  // Drop Events
  async createDropEvent(event: InsertDropEvent): Promise<DropEvent> {
    const [dropEvent] = await db.insert(dropEvents).values(event).returning();
    return dropEvent;
  }
  
  async getDropEventsByShop(shopId: number): Promise<DropEvent[]> {
    return await db.select().from(dropEvents).where(eq(dropEvents.shopId, shopId)).orderBy(desc(dropEvents.createdAt));
  }
  
  async getTodayDropEventsByDevice(deviceId: number): Promise<DropEvent[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return await db.select().from(dropEvents).where(
      and(eq(dropEvents.deviceId, deviceId), gte(dropEvents.createdAt, today))
    );
  }
  
  async getDropEvent(id: number): Promise<DropEvent | undefined> {
    const [event] = await db.select().from(dropEvents).where(eq(dropEvents.id, id));
    return event;
  }
  
  // Claim Tokens
  async createClaimToken(tokenHash: string, dropEventId: number, expiresAt: Date): Promise<ClaimToken> {
    const [token] = await db.insert(claimTokens).values({ tokenHash, dropEventId, expiresAt }).returning();
    return token;
  }
  
  async getClaimToken(tokenHash: string): Promise<ClaimToken | undefined> {
    const [token] = await db.select().from(claimTokens).where(eq(claimTokens.tokenHash, tokenHash));
    return token;
  }
  
  async claimToken(tokenHash: string, userId: string): Promise<boolean> {
    const [token] = await db.update(claimTokens)
      .set({ claimedAt: new Date(), claimedByUserId: userId })
      .where(and(
        eq(claimTokens.tokenHash, tokenHash),
        sql`${claimTokens.claimedAt} IS NULL`,
        gte(claimTokens.expiresAt, new Date())
      ))
      .returning();
    return !!token;
  }
  
  // Customers
  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const [newCustomer] = await db.insert(customers).values(customer).returning();
    return newCustomer;
  }
  
  async getCustomerByUserId(userId: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.userId, userId));
    return customer;
  }
  
  // Wallets
  async createWallet(customerId: number): Promise<Wallet> {
    const [wallet] = await db.insert(wallets).values({ customerId }).returning();
    return wallet;
  }
  
  async getWallet(customerId: number): Promise<Wallet | undefined> {
    const [wallet] = await db.select().from(wallets).where(eq(wallets.customerId, customerId));
    return wallet;
  }
  
  async updateWalletBalance(customerId: number, pointsDelta: number, isEarning: boolean): Promise<Wallet | undefined> {
    const wallet = await this.getWallet(customerId);
    if (!wallet) return undefined;
    
    const newBalance = wallet.pointsBalance + pointsDelta;
    const updateData: any = { pointsBalance: newBalance };
    if (isEarning && pointsDelta > 0) {
      updateData.lifetimeEarned = wallet.lifetimeEarned + pointsDelta;
    }
    
    const [updated] = await db.update(wallets).set(updateData).where(eq(wallets.customerId, customerId)).returning();
    return updated;
  }
  
  // Transactions
  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [tx] = await db.insert(transactions).values(transaction).returning();
    return tx;
  }
  
  async getTransactionsByWallet(walletId: number): Promise<Transaction[]> {
    return await db.select().from(transactions).where(eq(transactions.walletId, walletId)).orderBy(desc(transactions.createdAt));
  }
  
  // Store Items
  async createStoreItem(item: InsertStoreItem): Promise<StoreItem> {
    const [storeItem] = await db.insert(storeItems).values(item).returning();
    return storeItem;
  }
  
  async getStoreItem(id: number): Promise<StoreItem | undefined> {
    const [item] = await db.select().from(storeItems).where(eq(storeItems.id, id));
    return item;
  }
  
  async getAllStoreItems(): Promise<StoreItem[]> {
    return await db.select().from(storeItems).where(eq(storeItems.active, true));
  }
  
  async updateStoreItem(id: number, item: Partial<InsertStoreItem>): Promise<StoreItem | undefined> {
    const [updated] = await db.update(storeItems).set(item).where(eq(storeItems.id, id)).returning();
    return updated;
  }
  
  // Redemptions
  async createRedemption(redemption: InsertRedemption): Promise<Redemption> {
    const [r] = await db.insert(redemptions).values(redemption).returning();
    return r;
  }
  
  async getRedemption(id: number): Promise<Redemption | undefined> {
    const [r] = await db.select().from(redemptions).where(eq(redemptions.id, id));
    return r;
  }
  
  async getRedemptionsByCustomer(customerId: number): Promise<Redemption[]> {
    return await db.select().from(redemptions).where(eq(redemptions.customerId, customerId)).orderBy(desc(redemptions.createdAt));
  }
  
  async getAllRedemptions(): Promise<Redemption[]> {
    return await db.select().from(redemptions).orderBy(desc(redemptions.createdAt));
  }
  
  async updateRedemptionStatus(id: number, status: string): Promise<Redemption | undefined> {
    const updateData: any = { status };
    if (status === 'FULFILLED') updateData.fulfilledAt = new Date();
    const [r] = await db.update(redemptions).set(updateData).where(eq(redemptions.id, id)).returning();
    return r;
  }
  
  // Pickup Requests
  async createPickupRequest(request: InsertPickupRequest): Promise<PickupRequest> {
    const [pr] = await db.insert(pickupRequests).values(request).returning();
    return pr;
  }
  
  async getPickupRequestsByShop(shopId: number): Promise<PickupRequest[]> {
    return await db.select().from(pickupRequests).where(eq(pickupRequests.shopId, shopId)).orderBy(desc(pickupRequests.createdAt));
  }
  
  async getAllPickupRequests(): Promise<PickupRequest[]> {
    return await db.select().from(pickupRequests).orderBy(desc(pickupRequests.createdAt));
  }

  // Volunteers
  async createVolunteer(insertVolunteer: InsertVolunteer): Promise<Volunteer> {
    const [volunteer] = await db.insert(volunteers).values(insertVolunteer).returning();
    return volunteer;
  }

  async getAllVolunteers(): Promise<Volunteer[]> {
    return await db.select().from(volunteers).orderBy(desc(volunteers.createdAt));
  }

  // Bins
  async createBin(bin: InsertBin): Promise<Bin> {
    const [newBin] = await db.insert(bins).values(bin).returning();
    return newBin;
  }

  async getBin(id: number): Promise<Bin | undefined> {
    const [bin] = await db.select().from(bins).where(eq(bins.id, id));
    return bin;
  }

  async getBinsByShop(shopId: number): Promise<Bin[]> {
    return await db.select().from(bins).where(eq(bins.shopId, shopId)).orderBy(desc(bins.createdAt));
  }

  async getAllBins(): Promise<Bin[]> {
    return await db.select().from(bins).orderBy(desc(bins.createdAt));
  }

  async getAllBinsWithDevice(): Promise<(Bin & { device?: { id: number; name: string; status: string; lastSeenAt: Date | null } })[]> {
    const allBins = await db.select().from(bins).orderBy(desc(bins.createdAt));
    const allDevices = await db.select().from(devices);
    
    return allBins.map(bin => ({
      ...bin,
      device: bin.deviceId ? allDevices.find(d => d.id === bin.deviceId) : undefined,
    }));
  }

  async deleteBin(id: number): Promise<boolean> {
    const result = await db.delete(bins).where(eq(bins.id, id)).returning();
    return result.length > 0;
  }

  async updateBinStatus(id: number, status: string): Promise<Bin | undefined> {
    const [bin] = await db.update(bins).set({ status: status as any, lastSeenAt: new Date() }).where(eq(bins.id, id)).returning();
    return bin;
  }

  async updateBinSensorData(id: number, data: { fillLevel?: number; lastTemperature?: number; lastAirQuality?: number; lastVocAnalog?: number; lastVocDigital?: boolean; vapeCount?: number }): Promise<Bin | undefined> {
    const [bin] = await db.update(bins).set({ ...data, lastSeenAt: new Date(), status: 'ONLINE' as any }).where(eq(bins.id, id)).returning();
    return bin;
  }

  async getBinByDeviceId(deviceId: number): Promise<Bin | undefined> {
    const [bin] = await db.select().from(bins).where(eq(bins.deviceId, deviceId));
    return bin;
  }

  // Bin Readings
  async createBinReading(reading: InsertBinReading): Promise<BinReading> {
    const [newReading] = await db.insert(binReadings).values(reading).returning();
    return newReading;
  }

  async getBinReadings(binId: number, limit: number = 100): Promise<BinReading[]> {
    return await db.select().from(binReadings).where(eq(binReadings.binId, binId)).orderBy(desc(binReadings.createdAt)).limit(limit);
  }

  // Fire Alerts
  async createFireAlert(alert: InsertFireAlert): Promise<FireAlert> {
    const [newAlert] = await db.insert(fireAlerts).values(alert).returning();
    return newAlert;
  }

  async getFireAlert(id: number): Promise<FireAlert | undefined> {
    const [alert] = await db.select().from(fireAlerts).where(eq(fireAlerts.id, id));
    return alert;
  }

  async getActiveFireAlerts(): Promise<FireAlert[]> {
    return await db.select().from(fireAlerts).where(eq(fireAlerts.acknowledged, false)).orderBy(desc(fireAlerts.createdAt));
  }

  async getFireAlertsByShop(shopId: number): Promise<FireAlert[]> {
    return await db.select().from(fireAlerts).where(eq(fireAlerts.shopId, shopId)).orderBy(desc(fireAlerts.createdAt));
  }

  async acknowledgeFireAlert(id: number, userId: string): Promise<FireAlert | undefined> {
    const [alert] = await db.update(fireAlerts).set({ acknowledged: true, acknowledgedAt: new Date(), acknowledgedById: userId }).where(eq(fireAlerts.id, id)).returning();
    return alert;
  }

  async resolveFireAlert(id: number): Promise<FireAlert | undefined> {
    const [alert] = await db.update(fireAlerts).set({ resolvedAt: new Date() }).where(eq(fireAlerts.id, id)).returning();
    return alert;
  }

  // Shop coordinates
  async updateShopCoordinates(id: number, lat: number, lng: number): Promise<Shop | undefined> {
    const [shop] = await db.update(shops).set({ latitude: lat, longitude: lng }).where(eq(shops.id, id)).returning();
    return shop;
  }

  async getVerifiedShopsWithCoordinates(): Promise<Shop[]> {
    return await db.select().from(shops).where(and(eq(shops.status, 'VERIFIED'), sql`${shops.latitude} IS NOT NULL AND ${shops.longitude} IS NOT NULL`));
  }

  // Staff check
  async hasAnyStaff(): Promise<boolean> {
    const [result] = await db.select().from(users).where(eq(users.role, 'STAFF')).limit(1);
    return !!result;
  }
}

export const storage = new DatabaseStorage();
