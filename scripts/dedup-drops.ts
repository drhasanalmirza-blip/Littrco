// One-time pre-deploy remediation for audit B3 — run BEFORE the new
// unique(session_id, sequence) constraint on `drops` is pushed to a populated DB.
//
//   Order:  tsx scripts/dedup-drops.ts   (this script — must exit 0)
//           npm run db:push               (adds drops_session_sequence_uniq)
//
// The constraint prevents FUTURE firmware-retry double-inserts, but it CANNOT be
// created while historical duplicate rows exist (CREATE UNIQUE INDEX fails with a
// duplicate-key error and blocks the deploy). This script removes those rows and
// reconciles the derived state the same double-insert corrupted:
//   1. dedup drops         — keep MIN(id) per (session_id, sequence)
//   2. reconcile counters  — detected/accepted recomputed from surviving rows
//   3. reconcile awards     — batteriesEstimated / shopPointsAwarded recomputed
//                             for FINALIZED/CLAIMED sessions via finalizeDecision,
//                             using the SAME rate precedence as the finalize route
//                             (device override ?? shop cfg ?? default)
//   4. ledger consistency   — a compensating signed ADJUST shop-point row for any
//                             delta, so each shop's POSTED balance still equals the
//                             corrected column (the original EARNED row is untouched)
//   5. post-guard           — assert zero duplicate groups remain; abort otherwise
//
// Everything runs in ONE transaction: if the post-guard fails, nothing commits.
// Idempotent — a second run finds no duplicates and is a no-op.
//
// NOTE (customer batteries): batteriesEstimated is a session-level estimate. Real
// customer batteries are credited at CLAIM time (battery_transactions). This script
// does NOT claw back a claimed customer's batteries — that is a deliberate reward-
// economy action, not a mechanical fix — it only reports affected CLAIMED sessions.

import "dotenv/config";
import { db, pool } from "../server/db";
import { drops, dropSessions, devices, rewardConfigs, shopPointTransactions } from "../shared/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { reconcileSession, survivorAndDuplicates } from "../server/dedupDrops";

const DEFAULT_BATTERIES_PER_VAPE = 5;
const DEFAULT_SHOP_POINTS_PER_VAPE = 1;

async function main() {
  const summary = {
    duplicateGroups: 0,
    rowsDeleted: 0,
    sessionsReconciled: 0,
    ledgerAdjustments: 0,
    claimedNeedingBatteryReview: [] as number[],
  };

  await db.transaction(async (tx) => {
    // 1. Guard query — the exact GROUP BY ... HAVING count>1 the finding requires.
    const dupGroups = await tx
      .select({ sessionId: drops.sessionId, sequence: drops.sequence })
      .from(drops)
      .groupBy(drops.sessionId, drops.sequence)
      .having(sql`count(*) > 1`);
    summary.duplicateGroups = dupGroups.length;

    // 2. Dedup each collision group — keep MIN(id), delete the retry rows.
    for (const g of dupGroups) {
      const rows = await tx
        .select({ id: drops.id })
        .from(drops)
        .where(and(eq(drops.sessionId, g.sessionId), eq(drops.sequence, g.sequence)))
        .orderBy(drops.id);
      const { remove } = survivorAndDuplicates(rows.map((r) => r.id));
      if (remove.length > 0) {
        await tx.delete(drops).where(inArray(drops.id, remove));
        summary.rowsDeleted += remove.length;
      }
    }

    // 3. Reconcile every affected session from its surviving drops.
    const affectedSessionIds = [...new Set(dupGroups.map((g) => g.sessionId))];
    for (const sid of affectedSessionIds) {
      const [session] = await tx.select().from(dropSessions).where(eq(dropSessions.id, sid));
      if (!session) continue;

      const surviving = await tx
        .select({ accepted: drops.accepted })
        .from(drops)
        .where(eq(drops.sessionId, sid));

      // Same rate precedence as POST /finalize (server/routes.ts).
      const [device] = await tx.select().from(devices).where(eq(devices.id, session.deviceId));
      const cfg = session.shopId
        ? (await tx.select().from(rewardConfigs).where(eq(rewardConfigs.shopId, session.shopId)))[0]
        : undefined;
      const batteriesPerVape = cfg?.batteriesPerVape ?? DEFAULT_BATTERIES_PER_VAPE;
      const perVape = device?.pointsPerVapeOverride ?? cfg?.shopPointsPerVape ?? DEFAULT_SHOP_POINTS_PER_VAPE;

      const r = reconcileSession({
        status: session.status,
        offline: session.offline,
        survivingDrops: surviving,
        perVape,
        batteriesPerVape,
        previousShopPointsAwarded: session.shopPointsAwarded,
      });

      const patch: Partial<typeof dropSessions.$inferInsert> = {
        detectedDropCount: r.detectedDropCount,
        acceptedDropCount: r.acceptedDropCount,
      };
      if (r.awardsRecomputed) {
        patch.batteriesEstimated = r.batteriesEstimated;
        patch.shopPointsAwarded = r.shopPointsAwarded;
      }
      await tx.update(dropSessions).set(patch).where(eq(dropSessions.id, sid));
      summary.sessionsReconciled++;

      // 4. Keep the shop-point ledger balance consistent with the corrected column.
      if (r.awardsRecomputed && r.shopPointsDelta !== 0 && session.shopId) {
        await tx.insert(shopPointTransactions).values({
          shopId: session.shopId,
          deviceId: session.deviceId,
          sessionId: sid,
          amount: r.shopPointsDelta,
          type: "ADJUST",
          status: "POSTED",
          description: `B3 dedup reconciliation (accepted ${session.acceptedDropCount}→${r.acceptedDropCount})`,
        });
        summary.ledgerAdjustments++;
      }

      // Report — but do NOT auto-reverse — customer batteries on claimed sessions.
      if (session.status === "CLAIMED" && r.batteriesEstimated !== session.batteriesEstimated) {
        summary.claimedNeedingBatteryReview.push(sid);
      }
    }

    // 5. Post-guard: the constraint is only safe once zero duplicate groups remain.
    const remaining = await tx
      .select({ sessionId: drops.sessionId })
      .from(drops)
      .groupBy(drops.sessionId, drops.sequence)
      .having(sql`count(*) > 1`);
    if (remaining.length > 0) {
      throw new Error(
        `dedup incomplete: ${remaining.length} duplicate (session_id, sequence) group(s) remain — ` +
          `rolling back before ADD CONSTRAINT`,
      );
    }
  });

  console.log("[dedup-drops] remediation complete:");
  console.log(`  duplicate groups found : ${summary.duplicateGroups}`);
  console.log(`  drop rows deleted      : ${summary.rowsDeleted}`);
  console.log(`  sessions reconciled    : ${summary.sessionsReconciled}`);
  console.log(`  ledger ADJUST rows     : ${summary.ledgerAdjustments}`);
  if (summary.claimedNeedingBatteryReview.length > 0) {
    console.log(
      `  CLAIMED sessions whose batteriesEstimated changed (manual customer-battery ` +
        `reconciliation required): ${summary.claimedNeedingBatteryReview.join(", ")}`,
    );
  }
  console.log("  guard: 0 duplicate (session_id, sequence) groups remain -> safe to run `npm run db:push`");
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error("[dedup-drops] FAILED (nothing committed):", err);
    await pool.end();
    process.exit(1);
  });
