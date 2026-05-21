import type { Express, Request, Response } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import {
  insertContactSchema, insertLeadSchema, insertVolunteerSchema,
  insertShopSchema, insertShopRewardSchema,
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import {
  sendContactNotification, sendBinRequestNotification, sendVolunteerNotification,
} from "./email";
import bcrypt from "bcryptjs";
import {
  login, register, logout, authMiddleware, optionalAuthMiddleware, requireRole,
  hashDeviceKey, generateDeviceKey, generateSerial, generateNonce, generateClaimToken,
  hashPassword, deviceAuthMiddleware,
} from "./auth";
import { z } from "zod";
import { writePhotoJpeg, decodeDataUrlOrBase64 } from "./blob";

const NONCE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_CLAIM_TTL_SEC = 7 * 24 * 3600;
const DEFAULT_BATTERIES_PER_VAPE = 5;
const DEFAULT_SHOP_POINTS_PER_VAPE = 1;

async function isPartnerOfShop(userId: string, shopId: number): Promise<boolean> {
  return storage.isShopMember(userId, shopId);
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // ==================== AUTH ====================
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: "Email and password required" });
      const result = await login(email, password);
      if (!result) return res.status(401).json({ error: "Invalid credentials" });
      res.json({
        user: { id: result.user.id, email: result.user.email, role: result.user.role, themePreference: result.user.themePreference || "light" },
        sessionId: result.sessionId,
      });
    } catch {
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, role } = req.body;
      if (!email || !password) return res.status(400).json({ error: "Email and password required" });
      const existing = await storage.getUserByEmail(email);
      if (existing) return res.status(400).json({ error: "Email already registered" });
      const r = await register(email, password, role === "PARTNER" ? "PARTNER" : "CUSTOMER");
      res.json({ user: { id: r.user.id, email: r.user.email, role: r.user.role }, sessionId: r.sessionId });
    } catch {
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/logout", authMiddleware, async (req, res) => {
    await logout(req.sessionId!);
    res.json({ success: true });
  });

  app.get("/api/auth/me", authMiddleware, async (req, res) => {
    const u = req.user!;
    res.json({ user: { id: u.id, email: u.email, role: u.role, themePreference: u.themePreference || "light" } });
  });

  app.patch("/api/auth/theme", authMiddleware, async (req, res) => {
    const { theme } = req.body;
    if (!["light", "dark"].includes(theme)) return res.status(400).json({ error: "Invalid theme" });
    await storage.updateUserTheme(req.user!.id, theme);
    res.json({ success: true });
  });

  app.post("/api/auth/change-password", authMiddleware, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = await storage.getUser(req.user!.id);
      if (!user?.passwordHash) return res.status(404).json({ error: "User not found" });
      const ok = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!ok) return res.status(401).json({ error: "Current password is incorrect" });
      await storage.updateUserPassword(req.user!.id, await hashPassword(newPassword));
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // ==================== PUBLIC FORMS ====================
  app.post("/api/contact", async (req, res) => {
    try {
      const data = insertContactSchema.parse(req.body);
      const c = await storage.createContact(data);
      sendContactNotification(data).catch(() => {});
      res.json(c);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: fromZodError(e).message });
      res.status(500).json({ error: "Failed" });
    }
  });

  app.post("/api/leads", async (req, res) => {
    try {
      const data = insertLeadSchema.parse(req.body);
      const lead = await storage.createLead(data);
      sendBinRequestNotification({
        businessName: data.businessName,
        contactPerson: data.contactName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        volume: data.volume ?? "",
      }).catch(() => {});
      res.json(lead);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: fromZodError(e).message });
      res.status(500).json({ error: "Failed" });
    }
  });

  app.post("/api/volunteers", async (req, res) => {
    try {
      const data = insertVolunteerSchema.parse(req.body);
      const v = await storage.createVolunteer(data);
      sendVolunteerNotification(data).catch(() => {});
      res.json(v);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: fromZodError(e).message });
      res.status(500).json({ error: "Failed" });
    }
  });

  app.get("/api/shops", async (_req, res) => {
    const shops = await storage.getVerifiedShops();
    res.json(shops);
  });

  // ==================== CUSTOMER ====================
  app.get("/api/customer/wallet", authMiddleware, requireRole("CUSTOMER"), async (req, res) => {
    const customer = await storage.getCustomerByUserId(req.user!.id);
    if (!customer) return res.status(404).json({ error: "Customer profile not found" });
    const { balance, lifetimeEarned } = await storage.getBatteryBalance(customer.id);
    res.json({
      customer: { id: customer.id, publicId: customer.publicId },
      wallet: { pointsBalance: balance, lifetimeEarned },
    });
  });

  app.get("/api/customer/transactions", authMiddleware, requireRole("CUSTOMER"), async (req, res) => {
    const customer = await storage.getCustomerByUserId(req.user!.id);
    if (!customer) return res.json([]);
    const txs = await storage.getBatteryTransactions(customer.id, 100);
    res.json(txs.map(t => ({
      id: t.id,
      amount: t.type === "REDEEMED" ? -t.amount : t.amount,
      type: t.type,
      description: t.description || (t.type === "EARNED" ? "Drop session claim" : "Reward redemption"),
      createdAt: t.createdAt,
    })));
  });

  app.get("/api/customer/redemptions", authMiddleware, requireRole("CUSTOMER"), async (req, res) => {
    const customer = await storage.getCustomerByUserId(req.user!.id);
    if (!customer) return res.json([]);
    res.json(await storage.getRedemptionsByCustomer(customer.id));
  });

  app.get("/api/customer/store", async (_req, res) => {
    res.json(await storage.getActiveStoreItems("customer"));
  });

  app.post("/api/customer/redeem", authMiddleware, requireRole("CUSTOMER"), async (req, res) => {
    const body = z.object({ itemId: z.number() }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "itemId required" });
    const customer = await storage.getCustomerByUserId(req.user!.id);
    if (!customer) return res.status(404).json({ error: "Customer profile not found" });
    const item = await storage.getStoreItem(body.data.itemId);
    if (!item || !item.active) return res.status(404).json({ error: "Item not available" });
    const { balance } = await storage.getBatteryBalance(customer.id);
    if (balance < item.pointsCost) return res.status(400).json({ error: "Insufficient batteries" });
    await storage.createBatteryTransaction({
      customerId: customer.id, sessionId: null, amount: item.pointsCost,
      type: "REDEEMED", status: "POSTED", description: `Reward: ${item.name}`,
    } as any);
    const redemption = await storage.createRedemption({
      customerId: customer.id, storeItemId: item.id, pointsSpent: item.pointsCost, status: "PENDING",
    });
    res.json({ ok: true, redemption, balance: balance - item.pointsCost });
  });

  // ==================== CLAIM FLOW ====================
  app.get("/api/claim/:token", async (req, res) => {
    const session = await storage.getDropSessionByClaimToken(req.params.token);
    if (!session) return res.status(404).json({ error: "Invalid claim token" });
    if (session.expiresAt && session.expiresAt < new Date()) return res.status(410).json({ error: "Claim expired" });
    const shop = session.shopId ? await storage.getShop(session.shopId) : null;
    res.json({
      sessionId: session.id,
      batteries: session.batteriesEstimated,
      acceptedDrops: session.acceptedDropCount,
      claimed: !!session.claimedByCustomerId,
      shop: shop ? { id: shop.id, name: shop.name, city: shop.city } : null,
      expiresAt: session.expiresAt,
    });
  });

  app.post("/api/customer/claim/:token", authMiddleware, requireRole("CUSTOMER"), async (req, res) => {
    const session = await storage.getDropSessionByClaimToken(req.params.token);
    if (!session) return res.status(404).json({ error: "Invalid claim token" });
    if (session.claimedByCustomerId) return res.status(409).json({ error: "Already claimed" });
    if (session.expiresAt && session.expiresAt < new Date()) return res.status(410).json({ error: "Claim expired" });
    const customer = await storage.getCustomerByUserId(req.user!.id);
    if (!customer) return res.status(404).json({ error: "Customer profile not found" });

    // Race-safe: insert battery transaction FIRST (UNIQUE on sessionId blocks the race),
    // then update session metadata. If insert fails (already claimed), session is untouched.
    try {
      await storage.createBatteryTransaction({
        customerId: customer.id,
        sessionId: session.id,
        amount: session.batteriesEstimated,
        type: "EARNED",
        status: "POSTED",
        description: `Drop session #${session.id}`,
      });
    } catch (e) {
      return res.status(409).json({ error: "Already claimed" });
    }
    await storage.updateDropSession(session.id, {
      claimedByCustomerId: customer.id,
      claimedAt: new Date(),
      status: "CLAIMED",
      batteriesConfirmed: session.batteriesEstimated,
    });
    res.json({ ok: true, batteries: session.batteriesEstimated, balance: (await storage.getBatteryBalance(customer.id)).balance });
  });

  // ==================== PARTNER ====================
  app.get("/api/partner/shops", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
    const shops = req.user!.role === "STAFF"
      ? await storage.getAllShops()
      : await storage.getShopsByMemberId(req.user!.id);
    res.json(shops);
  });

  app.get("/api/partner/shops/:id/devices", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
    const shopId = Number(req.params.id);
    if (req.user!.role !== "STAFF" && !(await isPartnerOfShop(req.user!.id, shopId)))
      return res.status(403).json({ error: "Not your shop" });
    res.json(await storage.getDevicesByShop(shopId));
  });

  app.get("/api/partner/shops/:id/sessions", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
    const shopId = Number(req.params.id);
    if (req.user!.role !== "STAFF" && !(await isPartnerOfShop(req.user!.id, shopId)))
      return res.status(403).json({ error: "Not your shop" });
    res.json(await storage.getRecentSessionsByShops([shopId], 50));
  });

  app.get("/api/partner/shops/:id/points/balance", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
    const shopId = Number(req.params.id);
    if (req.user!.role !== "STAFF" && !(await isPartnerOfShop(req.user!.id, shopId)))
      return res.status(403).json({ error: "Not your shop" });
    res.json({ balance: await storage.getShopPointBalance(shopId) });
  });

  app.get("/api/partner/shops/:id/points/transactions", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
    const shopId = Number(req.params.id);
    if (req.user!.role !== "STAFF" && !(await isPartnerOfShop(req.user!.id, shopId)))
      return res.status(403).json({ error: "Not your shop" });
    res.json(await storage.getShopPointTransactions(shopId, 100));
  });

  // Shop reward store
  app.get("/api/partner/shops/:id/rewards", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
    const shopId = Number(req.params.id);
    if (req.user!.role !== "STAFF" && !(await isPartnerOfShop(req.user!.id, shopId)))
      return res.status(403).json({ error: "Not your shop" });
    res.json(await storage.getShopRewards(shopId));
  });

  app.post("/api/partner/shops/:id/rewards", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
    const shopId = Number(req.params.id);
    if (req.user!.role !== "STAFF" && !(await isPartnerOfShop(req.user!.id, shopId)))
      return res.status(403).json({ error: "Not your shop" });
    try {
      const data = insertShopRewardSchema.parse({ ...req.body, shopId });
      res.json(await storage.createShopReward(data));
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: fromZodError(e).message });
      res.status(500).json({ error: "Failed" });
    }
  });

  app.patch("/api/partner/shops/:id/rewards/:rewardId", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
    const shopId = Number(req.params.id);
    if (req.user!.role !== "STAFF" && !(await isPartnerOfShop(req.user!.id, shopId)))
      return res.status(403).json({ error: "Not your shop" });
    const reward = await storage.getShopReward(Number(req.params.rewardId));
    if (!reward || reward.shopId !== shopId) return res.status(404).json({ error: "Not found" });
    res.json(await storage.updateShopReward(reward.id, req.body));
  });

  app.delete("/api/partner/shops/:id/rewards/:rewardId", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
    const shopId = Number(req.params.id);
    if (req.user!.role !== "STAFF" && !(await isPartnerOfShop(req.user!.id, shopId)))
      return res.status(403).json({ error: "Not your shop" });
    const reward = await storage.getShopReward(Number(req.params.rewardId));
    if (!reward || reward.shopId !== shopId) return res.status(404).json({ error: "Not found" });
    await storage.deleteShopReward(reward.id);
    res.json({ ok: true });
  });

  app.post("/api/partner/shops/:id/rewards/:rewardId/redeem", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
    const shopId = Number(req.params.id);
    if (req.user!.role !== "STAFF" && !(await isPartnerOfShop(req.user!.id, shopId)))
      return res.status(403).json({ error: "Not your shop" });
    const reward = await storage.getShopReward(Number(req.params.rewardId));
    if (!reward || reward.shopId !== shopId || !reward.active) return res.status(404).json({ error: "Not found" });
    const balance = await storage.getShopPointBalance(shopId);
    if (balance < reward.cost) return res.status(400).json({ error: "Insufficient points" });
    await storage.createShopPointTransaction({
      shopId, sessionId: null, deviceId: null, amount: reward.cost, type: "REDEEMED", status: "POSTED",
      description: `Reward: ${reward.name}`,
    });
    const redemption = await storage.createShopRewardRedemption({
      shopId, rewardId: reward.id, redeemedByUserId: req.user!.id, cost: reward.cost,
    });
    res.json({ ok: true, redemption, balance: balance - reward.cost });
  });

  app.get("/api/partner/shops/:id/redemption-history", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
    const shopId = Number(req.params.id);
    if (req.user!.role !== "STAFF" && !(await isPartnerOfShop(req.user!.id, shopId)))
      return res.status(403).json({ error: "Not your shop" });
    res.json(await storage.getShopRewardRedemptions(shopId));
  });

  // Per-device settings editor
  app.get("/api/partner/devices/:id/settings", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
    const device = await storage.getDevice(Number(req.params.id));
    if (!device) return res.status(404).json({ error: "Device not found" });
    if (req.user!.role !== "STAFF" && device.shopId && !(await isPartnerOfShop(req.user!.id, device.shopId)))
      return res.status(403).json({ error: "Not your device" });
    const s = await storage.getDeviceSettings(device.id);
    res.json({ settingsJson: s?.settingsJson || {}, version: s?.version || 0 });
  });

  app.put("/api/partner/devices/:id/settings", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
    const device = await storage.getDevice(Number(req.params.id));
    if (!device) return res.status(404).json({ error: "Device not found" });
    if (req.user!.role !== "STAFF" && device.shopId && !(await isPartnerOfShop(req.user!.id, device.shopId)))
      return res.status(403).json({ error: "Not your device" });
    const s = await storage.upsertDeviceSettings(device.id, req.body || {});
    res.json(s);
  });

  // Partner "Mark Empty" enqueues a device command
  app.post("/api/partner/devices/:id/mark-empty", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
    const device = await storage.getDevice(Number(req.params.id));
    if (!device) return res.status(404).json({ error: "Device not found" });
    if (req.user!.role !== "STAFF" && device.shopId && !(await isPartnerOfShop(req.user!.id, device.shopId)))
      return res.status(403).json({ error: "Not your device" });
    const cmd = await storage.enqueueCommand(device.id, "RESET_FILL_AND_COUNT");
    // Optimistically zero on server too so UI updates immediately
    await storage.updateDevice(device.id, { vapesSinceEmpty: 0, fillPercent: 0 });
    res.json({ ok: true, command: cmd });
  });

  // ==================== BLE PAIR INIT ====================
  app.post("/api/partner/bins/pair-init", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
    const body = z.object({ shopId: z.number() }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "shopId required" });
    const shopId = body.data.shopId;
    if (req.user!.role !== "STAFF" && !(await isPartnerOfShop(req.user!.id, shopId)))
      return res.status(403).json({ error: "Not your shop" });

    const serial = generateSerial();
    const deviceKey = generateDeviceKey();
    const deviceKeyHash = hashDeviceKey(deviceKey);
    const device = await storage.createDevice({
      serial, deviceKeyHash, shopId, partnerId: req.user!.id, status: "PROVISIONING",
    } as any);
    const nonce = generateNonce();
    await storage.createPairingNonce(device.id, nonce, new Date(Date.now() + NONCE_TTL_MS));
    res.json({ deviceId: device.id, serial, deviceKey, nonce, ttlMs: NONCE_TTL_MS });
  });

  // ==================== DEVICE API (/api/device/*) ====================

  // Pairing claim — no device-key auth (uses nonce instead)
  app.post("/api/device/claim", async (req, res) => {
    const body = z.object({ nonce: z.string(), serial: z.string().optional(), firmwareVersion: z.string().optional() }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "nonce required" });
    const consumed = await storage.consumePairingNonce(body.data.nonce);
    if (!consumed) return res.status(400).json({ error: "Invalid or expired nonce" });
    const device = await storage.getDevice(consumed.deviceId);
    if (!device) return res.status(404).json({ error: "Device not found" });
    if (body.data.serial && body.data.serial !== device.serial) return res.status(400).json({ error: "Serial mismatch" });
    const updated = await storage.updateDevice(device.id, {
      status: "LIVE",
      firmwareVersion: body.data.firmwareVersion || device.firmwareVersion,
      lastHeartbeatAt: new Date(),
    });
    res.json({ deviceId: device.id, serial: device.serial, shopId: device.shopId });
  });

  // All routes below require X-Device-Key
  app.post("/api/device/telemetry", deviceAuthMiddleware, async (req, res) => {
    const body = z.object({
      vapesSinceEmpty: z.number().optional(),
      fillPercent: z.number().optional(),
      tempC: z.number().optional(),
      vocRaw: z.number().optional(),
      wifiRssi: z.number().optional(),
      sdFreeMb: z.number().optional(),
      firmwareVersion: z.string().optional(),
      state: z.string().optional(),
      errorLog: z.string().optional(),
    }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "bad telemetry" });
    const patch: any = { ...body.data, lastHeartbeatAt: new Date() };
    delete patch.state;
    await storage.updateDevice(req.device!.id, patch);
    res.json({ ok: true });
  });

  app.get("/api/device/settings", deviceAuthMiddleware, async (req, res) => {
    const have = Number((req.query.version as string) || 0);
    const s = await storage.getDeviceSettings(req.device!.id);
    if (!s) return res.json({ version: 0, settings: {} });
    if (s.version <= have) return res.status(304).end();
    res.json({ version: s.version, settings: s.settingsJson });
  });

  app.get("/api/device/commands", deviceAuthMiddleware, async (req, res) => {
    const since = Number((req.query.lastCommandId as string) || 0);
    const cmds = await storage.getPendingCommands(req.device!.id, since);
    res.json({ commands: cmds });
  });

  app.post("/api/device/commands/ack", deviceAuthMiddleware, async (req, res) => {
    const body = z.object({ commandId: z.number(), result: z.string().optional() }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "commandId required" });
    const c = await storage.ackCommand(body.data.commandId, req.device!.id, body.data.result);
    if (!c) return res.status(404).json({ error: "Command not found" });
    res.json({ ok: true });
  });

  app.post("/api/device/drop-sessions/start", deviceAuthMiddleware, async (req, res) => {
    const s = await storage.createDropSession(req.device!.id, req.device!.shopId || null);
    res.json({ sessionId: s.id });
  });

  app.post("/api/device/drops", deviceAuthMiddleware, async (req, res) => {
    const body = z.object({
      sessionId: z.number(),
      sequence: z.number(),
      beamPatternJson: z.any().optional(),
      tempC: z.number().optional(),
      vocRaw: z.number().optional(),
      fillPercent: z.number().optional(),
      accepted: z.boolean().optional(),
    }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "bad drop" });
    const session = await storage.getDropSession(body.data.sessionId);
    if (!session || session.deviceId !== req.device!.id) return res.status(404).json({ error: "Session not found" });
    if (session.status !== "OPEN") return res.status(400).json({ error: "Session not open" });
    const drop = await storage.createDrop(body.data as any);
    await storage.updateDropSession(session.id, {
      detectedDropCount: session.detectedDropCount + 1,
      acceptedDropCount: session.acceptedDropCount + (body.data.accepted === false ? 0 : 1),
    });
    res.json({ dropId: drop.id });
  });

  // Photo upload — multipart not required; accepts base64 in JSON body
  app.post("/api/device/drops/:dropId/photos", deviceAuthMiddleware, async (req, res) => {
    const dropId = Number(req.params.dropId);
    const body = z.object({
      imageRole: z.enum(["before", "after"]),
      imageBase64: z.string(),
    }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "imageBase64 required" });
    // Ownership: dropId -> session -> deviceId must match the calling device
    const drop = await storage.getDrop(dropId);
    if (!drop) return res.status(404).json({ error: "Drop not found" });
    const dropSession = await storage.getDropSession(drop.sessionId);
    if (!dropSession || dropSession.deviceId !== req.device!.id) return res.status(403).json({ error: "Not your drop" });
    const buf = decodeDataUrlOrBase64(body.data.imageBase64);
    if (!buf || buf.length < 100) return res.status(400).json({ error: "Invalid image" });
    const { url } = await writePhotoJpeg(req.device!.id, buf);
    const photo = await storage.createPhoto({
      deviceId: req.device!.id, dropId, storageUrl: url,
      reason: body.data.imageRole === "before" ? "drop_before" : "drop_after",
    } as any);
    // latestPhotoUrl from after-photo
    if (body.data.imageRole === "after") {
      await storage.updateDevice(req.device!.id, { latestPhotoUrl: url, latestPhotoTakenAt: new Date() });
    }
    res.json({ photoId: photo.id, url });
  });

  // Idle / maintenance / calibration photos (not tied to a drop)
  app.post("/api/device/photos", deviceAuthMiddleware, async (req, res) => {
    const body = z.object({
      reason: z.enum(["idle", "maintenance", "calibration"]),
      imageBase64: z.string(),
      sessionId: z.number().optional(),
    }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "imageBase64 required" });
    const buf = decodeDataUrlOrBase64(body.data.imageBase64);
    if (!buf) return res.status(400).json({ error: "Invalid image" });
    const { url } = await writePhotoJpeg(req.device!.id, buf);
    const photo = await storage.createPhoto({
      deviceId: req.device!.id, sessionId: body.data.sessionId, storageUrl: url, reason: body.data.reason,
    } as any);
    await storage.updateDevice(req.device!.id, { latestPhotoUrl: url, latestPhotoTakenAt: new Date() });
    res.json({ photoId: photo.id, url });
  });

  // Finalize a session: award shop points, generate claim token
  app.post("/api/device/drop-sessions/:id/finalize", deviceAuthMiddleware, async (req, res) => {
    const sessionId = Number(req.params.id);
    const session = await storage.getDropSession(sessionId);
    if (!session || session.deviceId !== req.device!.id) return res.status(404).json({ error: "Session not found" });
    if (session.status !== "OPEN") return res.status(400).json({ error: "Already finalized" });
    if (session.acceptedDropCount === 0) {
      const updated = await storage.updateDropSession(sessionId, { status: "EXPIRED", finalizedAt: new Date() });
      return res.json({ ok: true, batteries: 0, claimToken: null, claimUrl: null, expired: true });
    }
    const cfg = session.shopId ? await storage.getRewardConfig(session.shopId) : null;
    const battsPer = cfg?.batteriesPerVape ?? DEFAULT_BATTERIES_PER_VAPE;
    const ptsPer = cfg?.shopPointsPerVape ?? DEFAULT_SHOP_POINTS_PER_VAPE;
    const ttlSec = cfg?.claimExpirySec ?? DEFAULT_CLAIM_TTL_SEC;

    const batteries = session.acceptedDropCount * battsPer;
    const shopPoints = session.acceptedDropCount * ptsPer;
    const claimToken = generateClaimToken();
    const expiresAt = new Date(Date.now() + ttlSec * 1000);

    await storage.updateDropSession(sessionId, {
      status: "FINALIZED",
      batteriesEstimated: batteries,
      shopPointsAwarded: shopPoints,
      claimToken,
      expiresAt,
      finalizedAt: new Date(),
    });

    // Award shop points immediately (no QR scan needed)
    if (session.shopId && shopPoints > 0) {
      await storage.createShopPointTransaction({
        shopId: session.shopId, deviceId: req.device!.id, sessionId,
        amount: shopPoints, type: "EARNED", status: "POSTED",
        description: `${session.acceptedDropCount} vape drop(s)`,
      });
    }

    const baseUrl = (req.headers["x-forwarded-proto"] ? `${req.headers["x-forwarded-proto"]}://` : "https://") +
                    (req.headers["x-forwarded-host"] || req.headers.host);
    const claimUrl = `${baseUrl}/claim/${claimToken}`;
    res.json({ ok: true, batteries, shopPoints, claimToken, claimUrl, expiresAt });
  });

  // ==================== STAFF ====================
  app.get("/api/staff/devices", authMiddleware, requireRole("STAFF"), async (_req, res) => {
    const list = await storage.getAllDevices();
    res.json(list);
  });

  app.get("/api/staff/devices/:id/commands", authMiddleware, requireRole("STAFF"), async (req, res) => {
    res.json(await storage.getCommandsByDevice(Number(req.params.id), 100));
  });

  app.post("/api/staff/devices/:id/commands", authMiddleware, requireRole("STAFF"), async (req, res) => {
    const body = z.object({ type: z.string(), payload: z.any().optional() }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "type required" });
    const c = await storage.enqueueCommand(Number(req.params.id), body.data.type, body.data.payload);
    res.json(c);
  });

  app.delete("/api/staff/devices/:id", authMiddleware, requireRole("STAFF"), async (req, res) => {
    await storage.deleteDevice(Number(req.params.id));
    res.json({ ok: true });
  });

  app.get("/api/staff/shops", authMiddleware, requireRole("STAFF"), async (_req, res) => {
    res.json(await storage.getAllShops());
  });

  app.post("/api/staff/shops", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const data = insertShopSchema.parse(req.body);
      const shop = await storage.createShop(data);
      res.json(shop);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: fromZodError(e).message });
      res.status(500).json({ error: "Failed" });
    }
  });

  app.patch("/api/staff/shops/:id/status", authMiddleware, requireRole("STAFF"), async (req, res) => {
    const shop = await storage.updateShopStatus(Number(req.params.id), req.body.status);
    res.json(shop);
  });

  app.post("/api/staff/shops/:id/members", authMiddleware, requireRole("STAFF"), async (req, res) => {
    const body = z.object({ userId: z.string(), role: z.enum(["OWNER", "MANAGER"]).optional() }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "userId required" });
    const m = await storage.createShopMember({
      userId: body.data.userId, shopId: Number(req.params.id), role: body.data.role || "MANAGER",
    });
    res.json(m);
  });

  app.get("/api/staff/users", authMiddleware, requireRole("STAFF"), async (_req, res) => {
    const users = await storage.getAllUsers();
    res.json(users.map(u => ({ id: u.id, email: u.email, role: u.role, createdAt: u.createdAt })));
  });

  app.patch("/api/staff/users/:id/role", authMiddleware, requireRole("STAFF"), async (req, res) => {
    const u = await storage.updateUserRole(req.params.id, req.body.role);
    res.json(u);
  });

  app.get("/api/staff/leads", authMiddleware, requireRole("STAFF"), async (_req, res) => {
    res.json(await storage.getAllLeads());
  });

  app.get("/api/staff/contacts", authMiddleware, requireRole("STAFF"), async (_req, res) => {
    res.json(await storage.getAllContacts());
  });

  app.get("/api/staff/volunteers", authMiddleware, requireRole("STAFF"), async (_req, res) => {
    res.json(await storage.getAllVolunteers());
  });

  app.get("/api/staff/pickups", authMiddleware, requireRole("STAFF"), async (_req, res) => {
    res.json(await storage.getAllPickupRequests());
  });

  return httpServer;
}
