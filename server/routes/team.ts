import { Router } from "express";
import type { Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { authMiddleware, requireRole } from "../auth";
import { storage } from "../storage";
import { db } from "../db";
import { partnerInvites, shopMembers, users } from "@shared/schema";
import { sendCustomEmail } from "../email";

// Partner team management (spec §4.2)
const router = Router();

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7-day expiry

export type ShopRole = "OWNER" | "MANAGER" | "VIEWER";

// The caller's membership role for a shop, or null when not a member.
// Exported so other modules can retrofit VIEWER enforcement (spec §4.2).
export async function partnerRoleForShop(userId: string, shopId: number): Promise<ShopRole | null> {
  const [m] = await db
    .select({ role: shopMembers.role })
    .from(shopMembers)
    .where(and(eq(shopMembers.userId, userId), eq(shopMembers.shopId, shopId)));
  return m?.role ?? null;
}

async function ownerCount(shopId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(shopMembers)
    .where(and(eq(shopMembers.shopId, shopId), eq(shopMembers.role, "OWNER")));
  return Number(row?.n ?? 0);
}

// Resolves the caller's effective shop role (STAFF acts as OWNER everywhere)
// and enforces `allowed`. Responds and returns null when access is denied.
async function requireShopRole(
  req: Request, res: Response, shopId: number, allowed: ShopRole[],
): Promise<ShopRole | null> {
  if (!Number.isInteger(shopId) || shopId <= 0) {
    res.status(400).json({ error: "Invalid shop id" });
    return null;
  }
  if (req.user!.role === "STAFF") return "OWNER";
  const role = await partnerRoleForShop(req.user!.id, shopId);
  if (!role) {
    res.status(403).json({ error: "Not your shop" });
    return null;
  }
  if (!allowed.includes(role)) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return role;
}

function requestBaseUrl(req: Request): string {
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host;
  return `${proto}://${host}`;
}

function inviteEmailHtml(shopName: string, role: ShopRole, acceptUrl: string): string {
  return `
    <h2 style="margin: 0 0 8px 0; color: #000; font-size: 24px; font-weight: 600;">You're invited!</h2>
    <p style="margin: 0 0 24px 0; color: #666; font-size: 16px;">
      You've been invited to join <strong style="color: #000;">${shopName}</strong> on LITTR.co
      as a <strong style="color: #000;">${role}</strong>.
    </p>
    <div style="margin: 32px 0; text-align: center;">
      <a href="${acceptUrl}" style="display: inline-block; background-color: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 14px;">Accept Invitation</a>
    </div>
    <p style="margin: 0; color: #888; font-size: 13px;">
      This invitation expires in 7 days. If you weren't expecting it, you can ignore this email.
    </p>
  `;
}

const inviteBodySchema = z.object({
  email: z.string().trim().email().max(254).transform((v) => v.toLowerCase()),
  role: z.enum(["OWNER", "MANAGER", "VIEWER"]),
});

const memberRoleSchema = z.object({ role: z.enum(["OWNER", "MANAGER", "VIEWER"]) });

// ==================== Invites (OWNER-only) ====================

router.post("/api/partner/shops/:id/invites", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
  try {
    const shopId = Number(req.params.id);
    if (!(await requireShopRole(req, res, shopId, ["OWNER"]))) return;
    const parsed = inviteBodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: fromZodError(parsed.error).message });
    const shop = await storage.getShop(shopId);
    if (!shop) return res.status(404).json({ error: "Shop not found" });

    const { email, role } = parsed.data;
    // Re-inviting the same email replaces the pending invite (spec §4.2)
    await db.delete(partnerInvites).where(and(
      eq(partnerInvites.shopId, shopId),
      eq(partnerInvites.email, email),
      isNull(partnerInvites.acceptedAt),
    ));

    const token = crypto.randomBytes(24).toString("hex");
    const [invite] = await db.insert(partnerInvites).values({
      shopId,
      email,
      role,
      token,
      invitedByUserId: req.user!.id,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    }).returning();

    const acceptUrl = `${requestBaseUrl(req)}/partner/invite/${token}`;
    sendCustomEmail(
      email,
      `You're invited to ${shop.name} — LITTR.co`,
      inviteEmailHtml(shop.name, role, acceptUrl),
    ).catch(() => {});

    res.json({ ...invite, acceptUrl });
  } catch {
    res.status(500).json({ error: "Failed to create invite" });
  }
});

router.get("/api/partner/shops/:id/invites", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
  try {
    const shopId = Number(req.params.id);
    if (!(await requireShopRole(req, res, shopId, ["OWNER"]))) return;
    const invites = await db.select().from(partnerInvites)
      .where(and(
        eq(partnerInvites.shopId, shopId),
        isNull(partnerInvites.acceptedAt),
        gt(partnerInvites.expiresAt, new Date()),
      ))
      .orderBy(desc(partnerInvites.createdAt));
    res.json(invites);
  } catch {
    res.status(500).json({ error: "Failed to list invites" });
  }
});

router.delete("/api/partner/shops/:id/invites/:inviteId", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
  try {
    const shopId = Number(req.params.id);
    if (!(await requireShopRole(req, res, shopId, ["OWNER"]))) return;
    const inviteId = Number(req.params.inviteId);
    if (!Number.isInteger(inviteId) || inviteId <= 0) return res.status(400).json({ error: "Invalid invite id" });
    const deleted = await db.delete(partnerInvites)
      .where(and(eq(partnerInvites.id, inviteId), eq(partnerInvites.shopId, shopId)))
      .returning({ id: partnerInvites.id });
    if (deleted.length === 0) return res.status(404).json({ error: "Invite not found" });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete invite" });
  }
});

// ==================== Members ====================

// Any member of the shop (including VIEWER — read-only) may list members
router.get("/api/partner/shops/:id/members", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
  try {
    const shopId = Number(req.params.id);
    if (!(await requireShopRole(req, res, shopId, ["OWNER", "MANAGER", "VIEWER"]))) return;
    const members = await db
      .select({
        userId: shopMembers.userId,
        email: users.email,
        role: shopMembers.role,
        createdAt: shopMembers.createdAt,
      })
      .from(shopMembers)
      .innerJoin(users, eq(users.id, shopMembers.userId))
      .where(eq(shopMembers.shopId, shopId))
      .orderBy(shopMembers.createdAt);
    res.json(members);
  } catch {
    res.status(500).json({ error: "Failed to list members" });
  }
});

router.patch("/api/partner/shops/:id/members/:userId", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
  try {
    const shopId = Number(req.params.id);
    if (!(await requireShopRole(req, res, shopId, ["OWNER"]))) return;
    const parsed = memberRoleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: fromZodError(parsed.error).message });
    const targetUserId = req.params.userId;
    const [member] = await db.select().from(shopMembers)
      .where(and(eq(shopMembers.shopId, shopId), eq(shopMembers.userId, targetUserId)));
    if (!member) return res.status(404).json({ error: "Member not found" });
    if (member.role === "OWNER" && parsed.data.role !== "OWNER" && (await ownerCount(shopId)) <= 1)
      return res.status(400).json({ error: "Cannot demote the last owner" });
    const [updated] = await db.update(shopMembers)
      .set({ role: parsed.data.role })
      .where(eq(shopMembers.id, member.id))
      .returning();
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Failed to update member" });
  }
});

router.delete("/api/partner/shops/:id/members/:userId", authMiddleware, requireRole("PARTNER", "STAFF"), async (req, res) => {
  try {
    const shopId = Number(req.params.id);
    if (!(await requireShopRole(req, res, shopId, ["OWNER"]))) return;
    const targetUserId = req.params.userId;
    const [member] = await db.select().from(shopMembers)
      .where(and(eq(shopMembers.shopId, shopId), eq(shopMembers.userId, targetUserId)));
    if (!member) return res.status(404).json({ error: "Member not found" });
    if (member.role === "OWNER" && (await ownerCount(shopId)) <= 1)
      return res.status(400).json({ error: "Cannot remove the last owner" });
    await db.delete(shopMembers).where(eq(shopMembers.id, member.id));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to remove member" });
  }
});

// ==================== Accept (any authenticated user) ====================

router.post("/api/invites/accept", authMiddleware, async (req, res) => {
  try {
    const parsed = z.object({ token: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "token required" });
    const user = req.user!;

    const [invite] = await db.select().from(partnerInvites)
      .where(eq(partnerInvites.token, parsed.data.token));
    if (!invite) return res.status(404).json({ error: "Invalid invite" });

    if (invite.acceptedAt) {
      // Idempotent re-accept by the same user falls through to re-apply membership
      if (invite.acceptedByUserId !== user.id) return res.status(409).json({ error: "Invite already used" });
    } else {
      if (invite.expiresAt < new Date()) return res.status(410).json({ error: "Invite expired" });
      const [consumed] = await db.update(partnerInvites)
        .set({ acceptedAt: new Date(), acceptedByUserId: user.id })
        .where(and(eq(partnerInvites.id, invite.id), isNull(partnerInvites.acceptedAt)))
        .returning();
      if (!consumed) {
        // Lost a race with a concurrent accept — only the winner proceeds
        const [current] = await db.select().from(partnerInvites).where(eq(partnerInvites.id, invite.id));
        if (current?.acceptedByUserId !== user.id) return res.status(409).json({ error: "Invite already used" });
      }
    }

    await db.insert(shopMembers)
      .values({ userId: user.id, shopId: invite.shopId, role: invite.role })
      .onConflictDoUpdate({
        target: [shopMembers.userId, shopMembers.shopId],
        set: { role: invite.role },
      });

    if (user.role === "CUSTOMER") {
      await db.update(users).set({ role: "PARTNER" }).where(eq(users.id, user.id));
    }

    res.json({ ok: true, shopId: invite.shopId, role: invite.role });
  } catch {
    res.status(500).json({ error: "Failed to accept invite" });
  }
});

export default router;
