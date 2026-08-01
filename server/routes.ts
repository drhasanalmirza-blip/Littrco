import type { Express, Request, Response } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { and, eq } from "drizzle-orm";
import {
  insertContactSchema, insertLeadSchema, insertVolunteerSchema,
  insertShopSchema, insertShopRewardSchema,
  dropSessions, drops, rewardConfigs, shopPointTransactions,
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
import { decodeDataUrlOrBase64 } from "./blob";
import { storageDriver } from "./blobstore";
import { rateLimit, rateLimitByIp, deviceLimiter } from "./ratelimit";
import { claimSessionForCustomer } from "./claims";
import { evaluateTelemetry, handleDeviceEvent, notifyFireDisabled } from "./notify";
import { validateDeviceSettings, mergeDeviceSettings } from "@shared/deviceSettings";
import { finalizeDecision, finalizeReplayKind } from "./offlineFinalize";
import { mapCustomerSessionRow } from "@shared/customerFeed";
import { asyncHandler } from "./asyncHandler";
import reviewRouter from "./routes/review";
import { partnerRoleForShop } from "./routes/team";
import alertsRouter from "./routes/alerts";
import teamRouter from "./routes/team";
import selfReportRouter from "./routes/selfreport";
import devopsRouter from "./routes/devops";
import contentRouter from "./routes/content";

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

// Fallback labels for ledger rows with no explicit description. Keyed by the
// full ledgerTypeEnum — a two-way ternary previously labelled an ADJUST row
// (a staff clawback) as "Reward redemption", i.e. as if the customer had spent it.
const DEFAULT_TX_DESCRIPTION: Record<"EARNED" | "REDEEMED" | "ADJUST", string> = {
  EARNED: "Drop session claim",
  REDEEMED: "Reward redemption",
  ADJUST: "Balance adjustment",
};

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
  app.use(contentRouter);

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
        // ensure, not get: register() only provisions a customer row for role
        // CUSTOMER, so a PARTNER signing up straight from a bin's QR code had no
        // profile and lost the claim.
        const customer = await storage.ensureCustomerForUser(r.user.id);
        const result = await claimSessionForCustomer(customer.id, claimToken);
        claim = result.ok ? { ok: true, batteries: result.batteries } : { ok: false, error: result.error };
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

  // Map pins for the public drop-off finder. client/src/components/ShopMap.tsx
  // has always fetched this path, but the route never existed — so the /dropoff
  // map rendered an empty basemap. Public, like /api/shops.
  app.get("/api/shops/locations", async (_req, res) => {
    res.json(await storage.getShopLocations());
  });

  // ==================== CUSTOMER ====================
  app.get("/api/customer/wallet", authMiddleware, asyncHandler(async (req, res) => {
    const customer = await storage.ensureCustomerForUser(req.user!.id);
    if (!customer) return res.status(404).json({ error: "Customer profile not found" });
    const { balance, lifetimeEarned } = await storage.getBatteryBalance(customer.id);
    res.json({
      customer: { id: customer.id, publicId: customer.publicId },
      wallet: { pointsBalance: balance, lifetimeEarned },
    });
  }));

  app.get("/api/customer/transactions", authMiddleware, asyncHandler(async (req, res) => {
    const customer = await storage.ensureCustomerForUser(req.user!.id);
    if (!customer) return res.json([]);
    const txs = await storage.getBatteryTransactions(customer.id, 100);
    res.json(txs.map(t => ({
      id: t.id,
      // sessionId lets the client dedupe a ledger row against the richer
      // /api/customer/sessions row for the same drop. Non-sensitive: it is the
      // customer's own session.
      sessionId: t.sessionId,
      amount: t.type === "REDEEMED" ? -t.amount : t.amount,
      type: t.type,
      // Only POSTED rows count toward the balance (see getBatteryBalance), so
      // the client needs status to avoid implying a PENDING/VOID row was paid.
      status: t.status,
      description: t.description || DEFAULT_TX_DESCRIPTION[t.type],
      createdAt: t.createdAt,
    })));
  }));

  app.get("/api/customer/redemptions", authMiddleware, asyncHandler(async (req, res) => {
    const customer = await storage.ensureCustomerForUser(req.user!.id);
    if (!customer) return res.json([]);
    res.json(await storage.getRedemptionsByCustomer(customer.id));
  }));

  // Claimed drop history with shop names — powers the activity feed and the
  // earnings trend. Shaped by a pure mapper so the shape is unit-tested.
  app.get("/api/customer/sessions", authMiddleware, asyncHandler(async (req, res) => {
    const customer = await storage.ensureCustomerForUser(req.user!.id);
    if (!customer) return res.json([]);
    const q = z.object({
      limit: z.coerce.number().int().min(1).max(200).optional(),
    }).safeParse(req.query);
    if (!q.success) return res.status(400).json({ error: "limit must be 1-200" });
    const rows = await storage.getClaimedSessionsByCustomer(customer.id, q.data.limit ?? 50);
    res.json(rows.map(mapCustomerSessionRow));
  }));

  // Lifetime totals for the impact hero. Separate from /sessions because the
  // hero must not be derived from a capped list.
  app.get("/api/customer/stats", authMiddleware, asyncHandler(async (req, res) => {
    const customer = await storage.ensureCustomerForUser(req.user!.id);
    if (!customer) {
      return res.json({
        lifetimeVapes: 0, lifetimeSessions: 0, lifetimeBatteries: 0,
        distinctShops: 0, firstDropAt: null, lastDropAt: null,
      });
    }
    res.json(await storage.getCustomerImpactStats(customer.id));
  }));

  app.get("/api/customer/store", async (_req, res) => {
    res.json(await storage.getActiveStoreItems("customer"));
  });

  app.post("/api/customer/redeem", authMiddleware, asyncHandler(async (req, res) => {
    const body = z.object({ itemId: z.number() }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "itemId required" });
    const customer = await storage.ensureCustomerForUser(req.user!.id);
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
  }));

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

  app.post("/api/customer/claim/:token", claimLimiter, authMiddleware, asyncHandler(async (req, res) => {
    const customer = await storage.ensureCustomerForUser(req.user!.id);
    if (!customer) return res.status(404).json({ error: "Customer profile not found" });
    const result = await claimSessionForCustomer(customer.id, req.params.token);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.json({ ok: true, batteries: result.batteries, balance: result.balance });
  }));

  // ==================== PARTNER ====================
  app.get("/api/partner/shops", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
    if (req.user!.role === "STAFF") {
      // Staff act as OWNER of every shop (full access).
      const shops = await storage.getAllShops();
      return res.json(shops.map((s) => ({ ...s, myRole: "STAFF" as const })));
    }
    // Attach the caller's membership role so the client can gate mutation UI
    // (server still enforces on every mutating route via mutableShopError).
    const shops = await storage.getShopsByMemberId(req.user!.id);
    const withRole = await Promise.all(
      shops.map(async (s) => ({ ...s, myRole: await partnerRoleForShop(req.user!.id, s.id) })),
    );
    res.json(withRole);
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

  // Rename a bin (display label for the shop's own preview). VIEWER is read-only.
  app.patch("/api/partner/devices/:id", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
    const device = await storage.getDevice(Number(req.params.id));
    if (!device) return res.status(404).json({ error: "Device not found" });
    if (req.user!.role !== "STAFF") {
      // An unassigned device (shopId null — e.g. its shop was deleted) has no
      // shop membership to check, so a non-STAFF caller can never mutate it.
      if (!device.shopId) return res.status(403).json({ error: "Not your device" });
      const err = await mutableShopError(req.user!.id, device.shopId);
      if (err) return res.status(403).json({ error: err });
    }
    const parsed = z.object({ label: z.string().trim().max(60).nullable() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid label" });
    const label = parsed.data.label && parsed.data.label.length > 0 ? parsed.data.label : null;
    const updated = await storage.updateDevice(device.id, { label });
    res.json(updated);
  });

  // Remove a bin from the shop. OWNER/MANAGER only (VIEWER is read-only via
  // mutableShopError); deleting cascades to sessions/settings/etc. per schema FKs.
  app.delete("/api/partner/devices/:id", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
    const device = await storage.getDevice(Number(req.params.id));
    if (!device) return res.status(404).json({ error: "Device not found" });
    if (req.user!.role !== "STAFF") {
      // An unassigned device (shopId null — e.g. its shop was deleted) has no
      // shop membership to check, so a non-STAFF caller can never mutate it.
      if (!device.shopId) return res.status(403).json({ error: "Not your device" });
      const err = await mutableShopError(req.user!.id, device.shopId);
      if (err) return res.status(403).json({ error: err });
    }
    // Same two-phase un-pair-then-remove as the staff route — see the long note
    // on DELETE /api/staff/devices/:id. A partner removing their own bin should
    // leave it on the setup portal, not holding a key nobody honours.
    if (req.query.force === "true") {
      await storage.deleteDevice(device.id);
      return res.json({ ok: true, removed: true, unpaired: false });
    }
    await storage.enqueueCommand(device.id, "FACTORY_RESET", { removeAfter: true });
    res.json({
      ok: true,
      removed: false,
      pending: true,
      message: "Un-pairing the bin — it will be removed once it confirms (usually within ~10s). Use Force remove if it never does.",
    });
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

  // Bin diagnostic logs (read). A read is fine for any shop member incl. VIEWER,
  // so this checks membership (isPartnerOfShop), not mutability. Never leaks
  // another shop's bin: a shopId-null (unassigned) device is staff-only.
  app.get("/api/partner/devices/:id/logs", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
    const device = await storage.getDevice(Number(req.params.id));
    if (!device) return res.status(404).json({ error: "Device not found" });
    if (req.user!.role !== "STAFF") {
      if (!device.shopId || !(await isPartnerOfShop(req.user!.id, device.shopId)))
        return res.status(403).json({ error: "Not your device" });
    }
    const limit = Number(req.query.limit) || 200;
    const afterId = Number(req.query.afterId) || 0;
    res.json(await storage.getDeviceLogs(device.id, { limit, afterId }));
  });

  // Clear a bin's stored diagnostics. Unlike the read above this MUTATES, so it
  // needs write membership rather than mere visibility — a VIEWER can read the
  // logs but cannot erase them.
  //
  // Only the server-side copy goes. The bin keeps its own ring buffer and keeps
  // shipping, so a cleared view refills with genuinely new lines within seconds:
  // this is "give me a clean slate to reproduce against", not "stop logging".
  app.delete("/api/partner/devices/:id/logs", authMiddleware, requireRole("PARTNER", "STAFF"), asyncHandler(async (req, res) => {
    const device = await storage.getDevice(Number(req.params.id));
    if (!device) return res.status(404).json({ error: "Device not found" });
    if (req.user!.role !== "STAFF") {
      if (!device.shopId) return res.status(403).json({ error: "Not your device" });
      const err = await mutableShopError(req.user!.id, device.shopId);
      if (err) return res.status(403).json({ error: err });
    }
    const deleted = await storage.clearDeviceLogs(device.id);
    res.json({ ok: true, deleted });
  }));

  // Stand a bin down from a latched fire alarm. Deliberately its OWN route rather
  // than opening the general staff command endpoint to partners — a partner must
  // be able to clear a false alarm on their own bin without also gaining
  // FORMAT_SD/REBOOT. Same ownership check as the settings route.
  //
  // Resolving the alert here as well as on the device's FIRE_CLEAR event means the
  // dashboard clears immediately, even if the bin is offline and only picks the
  // command up later.
  app.post("/api/partner/devices/:id/clear-fire", authMiddleware, requireRole("PARTNER", "STAFF"), asyncHandler(async (req, res) => {
    const device = await storage.getDevice(Number(req.params.id));
    if (!device) return res.status(404).json({ error: "Device not found" });
    if (req.user!.role !== "STAFF") {
      if (!device.shopId) return res.status(403).json({ error: "Not your device" });
      const err = await mutableShopError(req.user!.id, device.shopId);
      if (err) return res.status(403).json({ error: err });
    }
    const c = await storage.enqueueCommand(device.id, "CLEAR_FIRE", {});
    await storage.resolveOpenAlerts(device.id, "FIRE");
    // Clear the sticky status column too. Resolving the ALERT was never enough:
    // Errors on the bin card and the Needs attention row both read
    // devices.error_log, which only the bin could write and older firmware never
    // wrote back to empty. An operator pressing "clear fire alarm" is a
    // deliberate statement that it is over — believe them here rather than
    // waiting for a bin that may never say so.
    await storage.updateDevice(device.id, { errorLog: null });
    res.json({ ok: true, command: c });
  }));

  app.put("/api/partner/devices/:id/settings", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
    const device = await storage.getDevice(Number(req.params.id));
    if (!device) return res.status(404).json({ error: "Device not found" });
    if (req.user!.role !== "STAFF") {
      // An unassigned device (shopId null — e.g. its shop was deleted) has no
      // shop membership to check, so a non-STAFF caller can never mutate it.
      if (!device.shopId) return res.status(403).json({ error: "Not your device" });
      const err = await mutableShopError(req.user!.id, device.shopId);
      if (err) return res.status(403).json({ error: err });
    }
    const validated = validateDeviceSettings(req.body ?? {});
    if (!validated.ok) return res.status(400).json({ error: validated.error });
    // Spec §7: partial updates merge server-side onto the stored JSON
    const existing = await storage.getDeviceSettings(device.id);
    const storedJson = (existing?.settingsJson as Record<string, unknown>) ?? {};
    const merged = mergeDeviceSettings(storedJson, validated.value);
    const s = await storage.upsertDeviceSettings(device.id, merged);

    // Nudge the bin instead of making it wait out its 60 s settings poll. The
    // command poll runs every 10 s, so a calibration change now reaches the
    // hardware in seconds — which is the difference between "saved" feeling like
    // it worked and the owner concluding the bin ignored them. Best-effort: if the
    // enqueue fails the poll still picks the change up on its normal cadence.
    try {
      await storage.enqueueCommand(device.id, "REFRESH_SETTINGS");
    } catch (e) {
      console.warn("[settings] REFRESH_SETTINGS enqueue failed", e);
    }

    // Fire detection is on by default and staying on is a safety expectation.
    // A PARTNER may turn it off, but doing so notifies LITTR staff (oversight).
    const wasEnabled = (storedJson as any)?.fire?.enabled !== false; // default true
    const nowDisabled = (merged as any)?.fire?.enabled === false;
    if (wasEnabled && nowDisabled && req.user!.role !== "STAFF") {
      void notifyFireDisabled(device, req.user!.email);
    }

    res.json(s);
  });

  // Partner "Mark Empty" enqueues a device command
  app.post("/api/partner/devices/:id/mark-empty", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
    const device = await storage.getDevice(Number(req.params.id));
    if (!device) return res.status(404).json({ error: "Device not found" });
    if (req.user!.role !== "STAFF") {
      // An unassigned device (shopId null — e.g. its shop was deleted) has no
      // shop membership to check, so a non-STAFF caller can never mutate it.
      if (!device.shopId) return res.status(403).json({ error: "Not your device" });
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
  app.post("/api/device/telemetry", deviceAuthMiddleware, deviceLimiter, asyncHandler(async (req, res) => {
    const body = z.object({
      vapesSinceEmpty: z.number().optional(),
      fillPercent: z.number().optional(),
      tempC: z.number().optional(),
      tempDevices: z.number().int().optional(),  // HW_FIXES_R3 temp diagnostics
      tempRawC: z.number().optional(),
      vocRaw: z.number().optional(),
      wifiRssi: z.number().optional(),
      sdFreeMb: z.number().optional(),
      rawDistanceMm: z.number().optional(),
      // Bounded like the OTA version fields (firmwareCheckQuery / claim-by-code
      // use .max(32)) so a device can't push multi-MB strings into the persisted
      // devices columns on every heartbeat.
      firmwareVersion: z.string().max(32).optional(),
      hmiVersion: z.string().max(32).optional(),      // HMI firmware version (spec §3.1)
      assetsVersion: z.string().max(32).optional(),   // HMI content-pack version (spec §3.1)
      state: z.string().optional(),
      errorLog: z.string().optional(),
    }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "bad telemetry" });
    const before = req.device!;
    const patch: any = { ...body.data, lastHeartbeatAt: new Date() };
    delete patch.state;
    delete patch.rawDistanceMm;
    // An empty errorLog means "nothing is wrong", which has to be able to CLEAR
    // the column. Firmware before 1.6.8 omits the field entirely when healthy,
    // so the value was write-only: a bin reported FIRE once and Errors / Needs
    // attention showed it forever. Newer firmware always sends the field.
    if (body.data.errorLog !== undefined && body.data.errorLog.trim() === "") {
      patch.errorLog = null;
    }
    if (body.data.rawDistanceMm !== undefined) patch.lastDistanceMm = body.data.rawDistanceMm;
    const after = await storage.updateDevice(before.id, patch);
    await evaluateTelemetry(before, after); // alert engine (spec §5)
    res.json({ ok: true });
  }));

  // Device-initiated alerts — fire and warnings are detected on-device (spec §2.2)
  app.post("/api/device/events", deviceAuthMiddleware, deviceLimiter, async (req, res) => {
    const body = z.object({
      // FIRE_CLEAR is the bin standing down — either its readings came back to
      // normal or an operator disarmed it. It resolves the open FIRE alert rather
      // than raising a new one, so the dashboard stops showing a fire that ended.
      type: z.enum(["FIRE", "FIRE_CLEAR", "TEMP_HIGH", "VOC_HIGH", "SD_ERROR", "CAMERA_ERROR", "UPDATE_FAILED"]),
      tempC: z.number().optional(),
      vocAnalog: z.number().optional(),
      fillPercent: z.number().optional(),
      message: z.string().optional(),
    }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "bad event" });
    const alertId = await handleDeviceEvent(req.device!, body.data);
    res.status(202).json({ alertId: alertId ?? null });
  });

  // Diagnostic log ingest — the bin's serial output, surfaced on the dashboard so
  // the operator (no serial access) can see temp/session/wifi/boot diagnostics.
  // Idempotent (dedup on deviceId,bootId,seq) so the sensor's at-least-once retry
  // is safe. Bounded per request; oversized msgs are truncated, not rejected.
  app.post("/api/device/logs", deviceAuthMiddleware, deviceLimiter, async (req, res) => {
    const body = z.object({
      bootId: z.number().int().nonnegative().max(2_000_000_000),
      lines: z.array(z.object({
        seq: z.number().int().nonnegative().max(2_000_000_000),
        level: z.enum(["DEBUG", "INFO", "WARN", "ERROR"]).optional(),
        tag: z.string().max(24).optional(),
        msg: z.string().max(240),
        atMs: z.number().int().nonnegative().optional(),
      })).max(64),
    }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "bad logs" });
    const { inserted, ackSeq } = await storage.insertDeviceLogs(
      req.device!.id,
      body.data.bootId,
      body.data.lines,
    );
    // Logs prove liveness too.
    await storage.updateDevice(req.device!.id, { lastHeartbeatAt: new Date() });
    res.json({ ok: true, inserted, ackSeq });
  });

  app.get("/api/device/settings", deviceAuthMiddleware, deviceLimiter, async (req, res) => {
    const have = Number((req.query.version as string) || 0);
    const s = await storage.getDeviceSettings(req.device!.id);
    if (!s) return res.json({ version: 0, settings: {} });
    // 304 ONLY on an exact match. `<=` meant that a device whose cached version
    // ran AHEAD of ours could never be corrected: the settings row is recreated
    // at version 1 whenever it is deleted (device removed and re-added, a table
    // rebuilt, a restored backup), while the device keeps its old number in NVS.
    // Every subsequent save adds 1, so the owner could edit the calibration
    // repeatedly and the bin would 304 every poll and never see any of it.
    // Serving the full settings on a mismatch in either direction lets the
    // device resynchronise downward on its very next poll.
    if (s.version === have) return res.status(304).end();
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

    // Completion of the two-phase bin removal (see DELETE /api/staff/devices/:id).
    // The firmware acks FACTORY_RESET *before* erasing its key precisely so this
    // ack still authenticates; by the time we delete the row the bin is already
    // on its way back to the pairing portal.
    if (c.type === "FACTORY_RESET" && (c.payload as any)?.removeAfter) {
      await storage.deleteDevice(req.device!.id);
      console.log(`[devices] bin ${req.device!.serial} un-paired and removed`);
    }
    res.json({ ok: true });
  });

  app.post("/api/device/drop-sessions/start", deviceAuthMiddleware, deviceLimiter, asyncHandler(async (req, res) => {
    // Offline sessions (captured while WiFi was down) award shop points but no
    // batteries/claim at finalize (spec §3.4).
    const body = z.object({ offline: z.boolean().optional() }).safeParse(req.body ?? {});
    if (!body.success) return res.status(400).json({ error: "bad body" });
    const s = await storage.createDropSession(req.device!.id, req.device!.shopId || null);
    if (body.data.offline) await storage.updateDropSession(s.id, { offline: true });
    res.json({ sessionId: s.id });
  }));

  app.post("/api/device/drops", deviceAuthMiddleware, deviceLimiter, asyncHandler(async (req, res) => {
    const body = z.object({
      sessionId: z.number(),
      sequence: z.number(),
      beamPatternJson: z.any().optional(),
      tempC: z.number().optional(),
      vocRaw: z.number().optional(),
      fillPercent: z.number().optional(),
      accepted: z.boolean().optional(),
      occurredAt: z.string().datetime({ offset: true }).optional(), // true drop time for offline drops (spec §3.4)
    }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "bad drop" });
    const { occurredAt, sessionId, sequence, ...dropData } = body.data;

    // Idempotent-by-(sessionId, sequence) (audit B3): the sensor retries the
    // identical drop up to 3× on any non-2xx. A lost 200 must NOT double-insert
    // or double-increment acceptedDropCount (→ double batteries + shop points at
    // finalize). We lock the session FOR UPDATE, then either return the existing
    // drop unchanged (replay) or insert-and-increment exactly once. The
    // ON CONFLICT DO NOTHING + re-select is belt-and-suspenders against a
    // concurrent identical retry racing inside the same lock window.
    const result = await db.transaction(async (tx) => {
      const [session] = await tx.select().from(dropSessions)
        .where(eq(dropSessions.id, sessionId)).for("update");
      if (!session || session.deviceId !== req.device!.id) return { kind: "notfound" as const };

      const [existing] = await tx.select({ id: drops.id }).from(drops)
        .where(and(eq(drops.sessionId, sessionId), eq(drops.sequence, sequence)));
      if (existing) return { kind: "duplicate" as const, dropId: existing.id };

      if (session.status !== "OPEN") return { kind: "closed" as const };

      const [inserted] = await tx.insert(drops).values({
        sessionId,
        sequence,
        ...dropData,
        occurredAt: occurredAt ? new Date(occurredAt) : undefined,
      } as any).onConflictDoNothing({ target: [drops.sessionId, drops.sequence] }).returning({ id: drops.id });

      if (!inserted) {
        // Lost the insert race to a concurrent identical retry — re-select it and
        // do NOT increment (the winning insert already did).
        const [row] = await tx.select({ id: drops.id }).from(drops)
          .where(and(eq(drops.sessionId, sessionId), eq(drops.sequence, sequence)));
        return { kind: "duplicate" as const, dropId: row.id };
      }

      // Accepted-count increment is tied to a genuine new insert only.
      await tx.update(dropSessions).set({
        detectedDropCount: session.detectedDropCount + 1,
        acceptedDropCount: session.acceptedDropCount + (body.data.accepted === false ? 0 : 1),
      }).where(eq(dropSessions.id, sessionId));

      return { kind: "created" as const, dropId: inserted.id };
    });

    if (result.kind === "notfound") return res.status(404).json({ error: "Session not found" });
    if (result.kind === "closed") return res.status(400).json({ error: "Session not open" });
    // Both a fresh insert and a replayed duplicate return { dropId } (200).
    res.json({ dropId: result.dropId });
  }));

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
    // Express 4 does NOT forward an async handler's rejection to the error
    // middleware in server/index.ts, and there is no asyncHandler wrapper here —
    // so an uncaught throw past this point sends NO response at all (the device
    // sits on a dead socket until its own timeout) and, with no
    // unhandledRejection listener, terminates the process on Node >= 15. The
    // driver contract (server/blobstore/driver.ts, DURABILITY SEMANTICS) REQUIRES
    // putPhoto to throw when the bytes did not land, so this catch is what turns
    // that into something the device can retry against.
    let url: string;
    try {
      ({ url } = await storageDriver.putPhoto(req.device!.id, buf!));
    } catch (e) {
      console.error("[photos] putPhoto failed", { deviceId: req.device!.id, dropId, err: e });
      return res.status(500).json({ error: "Storage unavailable" });
    }
    try {
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
    } catch (e) {
      console.error("[photos] recording drop photo failed", { deviceId: req.device!.id, dropId, url, err: e });
      return res.status(500).json({ error: "Could not record photo" });
    }
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
    // Same Express-4 reasoning as /api/device/drops/:dropId/photos above: an
    // unhandled rejection here is a dead socket, not a 500.
    let url: string;
    try {
      ({ url } = await storageDriver.putPhoto(req.device!.id, buf!));
    } catch (e) {
      console.error("[photos] putPhoto failed", { deviceId: req.device!.id, reason: body.data.reason, err: e });
      return res.status(500).json({ error: "Storage unavailable" });
    }
    try {
      const photo = await storage.createPhoto({
        deviceId: req.device!.id, sessionId: body.data.sessionId, storageUrl: url, reason: body.data.reason,
      } as any);
      await storage.updateDevice(req.device!.id, { latestPhotoUrl: url, latestPhotoTakenAt: new Date() });
      res.json({ photoId: photo.id, url });
    } catch (e) {
      console.error("[photos] recording photo failed", { deviceId: req.device!.id, url, err: e });
      return res.status(500).json({ error: "Could not record photo" });
    }
  });

  // Finalize a session: award shop points, generate claim token.
  // Wrapped in a transaction with SELECT ... FOR UPDATE on the session so two
  // concurrent finalizes (e.g. a device network-retry arriving mid-flight) can't
  // both pass the status===OPEN check and both insert an EARNED shop-point row —
  // the second blocks on the lock, then sees FINALIZED and 400s. (Batteries are
  // already race-safe via UNIQUE(session_id) at claim time.)
  app.post("/api/device/drop-sessions/:id/finalize", deviceAuthMiddleware, deviceLimiter, asyncHandler(async (req, res) => {
    const sessionId = Number(req.params.id);
    const device = req.device!;

    const outcome = await db.transaction(async (tx) => {
      const [session] = await tx.select().from(dropSessions)
        .where(eq(dropSessions.id, sessionId)).for("update");
      if (!session || session.deviceId !== device.id) return { kind: "notfound" as const };

      // Idempotent-by-replay (audit M-8): a repeat finalize on an already-non-OPEN
      // session owned by this device must return the EXISTING outcome — never award
      // again. A lost 200 otherwise orphans the claim (shop keeps points, customer
      // can never scan). Only genuinely-OPEN sessions run the awarding path below.
      if (session.status !== "OPEN") {
        const replay = finalizeReplayKind(session.status, session.offline);
        if (replay === "expired") return { kind: "expired" as const };
        if (replay === "offline") return { kind: "offline" as const, shopPoints: session.shopPointsAwarded };
        return {
          kind: "finalized" as const,
          batteries: session.batteriesEstimated,
          shopPoints: session.shopPointsAwarded,
          claimToken: session.claimToken!,
          expiresAt: session.expiresAt!,
        };
      }

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

      // Offline sessions award shop points normally but no batteries and mint no
      // claim token (spec §3.4). Pure decision lives in ./offlineFinalize.
      const decision = finalizeDecision({
        offline: session.offline,
        acceptedDropCount: session.acceptedDropCount,
        perVape: ptsPer,
        batteriesPerVape: battsPer,
      });
      const claimToken = decision.mintClaim ? generateClaimToken() : null;
      const expiresAt = decision.mintClaim ? new Date(Date.now() + ttlSec * 1000) : null;

      await tx.update(dropSessions).set({
        status: decision.status,
        batteriesEstimated: decision.batteries,
        shopPointsAwarded: decision.shopPoints,
        claimToken,
        expiresAt,
        finalizedAt: new Date(),
      }).where(eq(dropSessions.id, sessionId));

      // Award shop points immediately (no QR scan needed) — live and offline alike
      if (session.shopId && decision.shopPoints > 0) {
        await tx.insert(shopPointTransactions).values({
          shopId: session.shopId, deviceId: device.id, sessionId,
          amount: decision.shopPoints, type: "EARNED", status: "POSTED",
          description: `${session.acceptedDropCount} vape drop(s)`,
        });
      }

      if (session.offline) {
        return { kind: "offline" as const, shopPoints: decision.shopPoints };
      }
      return {
        kind: "finalized" as const,
        batteries: decision.batteries,
        shopPoints: decision.shopPoints,
        claimToken: claimToken!,
        expiresAt: expiresAt!,
      };
    });

    if (outcome.kind === "notfound") return res.status(404).json({ error: "Session not found" });
    if (outcome.kind === "expired") {
      return res.json({ ok: true, batteries: 0, claimToken: null, claimUrl: null, expired: true });
    }
    if (outcome.kind === "offline") {
      // No batteries, no claim token/URL — shop points only (spec §3.4).
      return res.json({ ok: true, offline: true, shopPoints: outcome.shopPoints, batteries: 0, claimToken: null, claimUrl: null });
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
  }));

  // ==================== STAFF ====================
  app.get("/api/staff/devices", authMiddleware, requireRole("STAFF"), async (_req, res) => {
    const list = await storage.getAllDevices();
    res.json(list);
  });

  app.get("/api/staff/devices/:id/commands", authMiddleware, requireRole("STAFF"), async (req, res) => {
    res.json(await storage.getCommandsByDevice(Number(req.params.id), 100));
  });

  // Bin diagnostic logs (staff — any device incl. unassigned).
  app.get("/api/staff/devices/:id/logs", authMiddleware, requireRole("STAFF"), async (req, res) => {
    const limit = Number(req.query.limit) || 200;
    const afterId = Number(req.query.afterId) || 0;
    res.json(await storage.getDeviceLogs(Number(req.params.id), { limit, afterId }));
  });

  app.delete("/api/staff/devices/:id/logs", authMiddleware, requireRole("STAFF"), asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Invalid device id" });
    const deleted = await storage.clearDeviceLogs(id);
    res.json({ ok: true, deleted });
  }));

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

  // Clear the command HISTORY for a bin. Settled rows by default; ?all=true also
  // removes still-PENDING ones. The bin polls for `id > lastCommandId`, so
  // deleting old rows is invisible to it — this is housekeeping for the operator
  // reading the list, not a change to what the bin will do.
  app.delete("/api/staff/devices/:id/commands", authMiddleware, requireRole("STAFF"), asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Invalid device id" });
    const deleted = await storage.clearCommands(id, req.query.all === "true");
    res.json({ ok: true, deleted });
  }));

  // Cancel a still-pending command (misclick). No-op once the bin has polled it.
  app.delete("/api/staff/devices/:id/commands/:commandId", authMiddleware, requireRole("STAFF"), async (req, res) => {
    const deviceId = Number(req.params.id);
    const commandId = Number(req.params.commandId);
    if (!Number.isInteger(deviceId) || !Number.isInteger(commandId))
      return res.status(400).json({ error: "Invalid id" });
    const c = await storage.cancelCommand(commandId, deviceId);
    if (!c) return res.status(409).json({ error: "Command already sent to the bin or not found — cannot cancel" });
    res.json({ ok: true, command: c });
  });

  // Remove a bin — UNPAIRING IT FIRST.
  //
  // Deleting the row on its own leaves the physical bin holding a key nobody
  // honours. It does eventually notice (three consecutive auth rejections trip
  // cloudKeyRevoked and it reboots into the setup portal), but that is a failure
  // path, not a handover: it takes several polls, it looks like an outage to
  // anyone standing at the bin, and if the bin happens to be offline at the
  // moment of deletion it can sit on a dead key indefinitely.
  //
  // So removal is two-phase. We queue FACTORY_RESET tagged `removeAfter`, and the
  // row is deleted when the bin ACKS it (see the ack route) — by which point the
  // bin has wiped its credentials and rebooted into the pairing portal, ready to
  // be paired again. The device row must stay LIVE until then: deviceAuthMiddleware
  // 403s a RETIRED device, and a bin that cannot authenticate cannot collect the
  // very command that frees it.
  //
  // `?force=true` skips straight to deletion, for a bin that is dead, lost, or
  // already unpaired and will never ack.
  app.delete("/api/staff/devices/:id", authMiddleware, requireRole("STAFF"), asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const device = await storage.getDevice(id);
    if (!device) return res.status(404).json({ error: "Device not found" });

    const force = req.query.force === "true";
    if (force) {
      await storage.deleteDevice(id);
      return res.json({ ok: true, removed: true, unpaired: false });
    }

    await storage.enqueueCommand(id, "FACTORY_RESET", { removeAfter: true });
    res.json({
      ok: true,
      removed: false,
      pending: true,
      message: "Un-pairing the bin — it will be removed once it confirms (usually within ~10s). Use Force remove if it never does.",
    });
  }));

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
