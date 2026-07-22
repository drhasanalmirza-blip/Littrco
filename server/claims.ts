import { eq } from "drizzle-orm";
import { batteryTransactions, dropSessions } from "@shared/schema";
import { db } from "./db";
import { storage } from "./storage";

export type ClaimResult =
  | { ok: true; batteries: number; balance: number }
  | { ok: false; status: number; error: string };

// Shared claim logic used by POST /api/customer/claim/:token and by
// POST /api/auth/register when a claimToken is supplied (spec §4.6).
//
// Runs in one transaction and re-reads the session with SELECT ... FOR UPDATE so
// it serializes on the SAME session row that the staff-reject route locks
// (server/routes/review.ts). Without that lock a reject that took the
// FINALIZED-unclaimed branch (decrementing batteriesEstimated but writing no
// customer ADJUST) could interleave with a claim that already read the pre-reject
// estimate, over-crediting the customer with no compensating revocation. Locking
// forces claim-first (reject then sees CLAIMED and writes its ADJUST) or
// reject-first (claim reads the corrected estimate).
export async function claimSessionForCustomer(customerId: number, token: string): Promise<ClaimResult> {
  const result = await db.transaction(async (tx): Promise<{ ok: true; batteries: number } | { ok: false; status: number; error: string }> => {
    const [session] = await tx
      .select()
      .from(dropSessions)
      .where(eq(dropSessions.claimToken, token))
      .for("update");
    if (!session) return { ok: false, status: 404, error: "Invalid claim token" };
    if (session.claimedByCustomerId) return { ok: false, status: 409, error: "Already claimed" };
    if (session.expiresAt && session.expiresAt < new Date()) return { ok: false, status: 410, error: "Claim expired" };

    // Amount is computed from the freshly locked estimate, so a concurrent reject
    // that corrected it is already reflected (or is blocked behind our lock).
    const batteries = session.batteriesEstimated;

    // Insert the EARNED row inside the tx; UNIQUE(session_id) is the backstop
    // against a double-claim that slips past the row lock.
    try {
      await tx.insert(batteryTransactions).values({
        customerId,
        sessionId: session.id,
        amount: batteries,
        type: "EARNED",
        status: "POSTED",
        description: `Drop session #${session.id}`,
      });
    } catch {
      return { ok: false, status: 409, error: "Already claimed" };
    }

    await tx
      .update(dropSessions)
      .set({
        claimedByCustomerId: customerId,
        claimedAt: new Date(),
        status: "CLAIMED",
        batteriesConfirmed: batteries,
      })
      .where(eq(dropSessions.id, session.id));

    return { ok: true, batteries };
  });

  if (!result.ok) return result;
  // Read the committed balance after the transaction so the EARNED row is visible.
  const { balance } = await storage.getBatteryBalance(customerId);
  return { ok: true, batteries: result.batteries, balance };
}
