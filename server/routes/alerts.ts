// Alerts & notification prefs routes — staff (spec §3.3) + partner (spec §4.1).

import { Router } from "express";
import type { Request } from "express";
import { z } from "zod";
import { alerts, notificationPrefs, type Alert, type NotificationPrefs } from "@shared/schema";
import { db } from "../db";
import { and, desc, eq, isNull, isNotNull, type SQL } from "drizzle-orm";
import { authMiddleware, requireRole } from "../auth";
import { storage } from "../storage";
import {
  notificationPrefsPutSchema,
  mergeChannelPrefs,
  mergeEventPrefs,
  mergePhoneEntries,
  applyChannelPrefsPatch,
  applyEventPrefsPatch,
  type NotificationPrefsPut,
} from "../notifyRules";

const router = Router();

const alertsQuerySchema = z.object({
  deviceId: z.coerce.number().int().positive().optional(),
  active: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

async function listAlerts(conds: SQL[], q: z.infer<typeof alertsQuerySchema>) {
  if (q.deviceId !== undefined) conds.push(eq(alerts.deviceId, q.deviceId));
  if (q.active === "true") conds.push(isNull(alerts.resolvedAt));
  if (q.active === "false") conds.push(isNotNull(alerts.resolvedAt));
  return db
    .select()
    .from(alerts)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(alerts.createdAt))
    .limit(q.limit ?? 50);
}

// Partner trust boundary (spec §4.1): notifiedJson holds per-recipient delivery
// receipts — the email addresses and channels of every STAFF user and every other
// shop member — so it MUST NOT cross to a shop's own (possibly VIEWER) partners.
// Raw dataJson is dropped too (defensive: it can echo device-supplied fields);
// the human-readable `message` column already conveys the alert. Staff routes keep
// the full row.
function toPartnerAlert(alert: Alert) {
  const { notifiedJson, dataJson, ...safe } = alert;
  return safe;
}

// ---- Prefs helpers (one row per user per scope; shopId null = global) ----

async function getPrefsRow(userId: string, shopId: number | null): Promise<NotificationPrefs | undefined> {
  const scope = shopId === null ? isNull(notificationPrefs.shopId) : eq(notificationPrefs.shopId, shopId);
  const [row] = await db.select().from(notificationPrefs).where(and(eq(notificationPrefs.userId, userId), scope));
  return row;
}

// GET always returns the effective (defaults-merged) prefs so clients see the
// full §5.3 shape even before a row exists.
function effectivePrefs(shopId: number | null, row: NotificationPrefs | undefined) {
  return {
    shopId,
    channelsJson: mergeChannelPrefs(row?.channelsJson),
    eventsJson: mergeEventPrefs(row?.eventsJson),
    phone: row?.phone ?? null,
    phonesJson: mergePhoneEntries(row?.phonesJson),
    updatedAt: row?.updatedAt ?? null,
  };
}

async function upsertPrefs(userId: string, shopId: number | null, patch: NotificationPrefsPut) {
  const existing = await getPrefsRow(userId, shopId);
  const channelsJson = applyChannelPrefsPatch(mergeChannelPrefs(existing?.channelsJson), patch.channelsJson);
  const eventsJson = applyEventPrefsPatch(mergeEventPrefs(existing?.eventsJson), patch.eventsJson);
  const phone = patch.phone !== undefined ? patch.phone : existing?.phone ?? null;
  // phonesJson replaces wholesale when provided (like fillLevels)
  const phonesJson = patch.phonesJson !== undefined ? patch.phonesJson : mergePhoneEntries(existing?.phonesJson);
  if (existing) {
    const [row] = await db
      .update(notificationPrefs)
      .set({ channelsJson, eventsJson, phone, phonesJson, updatedAt: new Date() })
      .where(eq(notificationPrefs.id, existing.id))
      .returning();
    return row;
  }
  const [row] = await db
    .insert(notificationPrefs)
    .values({ userId, shopId, channelsJson, eventsJson, phone, phonesJson })
    .returning();
  return row;
}

// ==================== STAFF (spec §3.3) ====================

router.get("/api/staff/alerts", authMiddleware, requireRole("STAFF"), async (req, res) => {
  const q = alertsQuerySchema.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: "Invalid query" });
  res.json(await listAlerts([], q.data));
});

router.post("/api/staff/alerts/:id/resolve", authMiddleware, requireRole("STAFF"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid alert id" });
  const [existing] = await db.select().from(alerts).where(eq(alerts.id, id));
  if (!existing) return res.status(404).json({ error: "Alert not found" });
  if (existing.resolvedAt) return res.json(existing); // idempotent
  const [updated] = await db.update(alerts).set({ resolvedAt: new Date() }).where(eq(alerts.id, id)).returning();
  res.json(updated);
});

router.get("/api/staff/notifications", authMiddleware, requireRole("STAFF"), async (req, res) => {
  const row = await getPrefsRow(req.user!.id, null);
  res.json(effectivePrefs(null, row));
});

router.put("/api/staff/notifications", authMiddleware, requireRole("STAFF"), async (req, res) => {
  const body = notificationPrefsPutSchema.safeParse(req.body);
  if (!body.success) {
    const issue = body.error.issues[0];
    const path = issue.path.join(".");
    return res.status(400).json({ error: path ? `${path}: ${issue.message}` : issue.message });
  }
  const row = await upsertPrefs(req.user!.id, null, body.data);
  res.json(effectivePrefs(null, row));
});

// ==================== PARTNER (spec §4.1; STAFF bypasses membership) ====================

async function shopAccessError(req: Request, shopId: number): Promise<{ status: number; error: string } | null> {
  if (!Number.isInteger(shopId) || shopId <= 0) return { status: 400, error: "Invalid shop id" };
  if (!(await storage.getShop(shopId))) return { status: 404, error: "Shop not found" };
  if (req.user!.role !== "STAFF" && !(await storage.isShopMember(req.user!.id, shopId)))
    return { status: 403, error: "Not your shop" };
  return null;
}

router.get("/api/partner/shops/:id/alerts", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
  const shopId = Number(req.params.id);
  const denied = await shopAccessError(req, shopId);
  if (denied) return res.status(denied.status).json({ error: denied.error });
  const q = alertsQuerySchema.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: "Invalid query" });
  const rows = await listAlerts([eq(alerts.shopId, shopId)], q.data);
  res.json(rows.map(toPartnerAlert));
});

router.get("/api/partner/shops/:id/notifications", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
  const shopId = Number(req.params.id);
  const denied = await shopAccessError(req, shopId);
  if (denied) return res.status(denied.status).json({ error: denied.error });
  const row = await getPrefsRow(req.user!.id, shopId);
  res.json(effectivePrefs(shopId, row));
});

router.put("/api/partner/shops/:id/notifications", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
  const shopId = Number(req.params.id);
  const denied = await shopAccessError(req, shopId);
  if (denied) return res.status(denied.status).json({ error: denied.error });
  const body = notificationPrefsPutSchema.safeParse(req.body);
  if (!body.success) {
    const issue = body.error.issues[0];
    const path = issue.path.join(".");
    return res.status(400).json({ error: path ? `${path}: ${issue.message}` : issue.message });
  }
  const row = await upsertPrefs(req.user!.id, shopId, body.data);
  res.json(effectivePrefs(shopId, row));
});

export default router;
