import { Router, type Request } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { contentFiles } from "@shared/schema";
import { db } from "../db";
import { storage } from "../storage";
import { authMiddleware, requireRole, deviceAuthMiddleware } from "../auth";
import { deviceLimiter } from "../ratelimit";
import { qrMatrix } from "../qr";

// Content management (PHASE3_SERVER.md §3.2, §3.3, §4.1). Staff CRUD over
// content_files plus the device-facing content manifest and QR fallback.
const router = Router();

// Query params arrive as strings; "" (bare `&version=`) means "not supplied".
const emptyToUndefined = (v: unknown) => (v === "" || v === undefined ? undefined : v);

// BASE_URL wins (canonical public origin); otherwise reconstruct from the
// (proxy-aware) request headers, matching the finalize route's claimUrl logic.
function resolveBaseUrl(req: Request): string {
  const env = process.env.BASE_URL;
  if (env) return env.replace(/\/+$/, "");
  const proto = req.headers["x-forwarded-proto"] ? String(req.headers["x-forwarded-proto"]) : "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

// ==================== §4.1 Staff content CRUD (requireRole STAFF) ====================

const staffContentQuery = z.object({
  board: z.preprocess(emptyToUndefined, z.enum(["hmi", "sensor"]).optional()),
  theme: z.preprocess(emptyToUndefined, z.string().max(64).optional()),
});

router.get("/api/staff/content", authMiddleware, requireRole("STAFF"), async (req, res) => {
  const q = staffContentQuery.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: "Invalid query" });
  const conds = [];
  if (q.data.board) conds.push(eq(contentFiles.board, q.data.board));
  if (q.data.theme) conds.push(eq(contentFiles.theme, q.data.theme));
  const rows = await db.select().from(contentFiles)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(contentFiles.createdAt), desc(contentFiles.id));
  res.json(rows);
});

const contentCreateBody = z.object({
  board: z.enum(["hmi", "sensor"]),
  theme: z.string().min(1).max(64).default("default"),
  path: z.string().min(1).max(256),
  url: z.string().url(),
  sha256: z.string().regex(/^[0-9a-fA-F]{64}$/, "expected 64 hex chars"),
  sizeBytes: z.number().int().min(0).optional(),
  notes: z.string().max(2000).optional(),
});

router.post("/api/staff/content", authMiddleware, requireRole("STAFF"), async (req, res) => {
  const body = contentCreateBody.safeParse(req.body);
  if (!body.success) {
    const issue = body.error.issues[0];
    return res.status(400).json({ error: `${issue.path.join(".")}: ${issue.message}` });
  }
  const { board, theme, path, url, sha256, sizeBytes, notes } = body.data;

  const created = await db.transaction(async (tx) => {
    // The (board, theme) content version is the max active version (§3.2). Bump
    // past the whole group's high-water mark so every upload STRICTLY increases
    // it — this guarantees devices detect the change and re-sync even when the
    // touched path was not previously the highest-versioned one. The new row
    // carries the new max, so max-active == this version. Then retire this path's
    // prior active rows; other paths keep their (older) versions + SHAs so the
    // device delta-syncs only the changed file.
    const existing = await tx.select({ version: contentFiles.version }).from(contentFiles)
      .where(and(eq(contentFiles.board, board), eq(contentFiles.theme, theme)));
    const nextVersion = existing.reduce((m, r) => Math.max(m, r.version), 0) + 1;

    await tx.update(contentFiles)
      .set({ active: false })
      .where(and(
        eq(contentFiles.board, board),
        eq(contentFiles.theme, theme),
        eq(contentFiles.path, path),
        eq(contentFiles.active, true),
      ));

    const [row] = await tx.insert(contentFiles).values({
      board, theme, path, url, sha256,
      sizeBytes: sizeBytes ?? null,
      notes: notes ?? null,
      version: nextVersion,
      active: true,
    }).returning();
    return row;
  });

  res.json(created);
});

router.patch("/api/staff/content/:id", authMiddleware, requireRole("STAFF"), async (req, res) => {
  const body = z.object({
    active: z.boolean().optional(),
    notes: z.string().max(2000).nullable().optional(),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "active and/or notes expected" });
  if (body.data.active === undefined && body.data.notes === undefined)
    return res.status(400).json({ error: "Nothing to update" });

  const id = Number(req.params.id);
  const row = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(contentFiles).where(eq(contentFiles.id, id));
    if (!existing) return null;

    const [updated] = await tx.update(contentFiles).set(body.data)
      .where(eq(contentFiles.id, id))
      .returning();

    // Deactivating a file can LOWER the (board, theme) max-active version, since
    // the manifest's server version is max(version) over ACTIVE rows only (§3.2).
    // GET /api/device/content assumes that version is monotonic (its 304 check is
    // `deviceVersion >= serverVersion`), so a drop would strand every device that
    // already synced past the new, lower max at stale content forever. Restore
    // monotonicity: bump every surviving active row in the group past the group's
    // all-rows high-water mark, mirroring the POST create bump, so max-active
    // strictly increases and each synced device re-syncs (or, if no active rows
    // remain, the manifest returns 204 so the device clears the retired pack).
    if (body.data.active === false && existing.active) {
      const group = await tx.select({ version: contentFiles.version }).from(contentFiles)
        .where(and(eq(contentFiles.board, existing.board), eq(contentFiles.theme, existing.theme)));
      const nextVersion = group.reduce((m, r) => Math.max(m, r.version), 0) + 1;
      await tx.update(contentFiles)
        .set({ version: nextVersion })
        .where(and(
          eq(contentFiles.board, existing.board),
          eq(contentFiles.theme, existing.theme),
          eq(contentFiles.active, true),
        ));
    }
    return updated;
  });

  if (!row) return res.status(404).json({ error: "Content file not found" });
  res.json(row);
});

// §4.1: enqueue a content-pack refresh for the HMI board. theme/version are
// both optional — an empty body tells the device to pull the newest active pack.
// Content-pack versions start at 1 (see the create handler's nextVersion), so a
// targeted version is >= 1.
router.post("/api/staff/devices/:id/update-assets", authMiddleware, requireRole("STAFF"), async (req, res) => {
  const body = z.object({
    theme: z.string().min(1).max(64).optional(),
    version: z.number().int().min(1).optional(),
  }).safeParse(req.body ?? {});
  if (!body.success) return res.status(400).json({ error: "theme (string) and/or version (int) optional" });
  const device = await storage.getDevice(Number(req.params.id));
  if (!device) return res.status(404).json({ error: "Device not found" });
  const payload: Record<string, unknown> = {};
  if (body.data.theme !== undefined) payload.theme = body.data.theme;
  if (body.data.version !== undefined) payload.version = body.data.version;
  const cmd = await storage.enqueueCommand(
    device.id, "UPDATE_ASSETS", Object.keys(payload).length ? payload : undefined,
  );
  res.json({ ok: true, commandId: cmd.id });
});

// ==================== §3.2 Device content manifest (X-Device-Key) ====================

const contentQuery = z.object({
  board: z.enum(["hmi", "sensor"]),
  theme: z.preprocess(emptyToUndefined, z.string().max(64).default("default")),
  version: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
});

router.get("/api/device/content", deviceAuthMiddleware, deviceLimiter, async (req, res) => {
  const q = contentQuery.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: "board (hmi|sensor) required" });
  const { board, theme, version } = q.data;

  const rows = await db.select().from(contentFiles).where(and(
    eq(contentFiles.board, board),
    eq(contentFiles.theme, theme),
    eq(contentFiles.active, true),
  ));
  if (rows.length === 0) return res.status(204).end();

  const serverVersion = rows.reduce((m, r) => Math.max(m, r.version), 0);
  // Device already has the current pack (or newer) → nothing to do.
  if (version !== undefined && version >= serverVersion) return res.status(304).end();

  res.json({
    version: serverVersion,
    files: rows.map((r) => ({ path: r.path, url: r.url, sha256: r.sha256, sizeBytes: r.sizeBytes })),
  });
});

// ==================== §3.3 QR fallback (X-Device-Key) ====================

const qrQuery = z.object({ token: z.string().trim().min(1) });

router.get("/api/device/qr", deviceAuthMiddleware, deviceLimiter, async (req, res) => {
  const q = qrQuery.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: "token required" });
  const session = await storage.getDropSessionByClaimToken(q.data.token);
  // Unknown OR foreign tokens both 404 — never leak that a token exists on
  // another device (§3.3).
  if (!session || session.deviceId !== req.device!.id)
    return res.status(404).json({ error: "Token not found" });

  const url = `${resolveBaseUrl(req)}/claim/${q.data.token}`;
  const { size, modules } = qrMatrix(url);
  res.json({ url, size, modules });
});

export default router;
