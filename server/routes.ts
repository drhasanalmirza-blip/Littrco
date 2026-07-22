import type { Express, Request, Response } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { eq } from "drizzle-orm";
import {
  insertContactSchema, insertLeadSchema, insertVolunteerSchema,
  insertShopSchema, insertShopRewardSchema,
  dropSessions, rewardConfigs, shopPointTransactions,
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
import { rateLimit, rateLimitByIp, deviceLimiter } from "./ratelimit";
import { claimSessionForCustomer } from "./claims";
import { evaluateTelemetry, handleDeviceEvent } from "./notify";
import { validateDeviceSettings, mergeDeviceSettings } from "@shared/deviceSettings";
import reviewRouter from "./routes/review";
import { partnerRoleForShop } from "./routes/team";
import alertsRouter from "./routes/alerts";
import teamRouter from "./routes/team";
import selfReportRouter from "./routes/selfreport";
import devopsRouter from "./routes/devops";

const NONCE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_CLAIM_TTL_SEC = 7 * 24 * 3600;
const DEFAULT_BATTERIES_PER_VAPE = 5;
const DEFAULT_SHOP_POINTS_PER_VAPE = 1;
const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // 4 MB decoded cap (spec §2.5)

// Rate limits (spec §2.7). deviceLimiter is the shared per-device 120/min window
// (imported from ./ratelimit) so routes.ts and routes/devops.ts count against ONE bucket.
const photoLimiter = rateLimit({ max: 30 });
const authLimiter = rateLimitByIp(10);
const claimLimiter = rateLimitByIp(20);

// Returns an error string, or null when buf is an acceptable JPEG (spec §2.5)
function jpegUploadError(buf: Buffer | null): string | null {
  if (!buf || buf.length < 100) return "Invalid image";
  if (buf.length > MAX_PHOTO_BYTES) return "Image too large (max 4MB)";
  if (buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return "Not a JPEG";
  return null;
}

async function isPartnerOfShop(userId: string, shopId: number): Promise<boolean> {
  return storage.isShopMember(userId, shopId);
}

// Mutating partner routes are closed to read-only VIEWER members (spec §4.2).
// Returns the 403 error string, or null when the member may mutate.
async function mutableShopError(userId: string, shopId: number): Promise<string | null> {
  const role = await partnerRoleForShop(userId, shopId);
  if (!role) return "Not your shop";
  if (role === "VIEWER") return "Forbidden";
  return null;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Feature modules (stubs until their agents land them)
  app.use(reviewRouter);
  app.use(alertsRouter);
  app.use(teamRouter);
  app.use(selfReportRouter);
  app.use(devopsRouter);

  // ==================== AUTH ====================
  app.post("/api/auth/login", authLimiter, async (req, res) => {
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

  app.post("/api/auth/register", authLimiter, async (req, res) => {
    try {
      const { email, password, role, claimToken } = req.body;
      if (!email || !password) return res.status(400).json({ error: "Email and password required" });
      const existing = await storage.getUserByEmail(email);
      if (existing) return res.status(400).json({ error: "Email already registered" });
      const r = await register(email, password, role === "PARTNER" ? "PARTNER" : "CUSTOMER");
      // Optional claim-on-register (spec §4.6): claim the drop session right after
      // the customer row exists, so the QR flow needs no second request.
      let claim: { ok: boolean; batteries?: number; error?: string } | undefined;
      if (typeof claimToken === "string" && claimToken.length > 0) {
        const customer = await storage.getCustomerByUserId(r.user.id);
        if (!customer) {
          claim = { ok: false, error: "No customer profile for this account" };
        } else {
          const result = await claimSessionForCustomer(customer.id, claimToken);
          claim = result.ok ? { ok: true, batteries: result.batteries } : { ok: false, error: result.error };
        }
      }
      res.json({
        user: { id: r.user.id, email: r.user.email, role: r.user.role },
        sessionId: r.sessionId,
        ...(claim ? { claim } : {}),
      });
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
  app.get("/api/claim/:token", claimLimiter, async (req, res) => {
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

  app.post("/api/customer/claim/:token", claimLimiter, authMiddleware, requireRole("CUSTOMER"), async (req, res) => {
    const customer = await storage.getCustomerByUserId(req.user!.id);
    if (!customer) return res.status(404).json({ error: "Customer profile not found" });
    const result = await claimSessionForCustomer(customer.id, req.params.token);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.json({ ok: true, batteries: result.batteries, balance: result.balance });
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
    if (req.user!.role !== "STAFF") {
      const err = await mutableShopError(req.user!.id, shopId);
      if (err) return res.status(403).json({ error: err });
    }
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
    if (req.user!.role !== "STAFF") {
      const err = await mutableShopError(req.user!.id, shopId);
      if (err) return res.status(403).json({ error: err });
    }
    const reward = await storage.getShopReward(Number(req.params.rewardId));
    if (!reward || reward.shopId !== shopId) return res.status(404).json({ error: "Not found" });
    res.json(await storage.updateShopReward(reward.id, req.body));
  });

  app.delete("/api/partner/shops/:id/rewards/:rewardId", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
    const shopId = Number(req.params.id);
    if (req.user!.role !== "STAFF") {
      const err = await mutableShopError(req.user!.id, shopId);
      if (err) return res.status(403).json({ error: err });
    }
    const reward = await storage.getShopReward(Number(req.params.rewardId));
    if (!reward || reward.shopId !== shopId) return res.status(404).json({ error: "Not found" });
    await storage.deleteShopReward(reward.id);
    res.json({ ok: true });
  });

  app.post("/api/partner/shops/:id/rewards/:rewardId/redeem", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
    const shopId = Number(req.params.id);
    if (req.user!.role !== "STAFF") {
      const err = await mutableShopError(req.user!.id, shopId);
      if (err) return res.status(403).json({ error: err });
    }
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
    if (req.user!.role !== "STAFF" && device.shopId) {
      const err = await mutableShopError(req.user!.id, device.shopId);
      if (err) return res.status(403).json({ error: err });
    }
    const validated = validateDeviceSettings(req.body ?? {});
    if (!validated.ok) return res.status(400).json({ error: validated.error });
    // Spec §7: partial updates merge server-side onto the stored JSON
    const existing = await storage.getDeviceSettings(device.id);
    const merged = mergeDeviceSettings(
      (existing?.settingsJson as Record<string, unknown>) ?? {},
      validated.value,
    );
    const s = await storage.upsertDeviceSettings(device.id, merged);
    res.json(s);
  });

  // Partner "Mark Empty" enqueues a device command
  app.post("/api/partner/devices/:id/mark-empty", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
    const device = await storage.getDevice(Number(req.params.id));
    if (!device) return res.status(404).json({ error: "Device not found" });
    if (req.user!.role !== "STAFF" && device.shopId) {
      const err = await mutableShopError(req.user!.id, device.shopId);
      if (err) return res.status(403).json({ error: err });
    }
    const cmd = await storage.enqueueCommand(device.id, "RESET_FILL_AND_COUNT");
    // Optimistically zero on server too so UI updates immediately; clearing
    // alertStateJson re-arms fill/FULL notifications (spec §5.4)
    await storage.updateDevice(device.id, { vapesSinceEmpty: 0, fillPercent: 0, alertStateJson: null });
    res.json({ ok: true, command: cmd });
  });

  // ==================== BLE PAIR INIT ====================
  app.post("/api/partner/bins/pair-init", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
    const body = z.object({ shopId: z.number() }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "shopId required" });
    const shopId = body.data.shopId;
    if (req.user!.role !== "STAFF") {
      const err = await mutableShopError(req.user!.id, shopId);
      if (err) return res.status(403).json({ error: err });
    }

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
  app.post("/api/device/claim", deviceLimiter, async (req, res) => {
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
  app.post("/api/device/telemetry", deviceAuthMiddleware, deviceLimiter, async (req, res) => {
    const body = z.object({
      vapesSinceEmpty: z.number().optional(),
      fillPercent: z.number().optional(),
      tempC: z.number().optional(),
      vocRaw: z.number().optional(),
      wifiRssi: z.number().optional(),
      sdFreeMb: z.number().optional(),
      rawDistanceMm: z.number().optional(),
      firmwareVersion: z.string().optional(),
      state: z.string().optional(),
      errorLog: z.string().optional(),
    }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "bad telemetry" });
    const before = req.device!;
    const patch: any = { ...body.data, lastHeartbeatAt: new Date() };
    delete patch.state;
    delete patch.rawDistanceMm;
    if (body.data.rawDistanceMm !== undefined) patch.lastDistanceMm = body.data.rawDistanceMm;
    const after = await storage.updateDevice(before.id, patch);
    await evaluateTelemetry(before, after); // alert engine (spec §5)
    res.json({ ok: true });
  });

  // Device-initiated alerts — fire and warnings are detected on-device (spec §2.2)
  app.post("/api/device/events", deviceAuthMiddleware, deviceLimiter, async (req, res) => {
    const body = z.object({
      type: z.enum(["FIRE", "TEMP_HIGH", "VOC_HIGH", "SD_ERROR", "CAMERA_ERROR"]),
      tempC: z.number().optional(),
      vocAnalog: z.number().optional(),
      fillPercent: z.number().optional(),
      message: z.string().optional(),
    }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "bad event" });
    const alertId = await handleDeviceEvent(req.device!, body.data);
    res.status(202).json({ alertId: alertId ?? null });
  });

  app.get("/api/device/settings", deviceAuthMiddleware, deviceLimiter, async (req, res) => {
    const have = Number((req.query.version as string) || 0);
    const s = await storage.getDeviceSettings(req.device!.id);
    if (!s) return res.json({ version: 0, settings: {} });
    if (s.version <= have) return res.status(304).end();
    res.json({ version: s.version, settings: s.settingsJson });
  });

  app.get("/api/device/commands", deviceAuthMiddleware, deviceLimiter, async (req, res) => {
    const since = Number((req.query.lastCommandId as string) || 0);
    const cmds = await storage.getPendingCommands(req.device!.id, since);
    res.json({ commands: cmds });
  });

  app.post("/api/device/commands/ack", deviceAuthMiddleware, deviceLimiter, async (req, res) => {
    const body = z.object({ commandId: z.number(), result: z.string().optional() }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "commandId required" });
    const c = await storage.ackCommand(body.data.commandId, req.device!.id, body.data.result);
    if (!c) return res.status(404).json({ error: "Command not found" });
    res.json({ ok: true });
  });

  app.post("/api/device/drop-sessions/start", deviceAuthMiddleware, deviceLimiter, async (req, res) => {
    const s = await storage.createDropSession(req.device!.id, req.device!.shopId || null);
    res.json({ sessionId: s.id });
  });

  app.post("/api/device/drops", deviceAuthMiddleware, deviceLimiter, async (req, res) => {
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
  app.post("/api/device/drops/:dropId/photos", deviceAuthMiddleware, photoLimiter, async (req, res) => {
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
    const uploadError = jpegUploadError(buf);
    if (uploadError) return res.status(400).json({ error: uploadError });
    const { url } = await writePhotoJpeg(req.device!.id, buf!);
    const photo = await storage.createPhoto({
      deviceId: req.device!.id, dropId, storageUrl: url,
      reason: body.data.imageRole === "before" ? "drop_before" : "drop_after",
    } as any);
    // Link the photo back onto the drop so the FK joins in the review queue and
    // training export resolve (spec §3.1); without this beforePhotoId/afterPhotoId
    // stay NULL and both endpoints emit null before/after URLs.
    await storage.updateDrop(dropId, body.data.imageRole === "before"
      ? { beforePhotoId: photo.id }
      : { afterPhotoId: photo.id });
    // latestPhotoUrl from after-photo
    if (body.data.imageRole === "after") {
      await storage.updateDevice(req.device!.id, { latestPhotoUrl: url, latestPhotoTakenAt: new Date() });
    }
    res.json({ photoId: photo.id, url });
  });

  // Idle / maintenance / calibration / live-view photos (not tied to a drop)
  app.post("/api/device/photos", deviceAuthMiddleware, photoLimiter, async (req, res) => {
    const body = z.object({
      reason: z.enum(["idle", "maintenance", "calibration", "live"]),
      imageBase64: z.string(),
      sessionId: z.number().optional(),
    }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "imageBase64 required" });
    const buf = decodeDataUrlOrBase64(body.data.imageBase64);
    const uploadError = jpegUploadError(buf);
    if (uploadError) return res.status(400).json({ error: uploadError });
    const { url } = await writePhotoJpeg(req.device!.id, buf!);
    const photo = await storage.createPhoto({
      deviceId: req.device!.id, sessionId: body.data.sessionId, storageUrl: url, reason: body.data.reason,
    } as any);
    await storage.updateDevice(req.device!.id, { latestPhotoUrl: url, latestPhotoTakenAt: new Date() });
    res.json({ photoId: photo.id, url });
  });

  // Finalize a session: award shop points, generate claim token.
  // Wrapped in a transaction with SELECT ... FOR UPDATE on the session so two
  // concurrent finalizes (e.g. a device network-retry arriving mid-flight) can't
  // both pass the status===OPEN check and both insert an EARNED shop-point row —
  // the second blocks on the lock, then sees FINALIZED and 400s. (Batteries are
  // already race-safe via UNIQUE(session_id) at claim time.)
  app.post("/api/device/drop-sessions/:id/finalize", deviceAuthMiddleware, deviceLimiter, async (req, res) => {
    const sessionId = Number(req.params.id);
    const device = req.device!;

    const outcome = await db.transaction(async (tx) => {
      const [session] = await tx.select().from(dropSessions)
        .where(eq(dropSessions.id, sessionId)).for("update");
      if (!session || session.deviceId !== device.id) return { kind: "notfound" as const };
      if (session.status !== "OPEN") return { kind: "already" as const };

      if (session.acceptedDropCount === 0) {
        await tx.update(dropSessions)
          .set({ status: "EXPIRED", finalizedAt: new Date() })
          .where(eq(dropSessions.id, sessionId));
        return { kind: "expired" as const };
      }

      const cfgRows = session.shopId
        ? await tx.select().from(rewardConfigs).where(eq(rewardConfigs.shopId, session.shopId))
        : [];
      const cfg = cfgRows[0];
      const battsPer = cfg?.batteriesPerVape ?? DEFAULT_BATTERIES_PER_VAPE;
      // Per-bin override beats the shop-wide rate (spec §1.2)
      const ptsPer = device.pointsPerVapeOverride ?? cfg?.shopPointsPerVape ?? DEFAULT_SHOP_POINTS_PER_VAPE;
      const ttlSec = cfg?.claimExpirySec ?? DEFAULT_CLAIM_TTL_SEC;

      const batteries = session.acceptedDropCount * battsPer;
      const shopPoints = session.acceptedDropCount * ptsPer;
      const claimToken = generateClaimToken();
      const expiresAt = new Date(Date.now() + ttlSec * 1000);

      await tx.update(dropSessions).set({
        status: "FINALIZED",
        batteriesEstimated: batteries,
        shopPointsAwarded: shopPoints,
        claimToken,
        expiresAt,
        finalizedAt: new Date(),
      }).where(eq(dropSessions.id, sessionId));

      // Award shop points immediately (no QR scan needed)
      if (session.shopId && shopPoints > 0) {
        await tx.insert(shopPointTransactions).values({
          shopId: session.shopId, deviceId: device.id, sessionId,
          amount: shopPoints, type: "EARNED", status: "POSTED",
          description: `${session.acceptedDropCount} vape drop(s)`,
        });
      }

      return { kind: "finalized" as const, batteries, shopPoints, claimToken, expiresAt };
    });

    if (outcome.kind === "notfound") return res.status(404).json({ error: "Session not found" });
    if (outcome.kind === "already") return res.status(400).json({ error: "Already finalized" });
    if (outcome.kind === "expired") {
      return res.json({ ok: true, batteries: 0, claimToken: null, claimUrl: null, expired: true });
    }

    const baseUrl = (req.headers["x-forwarded-proto"] ? `${req.headers["x-forwarded-proto"]}://` : "https://") +
                    (req.headers["x-forwarded-host"] || req.headers.host);
    const claimUrl = `${baseUrl}/claim/${outcome.claimToken}`;
    res.json({
      ok: true,
      batteries: outcome.batteries,
      shopPoints: outcome.shopPoints,
      claimToken: outcome.claimToken,
      claimUrl,
      expiresAt: outcome.expiresAt,
    });
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
    if (body.data.type === "RESET_FILL_AND_COUNT") {
      // Same semantics as partner mark-empty: re-arm fill/FULL alerts (spec §5.4)
      await storage.updateDevice(Number(req.params.id), { alertStateJson: null });
    }
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
