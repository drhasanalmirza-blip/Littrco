import { describe, it, expect } from "vitest";
import {
  effectiveShopPointsPerVape, planApprove, planReject,
  type ReviewDropState, type ReviewRates, type ReviewSessionState,
} from "../reviewRules";

const drop = (over: Partial<ReviewDropState> = {}): ReviewDropState => ({
  id: 42,
  accepted: true,
  reviewStatus: "UNREVIEWED",
  pointsRevoked: false,
  ...over,
});

const session = (over: Partial<ReviewSessionState> = {}): ReviewSessionState => ({
  id: 7,
  status: "CLAIMED",
  shopId: 3,
  deviceId: 11,
  acceptedDropCount: 4,
  batteriesEstimated: 20,
  claimedByCustomerId: 99,
  ...over,
});

const rates = (over: Partial<ReviewRates> = {}): ReviewRates => ({
  batteriesPerVape: 5,
  shopPointsPerVape: 2,
  pointsPerVapeOverride: null,
  ...over,
});

describe("effectiveShopPointsPerVape", () => {
  it("falls back to the shop-wide rate when no override", () => {
    expect(effectiveShopPointsPerVape(rates())).toBe(2);
  });

  it("uses the per-device override when set", () => {
    expect(effectiveShopPointsPerVape(rates({ pointsPerVapeOverride: 7 }))).toBe(7);
  });

  it("honors an override of 0 (?? not ||)", () => {
    expect(effectiveShopPointsPerVape(rates({ pointsPerVapeOverride: 0 }))).toBe(0);
  });
});

describe("planReject — claimed session", () => {
  it("revokes the drop, decrements the count, and writes both compensating entries", () => {
    const plan = planReject(drop(), session(), rates(), "not a vape")!;
    expect(plan.dropUpdate).toEqual({ accepted: false, pointsRevoked: true });
    expect(plan.sessionUpdate).toEqual({ acceptedDropCount: 3 });
    expect(plan.shopPointEntry).toEqual({
      shopId: 3, deviceId: 11, sessionId: 7,
      amount: -2, type: "ADJUST", status: "POSTED",
      description: "Drop #42 rejected: not a vape",
    });
    expect(plan.batteryEntry).toMatchObject({
      customerId: 99, amount: -5, type: "ADJUST", status: "POSTED",
    });
  });

  it("leaves batteriesEstimated untouched (ledger row is the correction)", () => {
    const plan = planReject(drop(), session(), rates(), "x")!;
    expect(plan.sessionUpdate.batteriesEstimated).toBeUndefined();
  });

  it("battery entry uses a null sessionId (UNIQUE(session_id) held by the claim's EARNED row)", () => {
    const plan = planReject(drop(), session(), rates(), "x")!;
    expect(plan.batteryEntry!.sessionId).toBeNull();
    expect(plan.batteryEntry!.description).toContain("#7");
  });

  it("uses the per-device override rate for the shop compensation", () => {
    const plan = planReject(drop(), session(), rates({ pointsPerVapeOverride: 10 }), "x")!;
    expect(plan.shopPointEntry!.amount).toBe(-10);
    // batteries are never affected by the points override
    expect(plan.batteryEntry!.amount).toBe(-5);
  });

  it("names the drop and the reason in both descriptions", () => {
    const plan = planReject(drop({ id: 555 }), session(), rates(), "blurry photo")!;
    expect(plan.shopPointEntry!.description).toBe("Drop #555 rejected: blurry photo");
    expect(plan.batteryEntry!.description).toContain("Drop #555");
    expect(plan.batteryEntry!.description).toContain("blurry photo");
  });

  it("skips the shop entry when the session has no shop", () => {
    const plan = planReject(drop(), session({ shopId: null }), rates(), "x")!;
    expect(plan.shopPointEntry).toBeNull();
    expect(plan.batteryEntry).not.toBeNull(); // customer compensation still applies
  });
});

describe("planReject — finalized but unclaimed session", () => {
  const s = session({ status: "FINALIZED", claimedByCustomerId: null });

  it("corrects the estimate instead of writing a battery entry", () => {
    const plan = planReject(drop(), s, rates(), "x")!;
    expect(plan.batteryEntry).toBeNull();
    expect(plan.sessionUpdate.batteriesEstimated).toBe(15); // 20 - 5
    expect(plan.shopPointEntry!.amount).toBe(-2); // shop points were granted at finalize
  });

  it("floors the estimate at 0", () => {
    const plan = planReject(drop(), session({ ...s, batteriesEstimated: 3 }), rates(), "x")!;
    expect(plan.sessionUpdate.batteriesEstimated).toBe(0);
  });

  it("treats EXPIRED the same (nothing claimable, fix the record)", () => {
    const plan = planReject(drop(), session({ status: "EXPIRED", claimedByCustomerId: null }), rates(), "x")!;
    expect(plan.batteryEntry).toBeNull();
    expect(plan.sessionUpdate.batteriesEstimated).toBe(15);
  });
});

describe("planReject — open session", () => {
  it("only decrements the count; finalize will compute from corrected state", () => {
    const plan = planReject(drop(), session({ status: "OPEN", claimedByCustomerId: null }), rates(), "x")!;
    expect(plan.sessionUpdate).toEqual({ acceptedDropCount: 3 });
    expect(plan.shopPointEntry).toBeNull();
    expect(plan.batteryEntry).toBeNull();
  });
});

describe("planReject — floors and idempotency", () => {
  it("floors acceptedDropCount at 0", () => {
    const plan = planReject(drop(), session({ acceptedDropCount: 0 }), rates(), "x")!;
    expect(plan.sessionUpdate.acceptedDropCount).toBe(0);
  });

  it("is a no-op (null) when the drop is already REJECTED", () => {
    expect(planReject(drop({ reviewStatus: "REJECTED" }), session(), rates(), "x")).toBeNull();
    expect(planReject(drop({ reviewStatus: "REJECTED", accepted: false, pointsRevoked: true }), session(), rates(), "x")).toBeNull();
  });

  it("rejecting a device-unaccepted drop is bookkeeping only (nothing was granted)", () => {
    const plan = planReject(drop({ accepted: false }), session(), rates(), "x")!;
    expect(plan.dropUpdate).toEqual({ accepted: false, pointsRevoked: false });
    expect(plan.sessionUpdate).toEqual({});
    expect(plan.shopPointEntry).toBeNull();
    expect(plan.batteryEntry).toBeNull();
  });
});

describe("planApprove", () => {
  it("is a no-op (null) when already APPROVED", () => {
    expect(planApprove(drop({ reviewStatus: "APPROVED" }), session(), rates())).toBeNull();
  });

  it("UNREVIEWED -> APPROVED moves no value and preserves the drop flags", () => {
    const plan = planApprove(drop({ accepted: false }), session(), rates())!;
    expect(plan.dropUpdate).toEqual({ accepted: false, pointsRevoked: false });
    expect(plan.sessionUpdate).toEqual({});
    expect(plan.shopPointEntry).toBeNull();
    expect(plan.batteryEntry).toBeNull();
  });

  it("approve-after-reject on a claimed session writes the symmetric reverse entries", () => {
    const rejected = drop({ reviewStatus: "REJECTED", accepted: false, pointsRevoked: true });
    const s = session({ acceptedDropCount: 3 }); // post-reject count
    const plan = planApprove(rejected, s, rates())!;
    expect(plan.dropUpdate).toEqual({ accepted: true, pointsRevoked: false });
    expect(plan.sessionUpdate).toEqual({ acceptedDropCount: 4 });
    expect(plan.shopPointEntry).toMatchObject({ amount: 2, type: "ADJUST", status: "POSTED" });
    expect(plan.batteryEntry).toMatchObject({ customerId: 99, amount: 5, sessionId: null });
  });

  it("approve-after-reject on a finalized-unclaimed session restores the estimate", () => {
    const rejected = drop({ reviewStatus: "REJECTED", accepted: false, pointsRevoked: true });
    const s = session({ status: "FINALIZED", claimedByCustomerId: null, batteriesEstimated: 15 });
    const plan = planApprove(rejected, s, rates())!;
    expect(plan.batteryEntry).toBeNull();
    expect(plan.sessionUpdate.batteriesEstimated).toBe(20);
  });

  it("approve-after-reject on an OPEN session only restores the count", () => {
    const rejected = drop({ reviewStatus: "REJECTED", accepted: false, pointsRevoked: true });
    const plan = planApprove(rejected, session({ status: "OPEN", claimedByCustomerId: null }), rates())!;
    expect(plan.sessionUpdate).toEqual({ acceptedDropCount: 5 });
    expect(plan.shopPointEntry).toBeNull();
    expect(plan.batteryEntry).toBeNull();
  });

  it("approve after an OPEN reject that finalized to EXPIRED restores only the count (no phantom credit)", () => {
    // Rejected while OPEN (pointsRevoked latched true, but no ledger row written),
    // then finalize saw 0 accepted drops → EXPIRED, granted nothing, no claim token.
    const rejected = drop({ reviewStatus: "REJECTED", accepted: false, pointsRevoked: true });
    const s = session({ status: "EXPIRED", claimedByCustomerId: null, acceptedDropCount: 0, batteriesEstimated: 0 });
    const plan = planApprove(rejected, s, rates())!;
    expect(plan.dropUpdate).toEqual({ accepted: true, pointsRevoked: false });
    expect(plan.sessionUpdate).toEqual({ acceptedDropCount: 1 });
    expect(plan.shopPointEntry).toBeNull(); // no shop-point credit with no matching grant
    expect(plan.batteryEntry).toBeNull();
    expect(plan.sessionUpdate.batteriesEstimated).toBeUndefined(); // estimate not bumped
  });

  it("restores nothing when the reject revoked nothing (pointsRevoked latch false)", () => {
    const rejected = drop({ reviewStatus: "REJECTED", accepted: false, pointsRevoked: false });
    const plan = planApprove(rejected, session(), rates())!;
    expect(plan.dropUpdate).toEqual({ accepted: false, pointsRevoked: false });
    expect(plan.sessionUpdate).toEqual({});
    expect(plan.shopPointEntry).toBeNull();
    expect(plan.batteryEntry).toBeNull();
  });

  it("uses the override rate on restore too, so the reversal mirrors the revocation", () => {
    const rejected = drop({ reviewStatus: "REJECTED", accepted: false, pointsRevoked: true });
    const plan = planApprove(rejected, session(), rates({ pointsPerVapeOverride: 10 }))!;
    expect(plan.shopPointEntry!.amount).toBe(10);
  });
});

describe("reject -> approve round trip", () => {
  it("nets the ledger to zero and restores session state (claimed session)", () => {
    const r = rates({ pointsPerVapeOverride: 4 });
    const s0 = session({ acceptedDropCount: 4, batteriesEstimated: 20 });

    const reject = planReject(drop(), s0, r, "oops")!;
    const s1 = session({
      acceptedDropCount: reject.sessionUpdate.acceptedDropCount!,
      batteriesEstimated: reject.sessionUpdate.batteriesEstimated ?? s0.batteriesEstimated,
    });
    const d1 = drop({ reviewStatus: "REJECTED", ...reject.dropUpdate });

    const approve = planApprove(d1, s1, r)!;
    expect(approve.sessionUpdate.acceptedDropCount).toBe(s0.acceptedDropCount);
    expect(approve.dropUpdate).toEqual({ accepted: true, pointsRevoked: false });
    expect(reject.shopPointEntry!.amount + approve.shopPointEntry!.amount).toBe(0);
    expect(reject.batteryEntry!.amount + approve.batteryEntry!.amount).toBe(0);
  });

  it("nets to zero for a finalized-unclaimed session via the estimate", () => {
    const r = rates();
    const s0 = session({ status: "FINALIZED", claimedByCustomerId: null, batteriesEstimated: 20 });

    const reject = planReject(drop(), s0, r, "oops")!;
    const s1 = session({
      ...s0,
      acceptedDropCount: reject.sessionUpdate.acceptedDropCount!,
      batteriesEstimated: reject.sessionUpdate.batteriesEstimated!,
    });
    const d1 = drop({ reviewStatus: "REJECTED", ...reject.dropUpdate });

    const approve = planApprove(d1, s1, r)!;
    expect(approve.sessionUpdate.batteriesEstimated).toBe(s0.batteriesEstimated);
    expect(approve.sessionUpdate.acceptedDropCount).toBe(s0.acceptedDropCount);
  });

  it("double reject then approve still moves value exactly once", () => {
    const r = rates();
    const s0 = session();
    const first = planReject(drop(), s0, r, "a")!;
    const d1 = drop({ reviewStatus: "REJECTED", ...first.dropUpdate });
    // second reject is refused outright, so no second set of ledger entries
    expect(planReject(d1, s0, r, "b")).toBeNull();
    const approve = planApprove(d1, session({ acceptedDropCount: 3 }), r)!;
    expect(first.batteryEntry!.amount + approve.batteryEntry!.amount).toBe(0);
  });
});
