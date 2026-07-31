import { Router } from "express";
import { z } from "zod";
import { and, desc, eq, gte, inArray, isNull, isNotNull, lte, type SQL } from "drizzle-orm";
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
    offline: s.offline, // §6: captured while WiFi was down — UI badges these
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
  // The reason is OPTIONAL. Most rejections are self-evident from the photos, and
  // forcing a sentence just produced "n/a" and "not a vape" — text that costs the
  // reviewer time and tells the next reader nothing. An omitted/blank reason is
  // stored as null and rendered as "no reason given", which is honest.
  const body = z.object({ reason: z.string().trim().max(1000).optional() }).safeParse(req.body ?? {});
  if (!body.success) return res.status(400).json({ error: "reason must be 1000 characters or fewer" });
  const reason = body.data.reason && body.data.reason.length > 0 ? body.data.reason : null;
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
    const plan = planReject(drop, session, rates, reason);
    if (plan) await applyPlan(tx, session, plan);

    const [updated] = await tx.update(drops).set({
      reviewStatus: "REJECTED",
      reviewedByUserId: userId,
      reviewedAt: new Date(),
      reviewNote: reason,
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

// ==================== Destructive housekeeping ====================
//
// These exist to clear TEST data. They are deliberately blunt and deliberately
// noisy about what they take with them.
//
// What a session drags along, per the schema's own FK actions:
//   drops            ON DELETE CASCADE   — gone, so its review-queue rows go too
//   selfReports      ON DELETE CASCADE   — gone
//   photos           ON DELETE SET NULL  — the rows survive, unlinked
//   batteryTransactions / shopPointTransactions  ON DELETE SET NULL
//
// That last one is the trap. Left alone, deleting a session removes the record
// of WHY a customer holds their batteries while leaving the balance intact —
// books that no longer explain themselves. So the ledger rows tied to the
// session are deleted with it, and the response reports how many, because that
// changes real balances. (Redemptions carry no sessionId, so they are untouched:
// only the earnings this session created are reversed.)
async function deleteSessions(ids: number[]) {
  if (!ids.length) return { sessions: 0, batteryTx: 0, shopPointTx: 0 };
  return db.transaction(async (tx) => {
    const bat = await tx.delete(batteryTransactions)
      .where(inArray(batteryTransactions.sessionId, ids)).returning({ id: batteryTransactions.id });
    const spt = await tx.delete(shopPointTransactions)
      .where(inArray(shopPointTransactions.sessionId, ids)).returning({ id: shopPointTransactions.id });
    const ses = await tx.delete(dropSessions)
      .where(inArray(dropSessions.id, ids)).returning({ id: dropSessions.id });
    return { sessions: ses.length, batteryTx: bat.length, shopPointTx: spt.length };
  });
}

router.delete("/api/staff/sessions/:id", authMiddleware, requireRole("STAFF"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Invalid session id" });
  const result = await deleteSessions([id]);
  if (!result.sessions) return res.status(404).json({ error: "Session not found" });
  res.json({ ok: true, ...result });
});

// Bulk delete. Takes the SAME filters as GET /api/staff/sessions so "delete
// everything I am looking at" means exactly that, and requires the caller to
// type the confirmation phrase — an accidental unfiltered call here would wipe
// the fleet's entire history.
const sessionsDeleteQuery = sessionsQuery.extend({
  confirm: z.string(),
});

router.delete("/api/staff/sessions", authMiddleware, requireRole("STAFF"), async (req, res) => {
  const q = sessionsDeleteQuery.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: "Invalid query" });
  if (q.data.confirm !== "DELETE") {
    return res.status(400).json({ error: "Confirmation phrase required" });
  }
  const conds: SQL[] = [];
  if (q.data.status && q.data.status !== "all") conds.push(eq(dropSessions.status, q.data.status));
  if (q.data.claimed === "true") conds.push(isNotNull(dropSessions.claimedByCustomerId));
  if (q.data.claimed === "false") conds.push(isNull(dropSessions.claimedByCustomerId));
  if (q.data.shopId !== undefined) conds.push(eq(dropSessions.shopId, q.data.shopId));
  if (q.data.from) conds.push(gte(dropSessions.createdAt, q.data.from));
  if (q.data.to) conds.push(lte(dropSessions.createdAt, q.data.to));

  // Collect ids first: the delete has to hit three tables and the ledger ones
  // have no join to filter on.
  const target = await db.select({ id: dropSessions.id }).from(dropSessions)
    .where(conds.length ? and(...conds) : undefined);
  const result = await deleteSessions(target.map(r => r.id));
  res.json({ ok: true, ...result });
});

// Delete a single drop out of the review queue.
//
// Its session stays, so the session's counters have to be corrected by hand —
// an accepted drop that no longer exists would otherwise keep inflating
// acceptedDropCount, which is what batteries are computed from. The ledger is
// NOT adjusted here: use Reject for that, which runs the proper revocation plan.
// Deleting is for rows that should never have been recorded at all.
router.delete("/api/staff/review/drops/:dropId", authMiddleware, requireRole("STAFF"), async (req, res) => {
  const dropId = Number(req.params.dropId);
  if (!Number.isInteger(dropId) || dropId < 1) return res.status(400).json({ error: "Invalid drop id" });
  const out = await db.transaction(async (tx) => {
    const [drop] = await tx.select().from(drops).where(eq(drops.id, dropId));
    if (!drop) return null;
    const [session] = await tx.select().from(dropSessions).where(eq(dropSessions.id, drop.sessionId));
    await tx.delete(drops).where(eq(drops.id, dropId));
    if (session) {
      await tx.update(dropSessions).set({
        detectedDropCount: Math.max(0, (session.detectedDropCount ?? 0) - 1),
        acceptedDropCount: drop.accepted
          ? Math.max(0, (session.acceptedDropCount ?? 0) - 1)
          : (session.acceptedDropCount ?? 0),
      }).where(eq(dropSessions.id, session.id));
    }
    return { sessionId: drop.sessionId };
  });
  if (!out) return res.status(404).json({ error: "Drop not found" });
  res.json({ ok: true, ...out });
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
        offline: r.session.offline, // §6: label/exclude offline drops in the corpus
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
