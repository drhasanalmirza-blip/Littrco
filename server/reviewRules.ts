// Pure revocation math for staff drop review (spec §6).
// No db/schema imports — plain typed inputs — so vitest covers it without DATABASE_URL.
// The route (server/routes/review.ts) applies the returned plan inside one transaction.

export type SessionStatus = "OPEN" | "FINALIZED" | "CLAIMED" | "EXPIRED";
export type DropReviewStatus = "UNREVIEWED" | "APPROVED" | "REJECTED";

export interface ReviewDropState {
  id: number;
  accepted: boolean;
  reviewStatus: DropReviewStatus;
  pointsRevoked: boolean;
}

export interface ReviewSessionState {
  id: number;
  status: SessionStatus;
  shopId: number | null;
  deviceId: number;
  acceptedDropCount: number;
  batteriesEstimated: number;
  claimedByCustomerId: number | null;
  /**
   * Session was captured while WiFi was down (spec §3.4). Offline finalize awards
   * shop points but 0 batteries and mints no claim, so it holds the invariant
   * batteriesEstimated=0 while acceptedDropCount>0. Reject/approve must NOT
   * touch batteriesEstimated for offline sessions or they'd materialize phantom
   * estimated batteries the session never had.
   */
  offline: boolean;
}

export interface ReviewRates {
  batteriesPerVape: number;
  shopPointsPerVape: number;
  /** devices.pointsPerVapeOverride — beats shopPointsPerVape when set (spec §1.2) */
  pointsPerVapeOverride: number | null;
}

export interface ShopPointAdjustment {
  shopId: number;
  deviceId: number;
  sessionId: number;
  amount: number; // negative on reject, positive on restore
  type: "ADJUST";
  status: "POSTED";
  description: string;
}

export interface BatteryAdjustment {
  customerId: number;
  /**
   * Always null: battery_transactions has UNIQUE(session_id), held by the
   * claim's EARNED row — the session is referenced in the description instead.
   */
  sessionId: null;
  amount: number; // negative on reject, positive on restore
  type: "ADJUST";
  status: "POSTED";
  description: string;
}

export interface RevocationPlan {
  dropUpdate: { accepted: boolean; pointsRevoked: boolean };
  sessionUpdate: { acceptedDropCount?: number; batteriesEstimated?: number };
  shopPointEntry: ShopPointAdjustment | null;
  batteryEntry: BatteryAdjustment | null;
}

export function effectiveShopPointsPerVape(rates: ReviewRates): number {
  return rates.pointsPerVapeOverride ?? rates.shopPointsPerVape;
}

function emptyPlan(dropUpdate: RevocationPlan["dropUpdate"]): RevocationPlan {
  return { dropUpdate, sessionUpdate: {}, shopPointEntry: null, batteryEntry: null };
}

/**
 * Compute the state/ledger changes for rejecting a drop (spec §6 steps 3-6).
 * Returns null when the drop is already REJECTED (idempotent no-op).
 *
 * Caveat (spec §6.4): the per-vape rate finalize actually used is not stored,
 * so compensation is recomputed from the CURRENT config + override. If either
 * changed since finalize, the reversal may differ from the original grant.
 */
export function planReject(
  drop: ReviewDropState,
  session: ReviewSessionState,
  rates: ReviewRates,
  reason: string,
): RevocationPlan | null {
  if (drop.reviewStatus === "REJECTED") return null;

  // A never-accepted drop contributed nothing at finalize: rejecting it is pure
  // bookkeeping. The pointsRevoked latch stays false so approve restores nothing.
  if (!drop.accepted) return emptyPlan({ accepted: false, pointsRevoked: false });

  const plan: RevocationPlan = {
    dropUpdate: { accepted: false, pointsRevoked: true },
    sessionUpdate: { acceptedDropCount: Math.max(0, session.acceptedDropCount - 1) },
    shopPointEntry: null,
    batteryEntry: null,
  };

  // OPEN session: nothing was granted yet — the count decrement alone is
  // enough, finalize will compute from the corrected count (spec §6.5).
  if (session.status === "OPEN") return plan;

  if (session.shopId !== null) {
    plan.shopPointEntry = {
      shopId: session.shopId,
      deviceId: session.deviceId,
      sessionId: session.id,
      amount: -effectiveShopPointsPerVape(rates),
      type: "ADJUST",
      status: "POSTED",
      description: `Drop #${drop.id} rejected: ${reason}`,
    };
  }

  if (session.status === "CLAIMED" && session.claimedByCustomerId !== null) {
    // Already paid out — compensate the ledger. Balance may go negative (by design).
    plan.batteryEntry = {
      customerId: session.claimedByCustomerId,
      sessionId: null,
      amount: -rates.batteriesPerVape,
      type: "ADJUST",
      status: "POSTED",
      description: `Drop #${drop.id} rejected (session #${session.id}): ${reason}`,
    };
  } else if (!session.offline) {
    // FINALIZED-but-unclaimed (or EXPIRED): fix the estimate so a later claim
    // pays the corrected amount. Floor 0. Offline sessions are excluded: they
    // finalized with batteriesEstimated=0 (no batteries, no claim) and must stay
    // there — the shop-point ADJUST above is their only correction (spec §3.4).
    plan.sessionUpdate.batteriesEstimated =
      Math.max(0, session.batteriesEstimated - rates.batteriesPerVape);
  }

  return plan;
}

/**
 * Compute the state/ledger changes for approving a drop. Plain approve is a
 * review stamp only; approve-after-reject writes the symmetric reverse entries
 * and clears the pointsRevoked latch so the ledger never drifts (spec §6).
 * Returns null when the drop is already APPROVED (idempotent no-op).
 */
export function planApprove(
  drop: ReviewDropState,
  session: ReviewSessionState,
  rates: ReviewRates,
): RevocationPlan | null {
  if (drop.reviewStatus === "APPROVED") return null;

  // UNREVIEWED → APPROVED: no value moved, nothing to restore.
  if (drop.reviewStatus === "UNREVIEWED") {
    return emptyPlan({ accepted: drop.accepted, pointsRevoked: drop.pointsRevoked });
  }

  // REJECTED → APPROVED. pointsRevoked records whether the reject actually
  // revoked value; false means the drop was device-unaccepted before review,
  // so there is nothing to give back (accepted stays false).
  if (!drop.pointsRevoked) return emptyPlan({ accepted: false, pointsRevoked: false });

  const plan: RevocationPlan = {
    dropUpdate: { accepted: true, pointsRevoked: false },
    sessionUpdate: { acceptedDropCount: session.acceptedDropCount + 1 },
    shopPointEntry: null,
    batteryEntry: null,
  };

  // OPEN and EXPIRED are count-only restores. A drop rejected while the session
  // was OPEN latches pointsRevoked=true but writes NO ledger row (planReject line
  // ~99); if the session then finalizes with 0 accepted drops it becomes EXPIRED,
  // which granted nothing and has no claim token. Posting a shop-point ADJUST or
  // bumping batteriesEstimated on approve would credit value with no matching
  // grant — asymmetric with the reject. Restore the count only (spec §6).
  if (session.status === "OPEN" || session.status === "EXPIRED") return plan;

  if (session.shopId !== null) {
    plan.shopPointEntry = {
      shopId: session.shopId,
      deviceId: session.deviceId,
      sessionId: session.id,
      amount: effectiveShopPointsPerVape(rates),
      type: "ADJUST",
      status: "POSTED",
      description: `Drop #${drop.id} re-approved after rejection`,
    };
  }

  if (session.status === "CLAIMED" && session.claimedByCustomerId !== null) {
    plan.batteryEntry = {
      customerId: session.claimedByCustomerId,
      sessionId: null,
      amount: rates.batteriesPerVape,
      type: "ADJUST",
      status: "POSTED",
      description: `Drop #${drop.id} re-approved after rejection (session #${session.id})`,
    };
  } else if (!session.offline) {
    // Symmetric add-back. If the reject clipped at the 0 floor this can
    // over-credit relative to the pre-reject estimate — accepted trade-off of
    // not storing per-drop rates (see planReject caveat). Offline sessions are
    // excluded: they finalized with batteriesEstimated=0 (no batteries, no
    // claim), so adding batteriesPerVape here would materialize phantom estimated
    // batteries the session never had. Leave it undefined so it stays 0; the
    // shop-point ADJUST above is the only reversal offline sessions get (§3.4).
    plan.sessionUpdate.batteriesEstimated =
      session.batteriesEstimated + rates.batteriesPerVape;
  }

  return plan;
}
