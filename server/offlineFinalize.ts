// Pure decision logic for drop-session finalize (spec §3.4).
//
// NO db/schema imports — this module must stay importable from unit tests
// (server/db.ts throws without DATABASE_URL). All I/O (locking the session row,
// writing the ledger, minting the token) lives in the route; everything here is
// deterministic data-in/data-out.
//
// Owner decision: an OFFLINE session (captured while WiFi was down) awards shop
// points exactly like a live session, but customers get NO batteries and NO
// claim token is minted — there is no QR to scan for an after-the-fact drop.

export type FinalizeStatus = "FINALIZED" | "EXPIRED";

export interface FinalizeInput {
  /** Session was captured while the bin was offline. */
  offline: boolean;
  /** Accepted drops in the session (drives every award). */
  acceptedDropCount: number;
  /** Shop points per accepted vape (device override ?? shop rate ?? default). */
  perVape: number;
  /** Customer batteries per accepted vape — awarded on live sessions only. */
  batteriesPerVape: number;
}

export interface FinalizeDecision {
  /** Shop points to award the shop ledger (both live and offline). */
  shopPoints: number;
  /** Customer batteries to estimate on the session (0 for offline). */
  batteries: number;
  /** Whether to mint a claim token + expiry (live only). */
  mintClaim: boolean;
  /** Terminal session status. */
  status: FinalizeStatus;
}

/**
 * Decide the finalize outcome. A session with no accepted drops expires with no
 * awards regardless of offline. Otherwise shop points are always awarded; an
 * offline session awards 0 batteries and mints no claim (status FINALIZED — it
 * has real drops), while a live session awards batteries and mints a claim.
 */
export function finalizeDecision(input: FinalizeInput): FinalizeDecision {
  const { offline, acceptedDropCount, perVape, batteriesPerVape } = input;

  if (acceptedDropCount <= 0) {
    return { shopPoints: 0, batteries: 0, mintClaim: false, status: "EXPIRED" };
  }

  const shopPoints = acceptedDropCount * perVape;

  if (offline) {
    return { shopPoints, batteries: 0, mintClaim: false, status: "FINALIZED" };
  }

  return {
    shopPoints,
    batteries: acceptedDropCount * batteriesPerVape,
    mintClaim: true,
    status: "FINALIZED",
  };
}

// ==================== Finalize replay (audit M-8) ====================
//
// A lost finalize 200 orphans the claim: the shop keeps its points and a live
// claim token was minted, but the bin never saw it, so the customer can never
// scan. The sensor's `finalizeIfDue` runs once and clears the session, so the
// only recovery is a device retry — which must return the EXISTING outcome
// instead of 400 "Already finalized". Only genuinely-OPEN sessions run the
// awarding path; a non-OPEN session owned by the same device echoes back what
// was already committed WITHOUT awarding again.

export type SessionStatus = "OPEN" | "FINALIZED" | "CLAIMED" | "EXPIRED";

/** How a repeat finalize on a non-OPEN session should be answered. */
export type FinalizeReplayKind =
  | "award"    // still OPEN — caller must run the real awarding path
  | "expired"  // EXPIRED — echo the no-award expired response
  | "offline"  // offline session already FINALIZED/CLAIMED — echo shop-points-only
  | "live";    // live session already FINALIZED/CLAIMED — echo the existing claim token

/**
 * Decide how to answer a finalize call given the session's current committed
 * state. Pure/deterministic so it unit-tests without a DB:
 *  - OPEN            → "award" (run the awarding transaction)
 *  - EXPIRED         → "expired" (no drops were ever accepted; nothing to replay)
 *  - FINALIZED/CLAIMED, offline → "offline" (shop points only, no token)
 *  - FINALIZED/CLAIMED, live    → "live" (return the already-minted claim token)
 *
 * Note EXPIRED is deliberately NOT treated as a live replay: an expired session
 * has no accepted drops, no token, and no awards to echo.
 */
export function finalizeReplayKind(
  status: SessionStatus,
  offline: boolean,
): FinalizeReplayKind {
  if (status === "OPEN") return "award";
  if (status === "EXPIRED") return "expired";
  return offline ? "offline" : "live";
}
