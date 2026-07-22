import { Router } from "express";
import { z } from "zod";
import { and, desc, eq, gte, isNull, isNotNull, lte, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  devices, drops, dropSessions, photos, rewardConfigs, selfReports, shops,
  batteryTransactions, shopPointTransactions,
  type Drop, type DropSession, type SelfReport,
} from "@shared/schema";
import { db } from "../db";
import { authMiddleware, requireRole } from "../auth";
import {
  planApprove, planReject,
  type ReviewRates, type RevocationPlan,
} from "../reviewRules";

// Staff drop review + revocation semantics (spec §3.1, §6).
const router = Router();

// Mirror the finalize defaults in routes.ts (used when a shop has no reward config)
const DEFAULT_BATTERIES_PER_VAPE = 5;
const DEFAULT_SHOP_POINTS_PER_VAPE = 1;

const beforePhotos = alias(photos, "before_photos");
const afterPhotos = alias(photos, "after_photos");

// Query params arrive as strings; "" (bare `&shopId=`) means "not supplied"
const emptyToUndefined = (v: unknown) => (v === "" || v === undefined ? undefined : v);
const optionalInt = (opts: { min?: number } = {}) =>
  z.preprocess(emptyToUndefined, z.coerce.number().int().min(opts.min ?? 1).optional());
const optionalDate = z.preprocess(emptyToUndefined, z.coerce.date().optional());

function dropRow(d: Drop) {
  return {
    id: d.id,
    sessionId: d.sessionId,
    sequence: d.sequence,
    accepted: d.accepted,
    reviewStatus: d.reviewStatus,
    reviewedByUserId: d.reviewedByUserId,
    reviewedAt: d.reviewedAt,
    reviewNote: d.reviewNote,
    pointsRevoked: d.pointsRevoked,
    beamPatternJson: d.beamPatternJson,
    tempC: d.tempC,
    vocRaw: d.vocRaw,
    fillPercent: d.fillPercent,
    createdAt: d.createdAt,
  };
}

function sessionRow(s: DropSession) {
  return {
    id: s.id,
    deviceId: s.deviceId,
    shopId: s.shopId,
    status: s.status,
    detectedDropCount: s.detectedDropCount,
    acceptedDropCount: s.acceptedDropCount,
    batteriesEstimated: s.batteriesEstimated,
    batteriesConfirmed: s.batteriesConfirmed,
    shopPointsAwarded: s.shopPointsAwarded,
    claimed: s.claimedByCustomerId !== null,
    claimedByCustomerId: s.claimedByCustomerId,
    claimedAt: s.claimedAt,
    expiresAt: s.expiresAt,
    createdAt: s.createdAt,
    finalizedAt: s.finalizedAt,
  };
}

function selfReportRow(sr: SelfReport) {
  return {
    id: sr.id,
    sessionId: sr.sessionId,
    customerId: sr.customerId,
    brand: sr.brand,
    model: sr.model,
    puffCount: sr.puffCount,
    isThc: sr.isThc,
    notes: sr.notes,
    createdAt: sr.createdAt,
  };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// The per-vape rates a session's grants were computed with (recomputed from the
// CURRENT config + device override — see the caveat in reviewRules.planReject).
async function loadRates(tx: Tx, session: DropSession): Promise<ReviewRates> {
  const cfg = session.shopId
    ? (await tx.select().from(rewardConfigs).where(eq(rewardConfigs.shopId, session.shopId)))[0]
    : undefined;
  const [device] = await tx.select({ override: devices.pointsPerVapeOverride })
    .from(devices).where(eq(devices.id, session.deviceId));
  return {
    batteriesPerVape: cfg?.batteriesPerVape ?? DEFAULT_BATTERIES_PER_VAPE,
    shopPointsPerVape: cfg?.shopPointsPerVape ?? DEFAULT_SHOP_POINTS_PER_VAPE,
    pointsPerVapeOverride: device?.override ?? null,
  };
}

// Apply the computed plan's session update and ledger entries (drop update is
// folded into the caller's review-stamp update so it is a single write).
async function applyPlan(tx: Tx, session: DropSession, plan: RevocationPlan) {
  if (plan.sessionUpdate.acceptedDropCount !== undefined
    || plan.sessionUpdate.batteriesEstimated !== undefined) {
    await tx.update(dropSessions).set(plan.sessionUpdate).where(eq(dropSessions.id, session.id));
  }
  if (plan.shopPointEntry) await tx.insert(shopPointTransactions).values(plan.shopPointEntry);
  if (plan.batteryEntry) await tx.insert(batteryTransactions).values(plan.batteryEntry);
}

// ==================== Review queue ====================

const queueQuery = z.object({
  status: z.preprocess(emptyToUndefined,
    z.enum(["UNREVIEWED", "APPROVED", "REJECTED", "all"]).optional()),
  shopId: optionalInt(),
  deviceId: optionalInt(),
  limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(200).default(50)),
  offset: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).default(0)),
});

router.get("/api/staff/review/queue", authMiddleware, requireRole("STAFF"), async (req, res) => {
  const q = queueQuery.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: "Invalid query" });
  const conds: SQL[] = [];
  if (q.data.status && q.data.status !== "all") conds.push(eq(drops.reviewStatus, q.data.status));
  if (q.data.shopId !== undefined) conds.push(eq(dropSessions.shopId, q.data.shopId));
  if (q.data.deviceId !== undefined) conds.push(eq(dropSessions.deviceId, q.data.deviceId));

  const rows = await db.select({
    drop: drops,
    session: dropSessions,
    device: { id: devices.id, serial: devices.serial, status: devices.status },
    shop: { id: shops.id, name: shops.name, city: shops.city },
    beforeUrl: beforePhotos.storageUrl,
    afterUrl: afterPhotos.storageUrl,
  })
    .from(drops)
    .innerJoin(dropSessions, eq(dropSessions.id, drops.sessionId))
    .innerJoin(devices, eq(devices.id, dropSessions.deviceId))
    .leftJoin(shops, eq(shops.id, dropSessions.shopId))
    .leftJoin(beforePhotos, eq(beforePhotos.id, drops.beforePhotoId))
    .leftJoin(afterPhotos, eq(afterPhotos.id, drops.afterPhotoId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(drops.createdAt), desc(drops.id))
    .limit(q.data.limit)
    .offset(q.data.offset);

  res.json(rows.map(r => ({
    ...dropRow(r.drop),
    beforeUrl: r.beforeUrl,
    afterUrl: r.afterUrl,
    session: sessionRow(r.session),
    device: r.device,
    shop: r.shop,
  })));
});

// ==================== Drop detail ====================

router.get("/api/staff/review/drops/:dropId", authMiddleware, requireRole("STAFF"), async (req, res) => {
  const dropId = Number(req.params.dropId);
  if (!Number.isInteger(dropId) || dropId < 1) return res.status(400).json({ error: "Invalid drop id" });
  const [drop] = await db.select().from(drops).where(eq(drops.id, dropId));
  if (!drop) return res.status(404).json({ error: "Drop not found" });
  const [session] = await db.select().from(dropSessions).where(eq(dropSessions.id, drop.sessionId));
  if (!session) return res.status(404).json({ error: "Session not found" });

  const [device] = await db.select().from(devices).where(eq(devices.id, session.deviceId));
  const shop = session.shopId
    ? (await db.select().from(shops).where(eq(shops.id, session.shopId)))[0] ?? null
    : null;
  const dropPhotos = await db.select().from(photos)
    .where(eq(photos.dropId, drop.id)).orderBy(photos.id);
  const [selfReport] = await db.select().from(selfReports)
    .where(eq(selfReports.sessionId, session.id));

  const before = dropPhotos.find(p => p.id === drop.beforePhotoId)
    ?? dropPhotos.find(p => p.reason === "drop_before");
  const after = dropPhotos.find(p => p.id === drop.afterPhotoId)
    ?? dropPhotos.find(p => p.reason === "drop_after");

  res.json({
    drop: dropRow(drop),
    beforeUrl: before?.storageUrl ?? null,
    afterUrl: after?.storageUrl ?? null,
    photos: dropPhotos,
    session: sessionRow(session),
    device: device ? {
      id: device.id, serial: device.serial, status: device.status,
      shopId: device.shopId, firmwareVersion: device.firmwareVersion,
      pointsPerVapeOverride: device.pointsPerVapeOverride,
    } : null,
    shop: shop ? { id: shop.id, name: shop.name, city: shop.city, status: shop.status } : null,
    selfReport: selfReport ? selfReportRow(selfReport) : null,
  });
});

// ==================== Approve / Reject ====================

router.post("/api/staff/review/drops/:dropId/approve", authMiddleware, requireRole("STAFF"), async (req, res) => {
  const dropId = Number(req.params.dropId);
  if (!Number.isInteger(dropId) || dropId < 1) return res.status(400).json({ error: "Invalid drop id" });
  const userId = req.user!.id;

  const result = await db.transaction(async (tx) => {
    // FOR UPDATE serializes concurrent approve/reject on the same drop
    const [drop] = await tx.select().from(drops).where(eq(drops.id, dropId)).for("update");
    if (!drop) return null;
    if (drop.reviewStatus === "APPROVED") return drop; // idempotent

    const [session] = await tx.select().from(dropSessions)
      .where(eq(dropSessions.id, drop.sessionId)).for("update");
    if (!session) return null;

    const rates = await loadRates(tx, session);
    const plan = planApprove(drop, session, rates);
    if (plan) await applyPlan(tx, session, plan);

    const [updated] = await tx.update(drops).set({
      reviewStatus: "APPROVED",
      reviewedByUserId: userId,
      reviewedAt: new Date(),
      ...(plan ? plan.dropUpdate : {}),
    }).where(eq(drops.id, drop.id)).returning();
    return updated;
  });

  if (!result) return res.status(404).json({ error: "Drop not found" });
  res.json({ ok: true, drop: dropRow(result) });
});

router.post("/api/staff/review/drops/:dropId/reject", authMiddleware, requireRole("STAFF"), async (req, res) => {
  const dropId = Number(req.params.dropId);
  if (!Number.isInteger(dropId) || dropId < 1) return res.status(400).json({ error: "Invalid drop id" });
  const body = z.object({ reason: z.string().trim().min(1).max(1000) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "reason required" });
  const userId = req.user!.id;

  // Spec §6: everything in ONE transaction
  const result = await db.transaction(async (tx) => {
    const [drop] = await tx.select().from(drops).where(eq(drops.id, dropId)).for("update");
    if (!drop) return null;
    if (drop.reviewStatus === "REJECTED") return drop; // idempotent no-op

    const [session] = await tx.select().from(dropSessions)
      .where(eq(dropSessions.id, drop.sessionId)).for("update");
    if (!session) return null;

    const rates = await loadRates(tx, session);
    const plan = planReject(drop, session, rates, body.data.reason);
    if (plan) await applyPlan(tx, session, plan);

    const [updated] = await tx.update(drops).set({
      reviewStatus: "REJECTED",
      reviewedByUserId: userId,
      reviewedAt: new Date(),
      reviewNote: body.data.reason,
      ...(plan ? plan.dropUpdate : {}),
    }).where(eq(drops.id, drop.id)).returning();
    return updated;
  });

  if (!result) return res.status(404).json({ error: "Drop not found" });
  res.json({ ok: true, drop: dropRow(result) });
});

// ==================== Staff sessions listing ====================

const sessionsQuery = z.object({
  status: z.preprocess(emptyToUndefined,
    z.enum(["OPEN", "FINALIZED", "CLAIMED", "EXPIRED", "all"]).optional()),
  claimed: z.preprocess(emptyToUndefined, z.enum(["true", "false"]).optional()),
  shopId: optionalInt(),
  from: optionalDate,
  to: optionalDate,
  limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(200).default(50)),
  offset: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).default(0)),
});

router.get("/api/staff/sessions", authMiddleware, requireRole("STAFF"), async (req, res) => {
  const q = sessionsQuery.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: "Invalid query" });
  const conds: SQL[] = [];
  if (q.data.status && q.data.status !== "all") conds.push(eq(dropSessions.status, q.data.status));
  if (q.data.claimed === "true") conds.push(isNotNull(dropSessions.claimedByCustomerId));
  if (q.data.claimed === "false") conds.push(isNull(dropSessions.claimedByCustomerId));
  if (q.data.shopId !== undefined) conds.push(eq(dropSessions.shopId, q.data.shopId));
  if (q.data.from) conds.push(gte(dropSessions.createdAt, q.data.from));
  if (q.data.to) conds.push(lte(dropSessions.createdAt, q.data.to));

  const rows = await db.select({
    session: dropSessions,
    device: { id: devices.id, serial: devices.serial },
    shop: { id: shops.id, name: shops.name, city: shops.city },
  })
    .from(dropSessions)
    .innerJoin(devices, eq(devices.id, dropSessions.deviceId))
    .leftJoin(shops, eq(shops.id, dropSessions.shopId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(dropSessions.createdAt), desc(dropSessions.id))
    .limit(q.data.limit)
    .offset(q.data.offset);

  res.json(rows.map(r => ({
    ...sessionRow(r.session),
    device: r.device,
    shop: r.shop,
  })));
});

// ==================== Training-data export (JSONL) ====================

const exportQuery = z.object({
  from: optionalDate,
  to: optionalDate,
  status: z.preprocess(emptyToUndefined,
    z.enum(["UNREVIEWED", "APPROVED", "REJECTED", "all"]).optional()),
});

const EXPORT_BATCH = 500;

router.get("/api/staff/export/training", authMiddleware, requireRole("STAFF"), async (req, res) => {
  const q = exportQuery.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: "Invalid query" });
  const conds: SQL[] = [];
  if (q.data.status && q.data.status !== "all") conds.push(eq(drops.reviewStatus, q.data.status));
  if (q.data.from) conds.push(gte(drops.createdAt, q.data.from));
  if (q.data.to) conds.push(lte(drops.createdAt, q.data.to));

  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Content-Disposition", 'attachment; filename="littr-training.jsonl"');

  // Batched keyset-free paging keeps memory flat on large corpora; stable order
  // by drop id so pages never skip or repeat rows.
  for (let offset = 0; ; offset += EXPORT_BATCH) {
    const rows = await db.select({
      drop: drops,
      session: dropSessions,
      beforeUrl: beforePhotos.storageUrl,
      afterUrl: afterPhotos.storageUrl,
      selfReport: selfReports,
    })
      .from(drops)
      .innerJoin(dropSessions, eq(dropSessions.id, drops.sessionId))
      .leftJoin(beforePhotos, eq(beforePhotos.id, drops.beforePhotoId))
      .leftJoin(afterPhotos, eq(afterPhotos.id, drops.afterPhotoId))
      .leftJoin(selfReports, eq(selfReports.sessionId, dropSessions.id))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(drops.id)
      .limit(EXPORT_BATCH)
      .offset(offset);

    for (const r of rows) {
      const line = {
        dropId: r.drop.id,
        deviceId: r.session.deviceId,
        shopId: r.session.shopId,
        sessionId: r.drop.sessionId,
        beforeUrl: r.beforeUrl,
        afterUrl: r.afterUrl,
        reviewStatus: r.drop.reviewStatus,
        reviewNote: r.drop.reviewNote,
        accepted: r.drop.accepted,
        beamPatternJson: r.drop.beamPatternJson,
        takenAt: r.drop.createdAt,
        ...(r.selfReport ? { selfReport: selfReportRow(r.selfReport) } : {}),
      };
      res.write(JSON.stringify(line) + "\n");
    }
    if (rows.length < EXPORT_BATCH) break;
  }
  res.end();
});

export default router;
