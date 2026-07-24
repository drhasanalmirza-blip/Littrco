import { Router } from "express";
import { z } from "zod";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import {
  firmwareReleases, pairingCodes, photos, shopMembers,
  type FirmwareRelease, type PairingCode,
} from "@shared/schema";
import { db } from "../db";
import { storage } from "../storage";
import {
  authMiddleware, requireRole, deviceAuthMiddleware,
  hashDeviceKey, generateDeviceKey, generateSerial,
} from "../auth";
import { rateLimitByIp, deviceLimiter } from "../ratelimit";
import { generatePairCode } from "../paircode";
import { buildClaimByCodeUpdate } from "../claimByCode";
import { decodeDataUrlOrBase64 } from "../blob";
import { absoluteUrl, storageDriver } from "../blobstore";

// Device ops: live camera, firmware/OTA, calibration, pairing
// (spec §3.2, §3.4, §4.3, §4.4, §2.3, §2.4).
const router = Router();

// P3-S0 — artifact hosting. Staff upload a firmware .bin / content .raw; the
// server stores it, computes the SHA-256, and returns an absolute littr.co URL
// the Firmware/Content create forms then submit. Keeping the artifact on
// littr.co (not S3) means the sensor's pinned-to-littr.co TLS client can
// download it. base64-in-JSON (like the photo route) avoids a multipart dep.
// Where the bytes actually land is now the StorageDriver's call (server/blobstore);
// the TLS/redirect constraints an off-box origin must satisfy are spelled out in
// the TODO(s3) contract there.
const MAX_ARTIFACT_BYTES = 8 * 1024 * 1024; // 8 MB (esp32 apps + 800x480 raw wallpapers fit)
const uploadBody = z.object({
  kind: z.enum(["firmware", "content"]),
  filename: z.string().min(1).max(200),
  dataBase64: z.string().min(1),
});

function resolveBaseUrl(req: { protocol: string; get(h: string): string | undefined }): string {
  const env = process.env.BASE_URL?.replace(/\/+$/, "");
  if (env) return env;
  return `${req.protocol}://${req.get("host")}`;
}

router.post("/api/staff/upload", authMiddleware, requireRole("STAFF"), async (req, res) => {
  const body = uploadBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "kind, filename, dataBase64 required" });
  const buf = decodeDataUrlOrBase64(body.data.dataBase64);
  if (!buf || buf.length === 0) return res.status(400).json({ error: "Invalid base64 data" });
  if (buf.length > MAX_ARTIFACT_BYTES) return res.status(400).json({ error: "File too large (max 8 MB)" });
  // putArtifact is REQUIRED to throw when the object is not durably stored
  // (server/blobstore/driver.ts, DURABILITY SEMANTICS). Express 4 does not
  // forward an async handler's rejection to the error middleware, so without
  // this catch that throw would send no response at all and kill the process on
  // Node >= 15 — and a half-written artifact would look like a hung upload.
  try {
    const { relUrl, sha256, sizeBytes } = await storageDriver.putArtifact(body.data.kind, body.data.filename, buf);
    // Local disk hands back a root-relative URL that needs this origin prefixed; a
    // bucket driver already returns an absolute one. absoluteUrl() handles both.
    res.json({ url: absoluteUrl(relUrl, resolveBaseUrl(req)), sha256, sizeBytes });
  } catch (e) {
    console.error("[upload] putArtifact failed", { kind: body.data.kind, filename: body.data.filename, err: e });
    return res.status(500).json({ error: "Storage unavailable" });
  }
});

const PAIR_CODE_TTL_MS = 10 * 60 * 1000;
const PG_UNIQUE_VIOLATION = "23505";

// Spec §2.7 / §2.3: general device routes share the single 120/min per-device
// window (deviceLimiter, imported from ../ratelimit); claim-by-code is a
// guessable-code exchange — hard 10/min/IP.
const claimByCodeLimiter = rateLimitByIp(10);

async function isPartnerOfShop(userId: string, shopId: number): Promise<boolean> {
  return storage.isShopMember(userId, shopId);
}

async function partnerRoleForShop(userId: string, shopId: number) {
  const [m] = await db.select({ role: shopMembers.role }).from(shopMembers)
    .where(and(eq(shopMembers.userId, userId), eq(shopMembers.shopId, shopId)));
  return m?.role ?? null;
}

// Shared by the staff (§3.4) and partner (§4.4) pair-code routes: a fresh
// PROVISIONING device plus its single-use SoftAP pairing code. The key hash is
// a throwaway — the real device key is minted at claim-by-code (§2.3).
async function createPairCodeForShop(shopId: number, userId: string) {
  const device = await storage.createDevice({
    serial: generateSerial(),
    deviceKeyHash: hashDeviceKey(generateDeviceKey()),
    shopId,
    partnerId: userId,
    status: "PROVISIONING",
  } as any);
  const expiresAt = new Date(Date.now() + PAIR_CODE_TTL_MS);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const [row] = await db.insert(pairingCodes)
        .values({ code: generatePairCode(), deviceId: device.id, createdByUserId: userId, expiresAt })
        .returning();
      return { deviceId: device.id, serial: device.serial, code: row.code, expiresAt: row.expiresAt };
    } catch (e: any) {
      if (e?.code !== PG_UNIQUE_VIOLATION) throw e; // collision → regenerate
    }
  }
  throw new Error("Could not allocate a unique pair code");
}

// Atomic single-use consume, same pattern as storage.consumePairingNonce: the
// conditional update on consumedAt IS NULL is what makes concurrent claims safe.
async function consumePairingCode(code: string): Promise<PairingCode | undefined> {
  const [p] = await db.select().from(pairingCodes).where(eq(pairingCodes.code, code));
  if (!p || p.consumedAt || p.expiresAt < new Date()) return undefined;
  const [updated] = await db.update(pairingCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(pairingCodes.id, p.id), isNull(pairingCodes.consumedAt)))
    .returning();
  return updated;
}

// Query params arrive as strings; "" (bare `&afterId=`) means "not supplied"
const emptyToUndefined = (v: unknown) => (v === "" || v === undefined ? undefined : v);

// ==================== §3.2 Live camera ====================

router.post("/api/staff/devices/:id/snapshot", authMiddleware, requireRole("STAFF"), async (req, res) => {
  const body = z.object({ ir: z.boolean() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "ir (boolean) required" });
  const device = await storage.getDevice(Number(req.params.id));
  if (!device) return res.status(404).json({ error: "Device not found" });
  const cmd = await storage.enqueueCommand(device.id, "TAKE_PHOTO", { ir: body.data.ir });
  res.json({ commandId: cmd.id });
});

const staffPhotosQuery = z.object({
  reason: z.preprocess(emptyToUndefined,
    z.enum(["idle", "drop_before", "drop_after", "maintenance", "calibration", "live"]).optional()),
  limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(100).default(10)),
  afterId: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
});

router.get("/api/staff/devices/:id/photos", authMiddleware, requireRole("STAFF"), async (req, res) => {
  const q = staffPhotosQuery.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: "Invalid query" });
  const device = await storage.getDevice(Number(req.params.id));
  if (!device) return res.status(404).json({ error: "Device not found" });
  const conds = [eq(photos.deviceId, device.id)];
  if (q.data.reason) conds.push(eq(photos.reason, q.data.reason));
  if (q.data.afterId !== undefined) conds.push(gt(photos.id, q.data.afterId));
  const rows = await db.select().from(photos)
    .where(and(...conds))
    .orderBy(desc(photos.id))
    .limit(q.data.limit);
  res.json(rows);
});

// ==================== §3.4 Devices & firmware ====================

router.post("/api/staff/devices/:id/points-modifier", authMiddleware, requireRole("STAFF"), async (req, res) => {
  const body = z.object({
    pointsPerVapeOverride: z.number().int().min(0).max(1000).nullable(),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "pointsPerVapeOverride (number | null) required" });
  const device = await storage.getDevice(Number(req.params.id));
  if (!device) return res.status(404).json({ error: "Device not found" });
  const updated = await storage.updateDevice(device.id, { pointsPerVapeOverride: body.data.pointsPerVapeOverride });
  res.json({ ok: true, pointsPerVapeOverride: updated.pointsPerVapeOverride });
});

router.get("/api/staff/firmware", authMiddleware, requireRole("STAFF"), async (_req, res) => {
  res.json(await db.select().from(firmwareReleases).orderBy(desc(firmwareReleases.createdAt)));
});

const firmwareCreateBody = z.object({
  board: z.enum(["sensor", "hmi"]),
  version: z.string().min(1).max(32),
  channel: z.enum(["stable", "beta"]).default("stable"),
  url: z.string().url(),
  sha256: z.string().regex(/^[0-9a-fA-F]{64}$/, "expected 64 hex chars"),
  sizeBytes: z.number().int().min(0).optional(),
  notes: z.string().max(2000).optional(),
  active: z.boolean().optional(),
});

router.post("/api/staff/firmware", authMiddleware, requireRole("STAFF"), async (req, res) => {
  const body = firmwareCreateBody.safeParse(req.body);
  if (!body.success) {
    const issue = body.error.issues[0];
    return res.status(400).json({ error: `${issue.path.join(".")}: ${issue.message}` });
  }
  try {
    const [release] = await db.insert(firmwareReleases).values(body.data).returning();
    res.json(release);
  } catch (e: any) {
    if (e?.code === PG_UNIQUE_VIOLATION)
      return res.status(409).json({ error: "Release already exists for this board/version/channel" });
    throw e;
  }
});

router.patch("/api/staff/firmware/:id", authMiddleware, requireRole("STAFF"), async (req, res) => {
  const body = z.object({
    active: z.boolean().optional(),
    notes: z.string().max(2000).nullable().optional(),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "active and/or notes expected" });
  if (body.data.active === undefined && body.data.notes === undefined)
    return res.status(400).json({ error: "Nothing to update" });
  const [release] = await db.update(firmwareReleases).set(body.data)
    .where(eq(firmwareReleases.id, Number(req.params.id)))
    .returning();
  if (!release) return res.status(404).json({ error: "Release not found" });
  res.json(release);
});

router.post("/api/staff/devices/:id/ota", authMiddleware, requireRole("STAFF"), async (req, res) => {
  const body = z.object({
    version: z.string().min(1).max(32).nullable(),
    board: z.enum(["sensor", "hmi"]).default("sensor"),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "version (string | null) required" });
  const device = await storage.getDevice(Number(req.params.id));
  if (!device) return res.status(404).json({ error: "Device not found" });
  const { version, board } = body.data;
  // §4.2: only the sensor board pins devices.targetFirmwareVersion. The HMI
  // target version is tracked implicitly via content/telemetry, so board=hmi
  // must NOT overwrite the sensor's targetFirmwareVersion.
  if (board === "sensor") {
    await storage.updateDevice(device.id, { targetFirmwareVersion: version });
  }
  let commandId: number | undefined;
  if (version !== null) {
    const cmd = await storage.enqueueCommand(device.id, "UPDATE_FIRMWARE", { version, board });
    commandId = cmd.id;
  }
  const targetFirmwareVersion = board === "sensor" ? version : device.targetFirmwareVersion;
  res.json({ ok: true, board, targetFirmwareVersion, ...(commandId !== undefined ? { commandId } : {}) });
});

// §4.1: `POST /api/staff/devices/:id/update-assets` lives in routes/content.ts
// (alongside the rest of content management). It was previously duplicated here,
// but this router mounts BEFORE contentRouter so this copy shadowed the intended
// one — removed to keep a single source of truth.

router.post("/api/staff/shops/:id/pair-code", authMiddleware, requireRole("STAFF"), async (req, res) => {
  const shop = await storage.getShop(Number(req.params.id));
  if (!shop) return res.status(404).json({ error: "Shop not found" });
  res.json(await createPairCodeForShop(shop.id, req.user!.id));
});

// ==================== §4.3 Fill calibration ====================

router.get("/api/partner/devices/:id/live-fill", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
  const device = await storage.getDevice(Number(req.params.id));
  if (!device) return res.status(404).json({ error: "Device not found" });
  if (req.user!.role !== "STAFF" && device.shopId && !(await isPartnerOfShop(req.user!.id, device.shopId)))
    return res.status(403).json({ error: "Not your device" });
  res.json({
    fillPercent: device.fillPercent,
    rawDistanceMm: device.lastDistanceMm,
    lastHeartbeatAt: device.lastHeartbeatAt,
  });
});

router.post("/api/partner/devices/:id/calibrate", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
  const body = z.object({
    seconds: z.number().int().min(5).max(600).default(60),
  }).safeParse(req.body ?? {});
  if (!body.success) return res.status(400).json({ error: "seconds must be 5-600" });
  const device = await storage.getDevice(Number(req.params.id));
  if (!device) return res.status(404).json({ error: "Device not found" });
  if (req.user!.role !== "STAFF" && device.shopId) {
    // Mutating route — VIEWER members are read-only (spec §4.2)
    const role = await partnerRoleForShop(req.user!.id, device.shopId);
    if (role === null) return res.status(403).json({ error: "Not your device" });
    if (role === "VIEWER") return res.status(403).json({ error: "Forbidden" });
  }
  const cmd = await storage.enqueueCommand(device.id, "CALIBRATE_FILL", { seconds: body.data.seconds });
  res.json({ ok: true, commandId: cmd.id });
});

// ==================== §4.4 Pairing (partner-scoped, OWNER or MANAGER) ====================

router.post("/api/partner/shops/:id/pair-code", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
  const shop = await storage.getShop(Number(req.params.id));
  if (!shop) return res.status(404).json({ error: "Shop not found" });
  if (req.user!.role !== "STAFF") {
    const role = await partnerRoleForShop(req.user!.id, shop.id);
    if (role === null) return res.status(403).json({ error: "Not your shop" });
    if (role !== "OWNER" && role !== "MANAGER") return res.status(403).json({ error: "Forbidden" });
  }
  res.json(await createPairCodeForShop(shop.id, req.user!.id));
});

// ==================== §2.3 SoftAP pairing exchange ====================
// Deliberately no device key (the device does not have one yet); TLS only.

router.post("/api/device/claim-by-code", claimByCodeLimiter, async (req, res) => {
  const body = z.object({
    code: z.string().trim().toUpperCase().length(6),
    uid: z.string().trim().min(4).max(64),
    firmwareVersion: z.string().max(32).optional(),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "code and uid required" });
  const consumed = await consumePairingCode(body.data.code);
  if (!consumed) return res.status(400).json({ error: "Invalid or expired code" });
  const device = await storage.getDevice(consumed.deviceId);
  if (!device) return res.status(404).json({ error: "Device not found" });
  // Fresh key, returned exactly once — only its hash is stored. shopId is left
  // untouched by design so the bin stays attached to its shop (W2a).
  const deviceKey = generateDeviceKey();
  const updated = await storage.updateDevice(
    device.id,
    buildClaimByCodeUpdate(device, body.data, { deviceKeyHash: hashDeviceKey(deviceKey), now: new Date() }),
  );
  res.json({ deviceId: device.id, serial: updated.serial, deviceKey, shopId: device.shopId });
});

// ==================== §2.4 OTA check ====================

const firmwareCheckQuery = z.object({
  board: z.enum(["sensor", "hmi"]),
  channel: z.preprocess(emptyToUndefined, z.enum(["stable", "beta"]).default("stable")),
  version: z.preprocess(emptyToUndefined, z.string().max(32).optional()),
});

router.get("/api/device/firmware", deviceAuthMiddleware, deviceLimiter, async (req, res) => {
  const q = firmwareCheckQuery.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: "board (sensor|hmi) required" });
  const { board, channel, version } = q.data;
  // Audit M-2: devices.targetFirmwareVersion is only pinned for the sensor board
  // (POST /ota writes it only when board==='sensor'). Applying it to board=hmi
  // queries silently blocks HMI OTA (204) or, on a coincidental version match,
  // serves the wrong image. Ignore the sensor pin for hmi → serve newest active.
  const target = board === "sensor" ? req.device!.targetFirmwareVersion : null;

  let release: FirmwareRelease | undefined;
  if (target) {
    // Staff-pinned target wins — and holds even when a newer release exists
    if (version === target) return res.status(204).end();
    const rows = await db.select().from(firmwareReleases)
      .where(and(
        eq(firmwareReleases.board, board),
        eq(firmwareReleases.version, target),
        eq(firmwareReleases.active, true),
      ))
      .orderBy(desc(firmwareReleases.createdAt));
    release = rows.find(r => r.channel === channel) ?? rows[0];
    if (!release) return res.status(204).end(); // pinned version has no active release
  } else {
    [release] = await db.select().from(firmwareReleases)
      .where(and(
        eq(firmwareReleases.board, board),
        eq(firmwareReleases.channel, channel),
        eq(firmwareReleases.active, true),
      ))
      .orderBy(desc(firmwareReleases.createdAt))
      .limit(1);
  }

  if (!release || release.version === version) return res.status(204).end();
  res.json({ version: release.version, url: release.url, sha256: release.sha256, sizeBytes: release.sizeBytes });
});

export default router;
