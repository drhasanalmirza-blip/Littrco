// Pure remediation logic for the B3 dedup that must precede the new
// `unique(session_id, sequence)` constraint on `drops` (shared/schema.ts).
//
// NO db/schema imports — this module stays importable from unit tests
// (server/db.ts throws without DATABASE_URL). The DB-touching remediation lives
// in scripts/dedup-drops.ts; everything here is deterministic data-in/data-out.
//
// Why this exists: the very bug the constraint fixes (a lost-200 firmware retry
// double-inserting an identical drop) is what produces duplicate
// (session_id, sequence) rows. On any DB that already saw the double-award,
// `CREATE UNIQUE INDEX` fails with a duplicate-key error and blocks the deploy,
// AND the same double-insert over-incremented the session counters
// (detected/accepted) and the finalize-derived awards
// (batteriesEstimated / shopPointsAwarded). This module computes the corrected
// values so the remediation can dedup rows and reconcile the derived state
// BEFORE the constraint is added.

import { finalizeDecision, type SessionStatus } from "./offlineFinalize";

/** One (session_id, sequence) collision group, as returned by the guard query. */
export interface DuplicateGroup {
  sessionId: number;
  sequence: number;
  count: number;
}

/** True when any (session_id, sequence) group still has more than one row. */
export function hasDuplicates(groups: DuplicateGroup[]): boolean {
  return groups.some((g) => g.count > 1);
}

/**
 * Pick the survivor and the rows to delete for a single (session_id, sequence)
 * collision group. We keep the earliest row (MIN id) — it is the drop the
 * firmware's first (winning) insert created; later ids are the retry duplicates.
 */
export function survivorAndDuplicates(ids: number[]): { keep: number; remove: number[] } {
  if (ids.length === 0) throw new Error("survivorAndDuplicates: empty group");
  const keep = ids.reduce((min, id) => (id < min ? id : min), ids[0]);
  return { keep, remove: ids.filter((id) => id !== keep) };
}

export interface ReconcileInput {
  /** Session's committed status; only FINALIZED/CLAIMED have computed awards. */
  status: SessionStatus;
  /** Offline sessions award shop points but zero batteries (spec §3.4). */
  offline: boolean;
  /** The drops that SURVIVE the dedup (one per sequence), accepted flag only. */
  survivingDrops: { accepted: boolean }[];
  /** Shop points per accepted vape (device override ?? shop rate ?? default). */
  perVape: number;
  /** Customer batteries per accepted vape (shop rate ?? default). */
  batteriesPerVape: number;
  /** The (possibly inflated) shop_points_awarded currently on the session row. */
  previousShopPointsAwarded: number;
}

export interface ReconcileResult {
  detectedDropCount: number;
  acceptedDropCount: number;
  /**
   * True only for FINALIZED/CLAIMED sessions — the finalize-derived award
   * columns were populated and must be recomputed. OPEN/EXPIRED sessions never
   * ran the awarding path, so their award columns stay at their defaults.
   */
  awardsRecomputed: boolean;
  /** Corrected batteries_estimated (0 for offline). Meaningful only when awardsRecomputed. */
  batteriesEstimated: number;
  /** Corrected shop_points_awarded. Meaningful only when awardsRecomputed. */
  shopPointsAwarded: number;
  /**
   * shopPointsAwarded_corrected − previous. A signed ADJUST ledger row for this
   * delta keeps the shop's POSTED balance equal to the corrected column while
   * leaving the original EARNED row intact (getShopPointBalance sums ADJUST).
   * <= 0 in practice (dedup only ever removes over-counted drops).
   */
  shopPointsDelta: number;
}

/**
 * Recompute a session's counters and (for already-finalized sessions) its
 * finalize-derived awards from the surviving drops, reusing the exact
 * finalizeDecision formula so the reconciliation matches what a correct finalize
 * would have produced. Deterministic / DB-free.
 */
export function reconcileSession(input: ReconcileInput): ReconcileResult {
  const detectedDropCount = input.survivingDrops.length;
  const acceptedDropCount = input.survivingDrops.filter((d) => d.accepted).length;

  const awardsRecomputed = input.status === "FINALIZED" || input.status === "CLAIMED";
  if (!awardsRecomputed) {
    return {
      detectedDropCount,
      acceptedDropCount,
      awardsRecomputed: false,
      batteriesEstimated: 0,
      shopPointsAwarded: input.previousShopPointsAwarded,
      shopPointsDelta: 0,
    };
  }

  const decision = finalizeDecision({
    offline: input.offline,
    acceptedDropCount,
    perVape: input.perVape,
    batteriesPerVape: input.batteriesPerVape,
  });

  return {
    detectedDropCount,
    acceptedDropCount,
    awardsRecomputed: true,
    batteriesEstimated: decision.batteries,
    shopPointsAwarded: decision.shopPoints,
    shopPointsDelta: decision.shopPoints - input.previousShopPointsAwarded,
  };
}
