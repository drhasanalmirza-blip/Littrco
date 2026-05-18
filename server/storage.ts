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
  type Mailbox,
  type InsertMailbox,
  type InternalMessage,
  type InsertInternalMessage,
  type PairRequest,
  type InsertPairRequest,
  type RewardSession,
  type InsertRewardSession,
  type DeviceConfig,
  type InsertDeviceConfig,
  type PartnerPointsLedger,
  type InsertPartnerPointsLedger,
  type PartnerRedemption,
  type InsertPartnerRedemption,
  type SurveyResponse,
  type InsertSurveyResponse,
  type BinCapabilities,
  type InsertBinCapabilities,
  type Drop,
  type InsertDrop,
  type DropImage,
  type InsertDropImage,
  type AiJob,
  type InsertAiJob,
  type Appeal,
  type InsertAppeal,
  type Brand,
  type InsertBrand,
  type Subtype,
  type InsertSubtype,
  type Flavor,
  type InsertFlavor,
  type VeriscanSession,
  type InsertVeriscanSession,
  type VeriscanItem,
  type InsertVeriscanItem,
  type ClassifierCorrection,
  type InsertClassifierCorrection,
  type ClassifierCostLog,
  type InsertClassifierCostLog,
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
  mailboxes,
  internalMessages,
  pairRequests,
  rewardSessions,
  deviceConfigs,
  partnerPointsLedger,
  partnerRedemptions,
  surveyResponses,
  binCapabilities,
  drops,
  dropImages,
  aiJobs,
  appeals,
  brands,
  subtypes,
  flavors,
  veriscanSessions,
  veriscanItems,
  classifierCorrections,
  classifierCostLog,
} from "@shared/schema";
import { db } from "./db";
import { desc, eq, and, gte, sql, lt, inArray } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(userId: string, newPasswordHash: string): Promise<User | undefined>;
  updateUserRole(userId: string, role: string): Promise<User | undefined>;
  updateUserTheme(userId: string, theme: string): Promise<void>;
  deleteUser(userId: string): Promise<boolean>;
  
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
  getShopMembersByUserId(userId: string): Promise<ShopMember[]>;
  deleteShopMember(userId: string, shopId: number): Promise<boolean>;
  
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
  createDropEventIdempotent(event: InsertDropEvent): Promise<DropEvent | null>;
  processDropAtomic(args: {
    deviceId: number;
    shopId: number;
    eventId: string | null;
    points: number;
    sessionWindowSec: number;
    generateToken: () => string;
  }): Promise<{ duplicate: boolean; dropEvent: DropEvent; session: RewardSession }>;
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
  updateBinSetup(id: number, data: { mode?: "demo" | "normal"; cameraModel?: "none" | "s3cam" | "android_cam"; name?: string; status?: string }): Promise<Bin | undefined>;
  listPendingSetupBins(): Promise<Bin[]>;
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
  
  // Mailboxes
  createMailbox(mailbox: InsertMailbox): Promise<Mailbox>;
  getMailbox(id: number): Promise<Mailbox | undefined>;
  getMailboxByEmail(email: string): Promise<Mailbox | undefined>;
  getMailboxByUserId(userId: string): Promise<Mailbox | undefined>;
  getAllMailboxes(): Promise<Mailbox[]>;
  updateMailbox(id: number, data: Partial<InsertMailbox>): Promise<Mailbox | undefined>;
  deleteMailbox(id: number): Promise<boolean>;
  
  // Internal Messages
  createInternalMessage(message: InsertInternalMessage): Promise<InternalMessage>;
  getInternalMessage(id: number): Promise<InternalMessage | undefined>;
  getInboxMessages(mailboxId: number): Promise<InternalMessage[]>;
  getSentMessages(mailboxId: number): Promise<InternalMessage[]>;
  markMessageAsRead(id: number): Promise<InternalMessage | undefined>;
  archiveMessage(id: number): Promise<InternalMessage | undefined>;
  getUnreadCount(mailboxId: number): Promise<number>;

  // V2 Smart Bin API
  getDeviceByUid(uid: string): Promise<Device | undefined>;
  getAllDevices(): Promise<Device[]>;
  updateDevice(id: number, data: Partial<InsertDevice>): Promise<Device | undefined>;
  getDropEventByDeviceEventId(deviceEventId: string): Promise<DropEvent | undefined>;

  // Pair Requests
  createPairRequest(request: InsertPairRequest): Promise<PairRequest>;
  getPairRequest(id: number): Promise<PairRequest | undefined>;
  getPairRequestByCode(code: string): Promise<PairRequest | undefined>;
  getPairRequestByUid(uid: string): Promise<PairRequest | undefined>;
  getActivePairRequestByUid(uid: string): Promise<PairRequest | undefined>;
  claimPairRequest(id: number, userId: string, shopId: number, deviceId: number): Promise<PairRequest | undefined>;
  getAllPairRequests(): Promise<PairRequest[]>;

  // Reward Sessions
  createRewardSession(session: InsertRewardSession): Promise<RewardSession>;
  getRewardSession(id: number): Promise<RewardSession | undefined>;
  getRewardSessionByToken(token: string): Promise<RewardSession | undefined>;
  getActiveRewardSession(deviceId: number): Promise<RewardSession | undefined>;
  updateRewardSession(id: number, data: Partial<RewardSession>): Promise<RewardSession | undefined>;
  expireOldSessions(): Promise<number>;
  getRewardSessionsByShop(shopId: number): Promise<RewardSession[]>;

  // Device Configs
  getDeviceConfig(shopId: number): Promise<DeviceConfig | undefined>;
  upsertDeviceConfig(config: InsertDeviceConfig): Promise<DeviceConfig>;
  updateDeviceConfig(shopId: number, data: Partial<InsertDeviceConfig>): Promise<DeviceConfig | undefined>;

  // Partner Points Ledger
  creditPartnerPoints(entry: InsertPartnerPointsLedger): Promise<PartnerPointsLedger>;
  getPartnerPointsLedger(shopId: number): Promise<PartnerPointsLedger[]>;
  getPartnerPointsTotal(shopId: number): Promise<number>;
  getAllPartnerPointsLedger(): Promise<PartnerPointsLedger[]>;

  getStoreItemsByCategory(category: string): Promise<StoreItem[]>;
  createPartnerRedemption(data: InsertPartnerRedemption): Promise<PartnerRedemption>;
  getPartnerRedemptions(shopId: number): Promise<PartnerRedemption[]>;
  getAllPartnerRedemptions(): Promise<PartnerRedemption[]>;
  updatePartnerRedemptionStatus(id: number, status: string): Promise<PartnerRedemption>;
  createSurveyResponse(data: InsertSurveyResponse): Promise<SurveyResponse>;
  getSurveyResponses(customerId: number): Promise<SurveyResponse[]>;
  getLatestSurveyByType(customerId: number, surveyType: string): Promise<SurveyResponse | undefined>;
  deductPartnerPoints(shopId: number, amount: number, reason: string): Promise<void>;

  // Activity Log
  getActivityLog(): Promise<ActivityLogEntry[]>;

  // Shops deletion
  deleteShop(id: number): Promise<boolean>;

  // ==================== CAMERA / AI / VERISCAN ====================

  // Bin Capabilities
  getBinCapabilities(binId: number): Promise<BinCapabilities | undefined>;
  listAllBinCapabilities(): Promise<BinCapabilities[]>;
  upsertBinCapabilities(data: InsertBinCapabilities): Promise<BinCapabilities>;
  updateBinCapabilities(binId: number, data: Partial<InsertBinCapabilities>): Promise<BinCapabilities | undefined>;
  getBinCapabilitiesByToken(token: string): Promise<BinCapabilities | undefined>;

  // Drops (AI-tracked)
  createDrop(data: InsertDrop): Promise<Drop>;
  getDrop(id: number): Promise<Drop | undefined>;
  getDropsByShop(shopId: number, limit?: number): Promise<Drop[]>;
  getDropsByUser(userId: string, limit?: number): Promise<Drop[]>;
  getAllDrops(limit?: number): Promise<Drop[]>;
  updateDrop(id: number, data: Partial<Drop>): Promise<Drop | undefined>;
  applyStaffCorrectionAtomic(dropId: number, update: Partial<Drop>, reversePoints: boolean): Promise<{ drop: Drop | undefined; ledgerReversed: boolean; sessionAdjusted: boolean; sessionVoided: boolean }>;

  // Drop Images
  createDropImage(data: InsertDropImage): Promise<DropImage>;
  getDropImages(dropId: number): Promise<DropImage[]>;
  getDropImageByHash(hash: string): Promise<DropImage | undefined>;

  // AI Jobs
  createAiJob(data: InsertAiJob): Promise<AiJob>;
  getAiJob(id: number): Promise<AiJob | undefined>;
  getAiJobsByDrop(dropId: number): Promise<AiJob[]>;
  updateAiJob(id: number, data: Partial<AiJob>): Promise<AiJob | undefined>;

  // Appeals
  createAppeal(data: InsertAppeal): Promise<Appeal>;
  getAppealsByDrop(dropId: number): Promise<Appeal[]>;
  getAppealsByUser(userId: string): Promise<Appeal[]>;
  getAllAppeals(): Promise<Appeal[]>;
  resolveAppeal(id: number, resolution: string, resolvedById: string): Promise<Appeal | undefined>;

  // Brands
  createBrand(data: InsertBrand): Promise<Brand>;
  getBrand(id: number): Promise<Brand | undefined>;
  getAllBrands(): Promise<Brand[]>;
  updateBrand(id: number, data: Partial<InsertBrand>): Promise<Brand | undefined>;
  deleteBrand(id: number): Promise<boolean>;

  // Subtypes
  createSubtype(data: InsertSubtype): Promise<Subtype>;
  getSubtypesByBrand(brandId: number): Promise<Subtype[]>;
  getAllSubtypes(): Promise<Subtype[]>;
  deleteSubtype(id: number): Promise<boolean>;

  // Flavors
  createFlavor(data: InsertFlavor): Promise<Flavor>;
  getAllFlavors(): Promise<Flavor[]>;
  deleteFlavor(id: number): Promise<boolean>;

  // VeriScan Sessions
  createVeriscanSession(data: InsertVeriscanSession): Promise<VeriscanSession>;
  getVeriscanSession(id: number): Promise<VeriscanSession | undefined>;
  getVeriscanSessionsByUser(userId: string): Promise<VeriscanSession[]>;
  updateVeriscanSession(id: number, data: Partial<VeriscanSession>): Promise<VeriscanSession | undefined>;

  // VeriScan Items
  createVeriscanItem(data: InsertVeriscanItem): Promise<VeriscanItem>;
  getVeriscanItem(id: number): Promise<VeriscanItem | undefined>;
  getVeriscanItemsBySession(sessionId: number): Promise<VeriscanItem[]>;
  updateVeriscanItem(id: number, data: Partial<VeriscanItem>): Promise<VeriscanItem | undefined>;

  // Classifier (Task #5)
  getDropByEventId(eventId: string): Promise<Drop | undefined>;
  updateDropByEventId(eventId: string, data: Partial<Drop>): Promise<Drop | undefined>;
  findDropImageByEventAndRole(eventId: string, imageRole: string): Promise<DropImage | undefined>;
  findOrCreateDropByEventId(eventId: string, defaults: InsertDrop): Promise<Drop>;
  createDropImageIdempotent(data: InsertDropImage): Promise<{ image: DropImage; created: boolean }>;
  linkOrphanCapturesByEventId(eventId: string, dropId: number): Promise<DropImage[]>;
  updateDropImageClassifier(imageId: number, data: Partial<DropImage>): Promise<DropImage | undefined>;
  findClassifierResultByPhash(phash: string, withinHours?: number): Promise<DropImage | undefined>;
  getClassifierCostMicrosForDay(day: string): Promise<number>;
  recordClassifierCost(data: InsertClassifierCostLog): Promise<ClassifierCostLog>;
  createClassifierCorrection(data: InsertClassifierCorrection): Promise<ClassifierCorrection>;
  getReviewQueue(limit?: number, offset?: number): Promise<Array<Drop & { images: DropImage[] }>>;
  getReviewQueueCount(): Promise<number>;
  markDropsClaimedByDropEventId(dropEventId: number): Promise<number>;
  markDropsClaimedByRewardSessionId(sessionId: number): Promise<number>;
  markDropClaimedById(dropId: number): Promise<boolean>;
}

export interface ActivityLogEntry {
  id: number;
  source: 'v1' | 'v2';
  userEmail: string;
  userId: string;
  shopName: string;
  deviceName: string;
  pointsClaimed: number;
  dropCount: number;
  claimedAt: string;
  sessionToken?: string;
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

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUserPassword(userId: string, newPasswordHash: string): Promise<User | undefined> {
    const [user] = await db.update(users).set({ passwordHash: newPasswordHash }).where(eq(users.id, userId)).returning();
    return user;
  }

  async updateUserRole(userId: string, role: string): Promise<User | undefined> {
    const [user] = await db.update(users).set({ role: role as any }).where(eq(users.id, userId)).returning();
    return user;
  }

  async updateUserTheme(userId: string, theme: string): Promise<void> {
    await db.update(users).set({ themePreference: theme }).where(eq(users.id, userId));
  }

  async deleteUser(userId: string): Promise<boolean> {
    await db.delete(sessions).where(eq(sessions.userId, userId));
    const result = await db.delete(users).where(eq(users.id, userId)).returning();
    return result.length > 0;
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

  async getShopMembersByUserId(userId: string): Promise<ShopMember[]> {
    return await db.select().from(shopMembers).where(eq(shopMembers.userId, userId));
  }

  async deleteShopMember(userId: string, shopId: number): Promise<boolean> {
    const result = await db.delete(shopMembers).where(and(eq(shopMembers.userId, userId), eq(shopMembers.shopId, shopId))).returning();
    return result.length > 0;
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

  async createDropEventIdempotent(event: InsertDropEvent): Promise<DropEvent | null> {
    if (!event.deviceEventId) {
      const [created] = await db.insert(dropEvents).values(event).returning();
      return created ?? null;
    }
    const result = await db
      .insert(dropEvents)
      .values(event)
      .onConflictDoNothing({ target: dropEvents.deviceEventId })
      .returning();
    return result[0] ?? null;
  }

  // Fully transactional drop processing (Task #6 atomicity).
  //
  // All of: dropEvent insert (idempotency key), session upsert, dropEvent
  // sessionId attach, partner-points ledger credit — happen in a single DB
  // transaction. PostgreSQL's row-level lock on the unique deviceEventId
  // index means concurrent retries with the same event_id will block on the
  // winner's transaction; when the loser unblocks it sees the committed,
  // finalized row and gets the canonical duplicate response.
  async processDropAtomic(args: {
    deviceId: number;
    shopId: number;
    eventId: string | null;
    points: number;
    sessionWindowSec: number;
    generateToken: () => string;
  }): Promise<{ duplicate: boolean; dropEvent: DropEvent; session: RewardSession }> {
    return await db.transaction(async (tx) => {
      // 0. Device-scoped advisory lock to serialize the cold-start session
      // creation race. Without this, two concurrent distinct-event requests
      // with no prior active session could both find `active=null` and
      // INSERT separate PENDING sessions (split-stack). The lock is
      // released automatically at transaction commit/rollback.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${args.deviceId})`);

      // 1. Insert dropEvent as idempotency key (if eventId provided).
      let dropEvent: DropEvent | undefined;
      let isDuplicate = false;
      if (args.eventId) {
        const inserted = await tx
          .insert(dropEvents)
          .values({
            shopId: args.shopId,
            deviceId: args.deviceId,
            deviceEventId: args.eventId,
            sessionId: null,
            pointsAwarded: args.points,
          })
          .onConflictDoNothing({ target: dropEvents.deviceEventId })
          .returning();
        if (inserted.length === 0) {
          isDuplicate = true;
          const [existing] = await tx
            .select()
            .from(dropEvents)
            .where(eq(dropEvents.deviceEventId, args.eventId));
          if (!existing) throw new Error("drop_idempotency_failed");
          dropEvent = existing;
        } else {
          dropEvent = inserted[0];
        }
      } else {
        const [created] = await tx
          .insert(dropEvents)
          .values({
            shopId: args.shopId,
            deviceId: args.deviceId,
            deviceEventId: null,
            sessionId: null,
            pointsAwarded: args.points,
          })
          .returning();
        dropEvent = created;
      }

      if (isDuplicate) {
        const [session] = dropEvent.sessionId
          ? await tx.select().from(rewardSessions).where(eq(rewardSessions.id, dropEvent.sessionId))
          : [];
        if (!session) throw new Error("drop_duplicate_missing_session");
        return { duplicate: true, dropEvent, session };
      }

      // 2. Upsert active session. Use SELECT ... FOR UPDATE to lock the row
      // so two concurrent transactions on the same device can't both read
      // the same pre-image and clobber each other; the UPDATE itself also
      // uses an atomic SQL increment (`points_total + $`) so even without
      // the lock there is no lost-update window.
      const [active] = await tx.select().from(rewardSessions).where(
        and(
          eq(rewardSessions.deviceId, args.deviceId),
          eq(rewardSessions.status, "PENDING"),
          eq(rewardSessions.voided, false),
          gte(rewardSessions.expiresAt, new Date())
        )
      ).orderBy(desc(rewardSessions.createdAt)).limit(1).for("update");

      let session: RewardSession;
      const newExpiry = new Date(Date.now() + args.sessionWindowSec * 1000);
      if (active) {
        const [updated] = await tx
          .update(rewardSessions)
          .set({
            pointsTotal: sql<number>`${rewardSessions.pointsTotal} + ${args.points}`,
            dropCount: sql<number>`${rewardSessions.dropCount} + 1`,
            lastDropAt: new Date(),
            expiresAt: newExpiry,
          })
          .where(eq(rewardSessions.id, active.id))
          .returning();
        session = updated;
      } else {
        const [created] = await tx
          .insert(rewardSessions)
          .values({
            deviceId: args.deviceId,
            shopId: args.shopId,
            token: args.generateToken(),
            pointsTotal: args.points,
            dropCount: 1,
            lastDropAt: new Date(),
            expiresAt: newExpiry,
          })
          .returning();
        session = created;
      }

      // 3. Attach session to dropEvent.
      const [finalDropEvent] = await tx
        .update(dropEvents)
        .set({ sessionId: session.id, pointsAwarded: args.points })
        .where(eq(dropEvents.id, dropEvent.id))
        .returning();

      // 4. Credit partner ledger.
      await tx.insert(partnerPointsLedger).values({
        shopId: args.shopId,
        deviceId: args.deviceId,
        points: 1,
        reason: "drop",
        dropEventId: finalDropEvent.id,
      });

      return { duplicate: false, dropEvent: finalDropEvent, session };
    });
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
    // Preserve PENDING_SETUP — telemetry from an unconfigured bin should not auto-activate it.
    const current = await this.getBin(id);
    const nextStatus = current?.status === 'PENDING_SETUP' ? 'PENDING_SETUP' : 'ONLINE';
    const [bin] = await db.update(bins).set({ ...data, lastSeenAt: new Date(), status: nextStatus as Bin["status"] }).where(eq(bins.id, id)).returning();
    return bin;
  }

  async updateBinSetup(id: number, data: { mode?: "demo" | "normal"; cameraModel?: "none" | "s3cam" | "android_cam"; name?: string; status?: string }): Promise<Bin | undefined> {
    const patch: Partial<typeof bins.$inferInsert> = { setupCompletedAt: new Date() };
    if (data.mode) patch.mode = data.mode;
    if (data.cameraModel) patch.cameraModel = data.cameraModel;
    if (data.name) patch.name = data.name;
    if (data.status) patch.status = data.status as Bin["status"];
    const [bin] = await db.update(bins).set(patch).where(eq(bins.id, id)).returning();
    return bin;
  }

  async listPendingSetupBins(): Promise<Bin[]> {
    return await db.select().from(bins).where(eq(bins.status, 'PENDING_SETUP')).orderBy(desc(bins.createdAt));
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

  // Mailboxes
  async createMailbox(mailbox: InsertMailbox): Promise<Mailbox> {
    const [newMailbox] = await db.insert(mailboxes).values(mailbox).returning();
    return newMailbox;
  }

  async getMailbox(id: number): Promise<Mailbox | undefined> {
    const [mailbox] = await db.select().from(mailboxes).where(eq(mailboxes.id, id));
    return mailbox;
  }

  async getMailboxByEmail(email: string): Promise<Mailbox | undefined> {
    const [mailbox] = await db.select().from(mailboxes).where(eq(mailboxes.emailAddress, email));
    return mailbox;
  }

  async getMailboxByUserId(userId: string): Promise<Mailbox | undefined> {
    const [mailbox] = await db.select().from(mailboxes).where(eq(mailboxes.userId, userId));
    return mailbox;
  }

  async getAllMailboxes(): Promise<Mailbox[]> {
    return await db.select().from(mailboxes).orderBy(desc(mailboxes.createdAt));
  }

  async updateMailbox(id: number, data: Partial<InsertMailbox>): Promise<Mailbox | undefined> {
    const [updated] = await db.update(mailboxes).set(data).where(eq(mailboxes.id, id)).returning();
    return updated;
  }

  async deleteMailbox(id: number): Promise<boolean> {
    const result = await db.delete(mailboxes).where(eq(mailboxes.id, id)).returning();
    return result.length > 0;
  }

  // Internal Messages
  async createInternalMessage(message: InsertInternalMessage): Promise<InternalMessage> {
    const [newMessage] = await db.insert(internalMessages).values(message).returning();
    return newMessage;
  }

  async getInternalMessage(id: number): Promise<InternalMessage | undefined> {
    const [message] = await db.select().from(internalMessages).where(eq(internalMessages.id, id));
    return message;
  }

  async getInboxMessages(mailboxId: number): Promise<InternalMessage[]> {
    return await db.select().from(internalMessages)
      .where(and(eq(internalMessages.toMailboxId, mailboxId), eq(internalMessages.isArchived, false)))
      .orderBy(desc(internalMessages.sentAt));
  }

  async getSentMessages(mailboxId: number): Promise<InternalMessage[]> {
    return await db.select().from(internalMessages)
      .where(and(eq(internalMessages.fromMailboxId, mailboxId), eq(internalMessages.isOutbound, true)))
      .orderBy(desc(internalMessages.sentAt));
  }

  async markMessageAsRead(id: number): Promise<InternalMessage | undefined> {
    const [message] = await db.update(internalMessages).set({ isRead: true }).where(eq(internalMessages.id, id)).returning();
    return message;
  }

  async archiveMessage(id: number): Promise<InternalMessage | undefined> {
    const [message] = await db.update(internalMessages).set({ isArchived: true }).where(eq(internalMessages.id, id)).returning();
    return message;
  }

  async getUnreadCount(mailboxId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(internalMessages)
      .where(and(eq(internalMessages.toMailboxId, mailboxId), eq(internalMessages.isRead, false), eq(internalMessages.isArchived, false)));
    return Number(result[0]?.count || 0);
  }

  // ==================== V2 Smart Bin API ====================

  async getDeviceByUid(uid: string): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.uid, uid));
    return device;
  }

  async getAllDevices(): Promise<Device[]> {
    return await db.select().from(devices).orderBy(desc(devices.createdAt));
  }

  async updateDevice(id: number, data: Partial<InsertDevice>): Promise<Device | undefined> {
    const [device] = await db.update(devices).set(data).where(eq(devices.id, id)).returning();
    return device;
  }

  async getDropEventByDeviceEventId(deviceEventId: string): Promise<DropEvent | undefined> {
    const [event] = await db.select().from(dropEvents).where(eq(dropEvents.deviceEventId, deviceEventId));
    return event;
  }

  // Pair Requests
  async createPairRequest(request: InsertPairRequest): Promise<PairRequest> {
    const [pr] = await db.insert(pairRequests).values(request).returning();
    return pr;
  }

  async getPairRequest(id: number): Promise<PairRequest | undefined> {
    const [pr] = await db.select().from(pairRequests).where(eq(pairRequests.id, id));
    return pr;
  }

  async getPairRequestByCode(code: string): Promise<PairRequest | undefined> {
    const [pr] = await db.select().from(pairRequests).where(eq(pairRequests.pairCode, code));
    return pr;
  }

  async getPairRequestByUid(uid: string): Promise<PairRequest | undefined> {
    const [pr] = await db.select().from(pairRequests).where(eq(pairRequests.uid, uid)).orderBy(desc(pairRequests.createdAt)).limit(1);
    return pr;
  }

  async getActivePairRequestByUid(uid: string): Promise<PairRequest | undefined> {
    const [pr] = await db.select().from(pairRequests).where(
      and(
        eq(pairRequests.uid, uid),
        eq(pairRequests.claimed, false),
        gte(pairRequests.expiresAt, new Date())
      )
    ).orderBy(desc(pairRequests.createdAt)).limit(1);
    return pr;
  }

  async claimPairRequest(id: number, userId: string, shopId: number, deviceId: number): Promise<PairRequest | undefined> {
    // Race-safe: only claim if not already claimed. Concurrent staff assigns
    // will see one row updated and the other get `undefined`.
    const [pr] = await db.update(pairRequests).set({
      claimed: true,
      claimedByUserId: userId,
      shopId,
      deviceId,
    }).where(and(eq(pairRequests.id, id), eq(pairRequests.claimed, false))).returning();
    return pr;
  }

  async getAllPairRequests(): Promise<PairRequest[]> {
    return await db.select().from(pairRequests).orderBy(desc(pairRequests.createdAt));
  }

  // Reward Sessions
  async createRewardSession(session: InsertRewardSession): Promise<RewardSession> {
    const [rs] = await db.insert(rewardSessions).values(session).returning();
    return rs;
  }

  async getRewardSession(id: number): Promise<RewardSession | undefined> {
    const [rs] = await db.select().from(rewardSessions).where(eq(rewardSessions.id, id));
    return rs;
  }

  async getRewardSessionByToken(token: string): Promise<RewardSession | undefined> {
    const [rs] = await db.select().from(rewardSessions).where(eq(rewardSessions.token, token));
    return rs;
  }

  async getActiveRewardSession(deviceId: number): Promise<RewardSession | undefined> {
    const [rs] = await db.select().from(rewardSessions).where(
      and(
        eq(rewardSessions.deviceId, deviceId),
        eq(rewardSessions.status, "PENDING"),
        eq(rewardSessions.voided, false),
        gte(rewardSessions.expiresAt, new Date())
      )
    ).orderBy(desc(rewardSessions.createdAt)).limit(1);
    return rs;
  }

  async updateRewardSession(id: number, data: Partial<RewardSession>): Promise<RewardSession | undefined> {
    const [rs] = await db.update(rewardSessions).set(data as any).where(eq(rewardSessions.id, id)).returning();
    return rs;
  }

  async expireOldSessions(): Promise<number> {
    const result = await db.update(rewardSessions)
      .set({ status: "EXPIRED" as any, voided: true })
      .where(
        and(
          eq(rewardSessions.status, "PENDING"),
          eq(rewardSessions.voided, false),
          lt(rewardSessions.expiresAt, new Date())
        )
      )
      .returning();
    return result.length;
  }

  async getRewardSessionsByShop(shopId: number): Promise<RewardSession[]> {
    return await db.select().from(rewardSessions).where(eq(rewardSessions.shopId, shopId)).orderBy(desc(rewardSessions.createdAt));
  }

  // Device Configs
  async getDeviceConfig(shopId: number): Promise<DeviceConfig | undefined> {
    const [config] = await db.select().from(deviceConfigs).where(eq(deviceConfigs.shopId, shopId));
    return config;
  }

  async upsertDeviceConfig(config: InsertDeviceConfig): Promise<DeviceConfig> {
    const existing = await this.getDeviceConfig(config.shopId);
    if (existing) {
      const [updated] = await db.update(deviceConfigs).set(config).where(eq(deviceConfigs.shopId, config.shopId)).returning();
      return updated;
    }
    const [created] = await db.insert(deviceConfigs).values(config).returning();
    return created;
  }

  async updateDeviceConfig(shopId: number, data: Partial<InsertDeviceConfig>): Promise<DeviceConfig | undefined> {
    const [updated] = await db.update(deviceConfigs).set({ ...data, updatedAt: new Date() } as any).where(eq(deviceConfigs.shopId, shopId)).returning();
    return updated;
  }

  // Partner Points Ledger
  async creditPartnerPoints(entry: InsertPartnerPointsLedger): Promise<PartnerPointsLedger> {
    const [ledgerEntry] = await db.insert(partnerPointsLedger).values(entry).returning();
    return ledgerEntry;
  }

  async getPartnerPointsLedger(shopId: number): Promise<PartnerPointsLedger[]> {
    return await db.select().from(partnerPointsLedger).where(eq(partnerPointsLedger.shopId, shopId)).orderBy(desc(partnerPointsLedger.createdAt));
  }

  async getPartnerPointsTotal(shopId: number): Promise<number> {
    const result = await db.select({ total: sql<number>`COALESCE(SUM(${partnerPointsLedger.points}), 0)` })
      .from(partnerPointsLedger).where(eq(partnerPointsLedger.shopId, shopId));
    return Number(result[0]?.total || 0);
  }

  async getAllPartnerPointsLedger(): Promise<PartnerPointsLedger[]> {
    return await db.select().from(partnerPointsLedger).orderBy(desc(partnerPointsLedger.createdAt));
  }

  async getStoreItemsByCategory(category: string): Promise<StoreItem[]> {
    return await db.select().from(storeItems).where(and(eq(storeItems.category, category), eq(storeItems.active, true)));
  }

  async createPartnerRedemption(data: InsertPartnerRedemption): Promise<PartnerRedemption> {
    const [redemption] = await db.insert(partnerRedemptions).values(data).returning();
    return redemption;
  }

  async getPartnerRedemptions(shopId: number): Promise<PartnerRedemption[]> {
    return await db.select().from(partnerRedemptions).where(eq(partnerRedemptions.shopId, shopId)).orderBy(desc(partnerRedemptions.createdAt));
  }

  async getAllPartnerRedemptions(): Promise<PartnerRedemption[]> {
    return await db.select().from(partnerRedemptions).orderBy(desc(partnerRedemptions.createdAt));
  }

  async updatePartnerRedemptionStatus(id: number, status: string): Promise<PartnerRedemption> {
    const [updated] = await db.update(partnerRedemptions)
      .set({ status: status as any, fulfilledAt: status === 'FULFILLED' ? new Date() : undefined })
      .where(eq(partnerRedemptions.id, id))
      .returning();
    return updated;
  }

  async createSurveyResponse(data: InsertSurveyResponse): Promise<SurveyResponse> {
    const [response] = await db.insert(surveyResponses).values(data).returning();
    return response;
  }

  async getSurveyResponses(customerId: number): Promise<SurveyResponse[]> {
    return await db.select().from(surveyResponses).where(eq(surveyResponses.customerId, customerId)).orderBy(desc(surveyResponses.createdAt));
  }

  async getLatestSurveyByType(customerId: number, surveyType: string): Promise<SurveyResponse | undefined> {
    const [response] = await db.select().from(surveyResponses)
      .where(and(eq(surveyResponses.customerId, customerId), eq(surveyResponses.surveyType, surveyType)))
      .orderBy(desc(surveyResponses.createdAt))
      .limit(1);
    return response;
  }

  async deductPartnerPoints(shopId: number, amount: number, reason: string): Promise<void> {
    await db.insert(partnerPointsLedger).values({
      shopId,
      points: -amount,
      reason,
    });
  }

  async getActivityLog(): Promise<ActivityLogEntry[]> {
    const v2Results = await db
      .select({
        id: rewardSessions.id,
        userEmail: users.email,
        userId: rewardSessions.claimedByUserId,
        shopName: shops.name,
        deviceName: devices.name,
        pointsClaimed: rewardSessions.pointsTotal,
        dropCount: rewardSessions.dropCount,
        claimedAt: rewardSessions.claimedAt,
        sessionToken: rewardSessions.token,
      })
      .from(rewardSessions)
      .innerJoin(users, eq(rewardSessions.claimedByUserId, users.id))
      .innerJoin(shops, eq(rewardSessions.shopId, shops.id))
      .innerJoin(devices, eq(rewardSessions.deviceId, devices.id))
      .where(eq(rewardSessions.status, 'CLAIMED'));

    const v1Results = await db
      .select({
        id: claimTokens.id,
        userEmail: users.email,
        userId: claimTokens.claimedByUserId,
        shopName: shops.name,
        deviceName: devices.name,
        pointsClaimed: dropEvents.pointsAwarded,
        claimedAt: claimTokens.claimedAt,
      })
      .from(claimTokens)
      .innerJoin(dropEvents, eq(claimTokens.dropEventId, dropEvents.id))
      .innerJoin(users, eq(claimTokens.claimedByUserId, users.id))
      .innerJoin(shops, eq(dropEvents.shopId, shops.id))
      .innerJoin(devices, eq(dropEvents.deviceId, devices.id))
      .where(sql`${claimTokens.claimedAt} IS NOT NULL`);

    const combined: ActivityLogEntry[] = [
      ...v2Results.map(r => ({
        id: r.id,
        source: 'v2' as const,
        userEmail: r.userEmail,
        userId: r.userId!,
        shopName: r.shopName,
        deviceName: r.deviceName,
        pointsClaimed: r.pointsClaimed,
        dropCount: r.dropCount,
        claimedAt: r.claimedAt!.toISOString(),
        sessionToken: r.sessionToken,
      })),
      ...v1Results.map(r => ({
        id: r.id,
        source: 'v1' as const,
        userEmail: r.userEmail,
        userId: r.userId!,
        shopName: r.shopName,
        deviceName: r.deviceName,
        pointsClaimed: r.pointsClaimed,
        dropCount: 1,
        claimedAt: r.claimedAt!.toISOString(),
      })),
    ];

    combined.sort((a, b) => new Date(b.claimedAt).getTime() - new Date(a.claimedAt).getTime());
    return combined;
  }

  async deleteShop(id: number): Promise<boolean> {
    const result = await db.delete(shops).where(eq(shops.id, id)).returning();
    return result.length > 0;
  }

  // ==================== CAMERA / AI / VERISCAN ====================

  async getBinCapabilities(binId: number): Promise<BinCapabilities | undefined> {
    const [cap] = await db.select().from(binCapabilities).where(eq(binCapabilities.binId, binId));
    return cap;
  }

  async listAllBinCapabilities(): Promise<BinCapabilities[]> {
    return db.select().from(binCapabilities);
  }

  async upsertBinCapabilities(data: InsertBinCapabilities): Promise<BinCapabilities> {
    const existing = await this.getBinCapabilities(data.binId);
    if (existing) {
      const [updated] = await db.update(binCapabilities).set({ ...data, updatedAt: new Date() }).where(eq(binCapabilities.binId, data.binId)).returning();
      return updated;
    }
    const [created] = await db.insert(binCapabilities).values(data).returning();
    return created;
  }

  async updateBinCapabilities(binId: number, data: Partial<InsertBinCapabilities>): Promise<BinCapabilities | undefined> {
    const [updated] = await db.update(binCapabilities).set({ ...data, updatedAt: new Date() }).where(eq(binCapabilities.binId, binId)).returning();
    return updated;
  }

  async getBinCapabilitiesByToken(token: string): Promise<BinCapabilities | undefined> {
    const [cap] = await db.select().from(binCapabilities).where(eq(binCapabilities.moduleToken, token));
    return cap;
  }

  async createDrop(data: InsertDrop): Promise<Drop> {
    const [drop] = await db.insert(drops).values(data).returning();
    return drop;
  }

  async getDrop(id: number): Promise<Drop | undefined> {
    const [drop] = await db.select().from(drops).where(eq(drops.id, id));
    return drop;
  }

  async getDropsByShop(shopId: number, limit = 100): Promise<Drop[]> {
    return db.select().from(drops).where(eq(drops.shopId, shopId)).orderBy(desc(drops.createdAt)).limit(limit);
  }

  async getDropsByUser(userId: string, limit = 100): Promise<Drop[]> {
    return db.select().from(drops).where(eq(drops.userId, userId)).orderBy(desc(drops.createdAt)).limit(limit);
  }

  async getAllDrops(limit = 200): Promise<Drop[]> {
    return db.select().from(drops).orderBy(desc(drops.createdAt)).limit(limit);
  }

  async updateDrop(id: number, data: Partial<Drop>): Promise<Drop | undefined> {
    const [updated] = await db.update(drops).set(data).where(eq(drops.id, id)).returning();
    return updated;
  }

  async applyStaffCorrectionAtomic(
    dropId: number,
    update: Partial<Drop>,
    reversePoints: boolean,
  ): Promise<{ drop: Drop | undefined; ledgerReversed: boolean; sessionAdjusted: boolean; sessionVoided: boolean }> {
    return await db.transaction(async (tx) => {
      const [updatedDrop] = await tx.update(drops).set(update).where(eq(drops.id, dropId)).returning();

      let ledgerReversed = false;
      let sessionAdjusted = false;
      let sessionVoided = false;

      if (reversePoints && updatedDrop?.dropEventId) {
        const [dropEvent] = await tx.select().from(dropEvents).where(eq(dropEvents.id, updatedDrop.dropEventId));

        if (dropEvent) {
          // Idempotency guard: only insert a reversal row if one doesn't already
          // exist for this dropEventId. Prevents double-reversal when corrections
          // are toggled back and forth (accepted→denied→accepted→denied).
          const [existing] = await tx.select({ id: partnerPointsLedger.id })
            .from(partnerPointsLedger)
            .where(
              and(
                eq(partnerPointsLedger.dropEventId, dropEvent.id),
                eq(partnerPointsLedger.reason, "correction_reversal"),
              ),
            )
            .limit(1);

          if (!existing) {
            // Derive the reversal amount from the original credit row so the
            // reversal is always the exact inverse of what was credited, even
            // if partner credit amounts change in the future.
            const [originalCredit] = await tx.select({ points: partnerPointsLedger.points })
              .from(partnerPointsLedger)
              .where(
                and(
                  eq(partnerPointsLedger.dropEventId, dropEvent.id),
                  eq(partnerPointsLedger.reason, "drop"),
                ),
              )
              .limit(1);
            const reversalPoints = originalCredit ? -originalCredit.points : -1;

            await tx.insert(partnerPointsLedger).values({
              shopId: dropEvent.shopId,
              deviceId: dropEvent.deviceId,
              points: reversalPoints,
              reason: "correction_reversal",
              dropEventId: dropEvent.id,
            });
            ledgerReversed = true;

            if (dropEvent.sessionId) {
              const [session] = await tx.select().from(rewardSessions)
                .where(eq(rewardSessions.id, dropEvent.sessionId))
                .for("update");

              if (session && session.status === "PENDING" && !session.voided) {
                const pointsToDeduct = dropEvent.pointsAwarded || 1;
                const newPoints = session.pointsTotal - pointsToDeduct;
                const newCount = session.dropCount - 1;

                const sessionStatus: "PENDING" | "CLAIMED" | "EXPIRED" = "EXPIRED";
                if (newCount <= 0 || newPoints <= 0) {
                  await tx.update(rewardSessions)
                    .set({ voided: true, status: sessionStatus, pointsTotal: 0, dropCount: 0 })
                    .where(eq(rewardSessions.id, session.id));
                  sessionVoided = true;
                } else {
                  await tx.update(rewardSessions)
                    .set({ pointsTotal: newPoints, dropCount: newCount })
                    .where(eq(rewardSessions.id, session.id));
                  sessionAdjusted = true;
                }
              }
            }
          }
        }
      }

      return { drop: updatedDrop, ledgerReversed, sessionAdjusted, sessionVoided };
    });
  }

  async createDropImage(data: InsertDropImage): Promise<DropImage> {
    const [img] = await db.insert(dropImages).values(data).returning();
    return img;
  }

  async getDropImages(dropId: number): Promise<DropImage[]> {
    return db.select().from(dropImages).where(eq(dropImages.dropId, dropId)).orderBy(dropImages.createdAt);
  }

  async getDropImageByHash(hash: string): Promise<DropImage | undefined> {
    const [img] = await db.select().from(dropImages).where(eq(dropImages.hash, hash));
    return img;
  }

  async createAiJob(data: InsertAiJob): Promise<AiJob> {
    const [job] = await db.insert(aiJobs).values(data).returning();
    return job;
  }

  async getAiJob(id: number): Promise<AiJob | undefined> {
    const [job] = await db.select().from(aiJobs).where(eq(aiJobs.id, id));
    return job;
  }

  async getAiJobsByDrop(dropId: number): Promise<AiJob[]> {
    return db.select().from(aiJobs).where(eq(aiJobs.dropId, dropId)).orderBy(desc(aiJobs.createdAt));
  }

  async updateAiJob(id: number, data: Partial<AiJob>): Promise<AiJob | undefined> {
    const [updated] = await db.update(aiJobs).set(data).where(eq(aiJobs.id, id)).returning();
    return updated;
  }

  async createAppeal(data: InsertAppeal): Promise<Appeal> {
    const [appeal] = await db.insert(appeals).values(data).returning();
    return appeal;
  }

  async getAppealsByDrop(dropId: number): Promise<Appeal[]> {
    return db.select().from(appeals).where(eq(appeals.dropId, dropId)).orderBy(desc(appeals.createdAt));
  }

  async getAppealsByUser(userId: string): Promise<Appeal[]> {
    return db.select().from(appeals).where(eq(appeals.userId, userId)).orderBy(desc(appeals.createdAt));
  }

  async getAllAppeals(): Promise<Appeal[]> {
    return db.select().from(appeals).orderBy(desc(appeals.createdAt));
  }

  async resolveAppeal(id: number, resolution: string, resolvedById: string): Promise<Appeal | undefined> {
    const [updated] = await db.update(appeals).set({ resolution, resolvedById, resolvedAt: new Date() }).where(eq(appeals.id, id)).returning();
    return updated;
  }

  async createBrand(data: InsertBrand): Promise<Brand> {
    const [brand] = await db.insert(brands).values(data).returning();
    return brand;
  }

  async getBrand(id: number): Promise<Brand | undefined> {
    const [brand] = await db.select().from(brands).where(eq(brands.id, id));
    return brand;
  }

  async getAllBrands(): Promise<Brand[]> {
    return db.select().from(brands).orderBy(brands.name);
  }

  async updateBrand(id: number, data: Partial<InsertBrand>): Promise<Brand | undefined> {
    const [updated] = await db.update(brands).set(data).where(eq(brands.id, id)).returning();
    return updated;
  }

  async deleteBrand(id: number): Promise<boolean> {
    const result = await db.delete(brands).where(eq(brands.id, id)).returning();
    return result.length > 0;
  }

  async createSubtype(data: InsertSubtype): Promise<Subtype> {
    const [sub] = await db.insert(subtypes).values(data).returning();
    return sub;
  }

  async getSubtypesByBrand(brandId: number): Promise<Subtype[]> {
    return db.select().from(subtypes).where(eq(subtypes.brandId, brandId)).orderBy(subtypes.name);
  }

  async getAllSubtypes(): Promise<Subtype[]> {
    return db.select().from(subtypes).orderBy(subtypes.name);
  }

  async deleteSubtype(id: number): Promise<boolean> {
    const result = await db.delete(subtypes).where(eq(subtypes.id, id)).returning();
    return result.length > 0;
  }

  async createFlavor(data: InsertFlavor): Promise<Flavor> {
    const [flavor] = await db.insert(flavors).values(data).returning();
    return flavor;
  }

  async getAllFlavors(): Promise<Flavor[]> {
    return db.select().from(flavors).orderBy(flavors.name);
  }

  async deleteFlavor(id: number): Promise<boolean> {
    const result = await db.delete(flavors).where(eq(flavors.id, id)).returning();
    return result.length > 0;
  }

  async createVeriscanSession(data: InsertVeriscanSession): Promise<VeriscanSession> {
    const [session] = await db.insert(veriscanSessions).values(data).returning();
    return session;
  }

  async getVeriscanSession(id: number): Promise<VeriscanSession | undefined> {
    const [session] = await db.select().from(veriscanSessions).where(eq(veriscanSessions.id, id));
    return session;
  }

  async getVeriscanSessionsByUser(userId: string): Promise<VeriscanSession[]> {
    return db.select().from(veriscanSessions).where(eq(veriscanSessions.userId, userId)).orderBy(desc(veriscanSessions.createdAt));
  }

  async updateVeriscanSession(id: number, data: Partial<VeriscanSession>): Promise<VeriscanSession | undefined> {
    const [updated] = await db.update(veriscanSessions).set(data).where(eq(veriscanSessions.id, id)).returning();
    return updated;
  }

  async createVeriscanItem(data: InsertVeriscanItem): Promise<VeriscanItem> {
    const [item] = await db.insert(veriscanItems).values(data).returning();
    return item;
  }

  async getVeriscanItem(id: number): Promise<VeriscanItem | undefined> {
    const [item] = await db.select().from(veriscanItems).where(eq(veriscanItems.id, id));
    return item;
  }

  async getVeriscanItemsBySession(sessionId: number): Promise<VeriscanItem[]> {
    return db.select().from(veriscanItems).where(eq(veriscanItems.sessionId, sessionId)).orderBy(veriscanItems.createdAt);
  }

  async updateVeriscanItem(id: number, data: Partial<VeriscanItem>): Promise<VeriscanItem | undefined> {
    const [updated] = await db.update(veriscanItems).set(data).where(eq(veriscanItems.id, id)).returning();
    return updated;
  }

  // ==================== Classifier (Task #5) ====================

  async getDropByEventId(eventId: string): Promise<Drop | undefined> {
    const [drop] = await db.select().from(drops).where(eq(drops.eventId, eventId));
    return drop;
  }

  async updateDropByEventId(eventId: string, data: Partial<Drop>): Promise<Drop | undefined> {
    const [updated] = await db.update(drops).set(data).where(eq(drops.eventId, eventId)).returning();
    return updated;
  }

  async findDropImageByEventAndRole(eventId: string, imageRole: string): Promise<DropImage | undefined> {
    const [img] = await db.select().from(dropImages).where(
      and(eq(dropImages.eventId, eventId), eq(dropImages.imageRole, imageRole as any)),
    );
    return img;
  }

  async findOrCreateDropByEventId(eventId: string, defaults: InsertDrop): Promise<Drop> {
    const existing = await this.getDropByEventId(eventId);
    if (existing) return existing;
    try {
      const [created] = await db.insert(drops).values(defaults).returning();
      return created;
    } catch (err: any) {
      // Race: another request created it; re-read
      const again = await this.getDropByEventId(eventId);
      if (again) return again;
      throw err;
    }
  }

  async createDropImageIdempotent(data: InsertDropImage): Promise<{ image: DropImage; created: boolean }> {
    if (data.eventId && data.imageRole) {
      const existing = await this.findDropImageByEventAndRole(data.eventId, data.imageRole);
      if (existing) return { image: existing, created: false };
    }
    try {
      const [created] = await db.insert(dropImages).values(data).returning();
      return { image: created, created: true };
    } catch (err: any) {
      if (data.eventId && data.imageRole) {
        const after = await this.findDropImageByEventAndRole(data.eventId, data.imageRole);
        if (after) return { image: after, created: false };
      }
      throw err;
    }
  }

  async linkOrphanCapturesByEventId(eventId: string, dropId: number): Promise<DropImage[]> {
    const rows = await db.select().from(dropImages).where(eq(dropImages.eventId, eventId));
    const updated: DropImage[] = [];
    for (const r of rows) {
      if (r.dropId === dropId) {
        updated.push(r);
        continue;
      }
      if (r.dropId == null) {
        const [u] = await db.update(dropImages).set({ dropId }).where(eq(dropImages.id, r.id)).returning();
        updated.push(u);
      } else {
        updated.push(r);
      }
    }
    return updated;
  }

  async updateDropImageClassifier(imageId: number, data: Partial<DropImage>): Promise<DropImage | undefined> {
    const [updated] = await db.update(dropImages).set(data).where(eq(dropImages.id, imageId)).returning();
    return updated;
  }

  async findClassifierResultByPhash(phash: string, withinHours = 24): Promise<DropImage | undefined> {
    const cutoff = new Date(Date.now() - withinHours * 60 * 60 * 1000);
    const [img] = await db
      .select()
      .from(dropImages)
      .where(
        and(
          eq(dropImages.phash, phash),
          sql`${dropImages.classifierLabel} IS NOT NULL`,
          sql`${dropImages.classifierRanAt} >= ${cutoff}`,
        ),
      )
      .orderBy(desc(dropImages.classifierRanAt))
      .limit(1);
    return img;
  }

  async getClassifierCostMicrosForDay(day: string): Promise<number> {
    const [row] = await db
      .select({ total: classifierCostLog.totalMicros })
      .from(classifierCostLog)
      .where(eq(classifierCostLog.day, day));
    return Number(row?.total || 0);
  }

  async recordClassifierCost(data: InsertClassifierCostLog): Promise<ClassifierCostLog> {
    const day = data.day;
    const addMicros = Number(data.totalMicros ?? 0);
    const addCount = Number(data.callCount ?? 1);
    const [row] = await db
      .insert(classifierCostLog)
      .values({ day, totalMicros: addMicros, callCount: addCount })
      .onConflictDoUpdate({
        target: classifierCostLog.day,
        set: {
          totalMicros: sql`${classifierCostLog.totalMicros} + ${addMicros}`,
          callCount: sql`${classifierCostLog.callCount} + ${addCount}`,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  async createClassifierCorrection(data: InsertClassifierCorrection): Promise<ClassifierCorrection> {
    const [row] = await db.insert(classifierCorrections).values(data).returning();
    return row;
  }

  // Reward-lock writer: flip rewardClaimed=true on every drop linked to a
  // claimed dropEvent. Returns row count. Idempotent — safe to call twice.
  // The Task #5 reward-lock in /api/admin/review/:dropId/correct refuses to
  // flip the verdict once rewardClaimed=true, so this MUST be called from
  // every successful customer claim path (v1/legacy) for the lock to engage.
  async markDropsClaimedByDropEventId(dropEventId: number): Promise<number> {
    const rows = await db
      .update(drops)
      .set({ rewardClaimed: true })
      .where(and(eq(drops.dropEventId, dropEventId), eq(drops.rewardClaimed, false)))
      .returning({ id: drops.id });
    return rows.length;
  }

  // v2/rewardSession claim path: a rewardSession aggregates N dropEvents
  // (dropEvents.sessionId = session.id). Flip rewardClaimed on every Task #5
  // drop linked (via drops.dropEventId) to any of those dropEvents. Returns
  // the count flipped. Idempotent and race-free — uses a single UPDATE with a
  // correlated subquery so any dropEvent inserted concurrently with the same
  // sessionId is still covered (no stale id snapshot).
  async markDropsClaimedByRewardSessionId(sessionId: number): Promise<number> {
    const rows = await db
      .update(drops)
      .set({ rewardClaimed: true })
      .where(
        and(
          eq(drops.rewardClaimed, false),
          sql`${drops.dropEventId} IN (SELECT ${dropEvents.id} FROM ${dropEvents} WHERE ${dropEvents.sessionId} = ${sessionId})`,
        ),
      )
      .returning({ id: drops.id });
    return rows.length;
  }

  async markDropClaimedById(dropId: number): Promise<boolean> {
    const rows = await db
      .update(drops)
      .set({ rewardClaimed: true })
      .where(and(eq(drops.id, dropId), eq(drops.rewardClaimed, false)))
      .returning({ id: drops.id });
    return rows.length > 0;
  }

  async getReviewQueueCount(): Promise<number> {
    const [row] = await db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(drops)
      .where(and(eq(drops.verdictReviewNeeded, true), eq(drops.verdictReady, true)));
    return Number(row?.n || 0);
  }

  async getReviewQueue(limit = 50, offset = 0): Promise<Array<Drop & { images: DropImage[] }>> {
    const rows = await db
      .select()
      .from(drops)
      .where(and(eq(drops.verdictReviewNeeded, true), eq(drops.verdictReady, true)))
      .orderBy(desc(drops.verdictDecidedAt))
      .limit(limit)
      .offset(offset);
    const result: Array<Drop & { images: DropImage[] }> = [];
    for (const d of rows) {
      const imgs = await db.select().from(dropImages).where(eq(dropImages.dropId, d.id));
      result.push({ ...d, images: imgs });
    }
    return result;
  }
}

export const storage = new DatabaseStorage();
