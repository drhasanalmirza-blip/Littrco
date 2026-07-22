import { Router } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { authMiddleware, requireRole } from "../auth";
import { storage } from "../storage";
import { db } from "../db";
import { selfReports } from "@shared/schema";

// Customer self-report (spec §4.6) — what did you actually drop?
const router = Router();

const bodySchema = z.object({
  sessionId: z.number().int().positive(),
  brand: z.string().trim().max(120).optional(),
  model: z.string().trim().max(120).optional(),
  puffCount: z.number().int().min(0).max(1_000_000).optional(),
  isThc: z.boolean().optional(),
  notes: z.string().trim().max(2000).optional(),
});

router.post("/api/customer/self-report", authMiddleware, requireRole("CUSTOMER"), async (req, res) => {
  try {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: fromZodError(parsed.error).message });

    const customer = await storage.getCustomerByUserId(req.user!.id);
    if (!customer) return res.status(404).json({ error: "Customer profile not found" });

    const session = await storage.getDropSession(parsed.data.sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.status !== "CLAIMED" || session.claimedByCustomerId !== customer.id)
      return res.status(403).json({ error: "Session not claimed by you" });

    // Omitted fields overwrite with null so a re-submit fully replaces the report
    const values = {
      sessionId: session.id,
      customerId: customer.id,
      brand: parsed.data.brand ?? null,
      model: parsed.data.model ?? null,
      puffCount: parsed.data.puffCount ?? null,
      isThc: parsed.data.isThc ?? null,
      notes: parsed.data.notes ?? null,
    };
    // Upsert on the unique sessionId (spec §1.3: one self-report per session)
    const [report] = await db.insert(selfReports).values(values)
      .onConflictDoUpdate({
        target: selfReports.sessionId,
        set: {
          brand: values.brand,
          model: values.model,
          puffCount: values.puffCount,
          isThc: values.isThc,
          notes: values.notes,
        },
      })
      .returning();

    res.json({ ok: true, selfReport: report });
  } catch {
    res.status(500).json({ error: "Failed to save self-report" });
  }
});

export default router;
