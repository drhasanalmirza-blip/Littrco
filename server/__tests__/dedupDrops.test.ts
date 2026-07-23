import { describe, it, expect } from "vitest";
import {
  hasDuplicates,
  survivorAndDuplicates,
  reconcileSession,
} from "../dedupDrops";

describe("survivorAndDuplicates (keep MIN id, delete the retry rows)", () => {
  it("keeps the earliest id and removes the rest", () => {
    expect(survivorAndDuplicates([5, 2, 9])).toEqual({ keep: 2, remove: [5, 9] });
  });

  it("is order-independent", () => {
    expect(survivorAndDuplicates([9, 2, 5])).toEqual({ keep: 2, remove: [9, 5] });
  });

  it("no duplicates: nothing to remove", () => {
    expect(survivorAndDuplicates([7])).toEqual({ keep: 7, remove: [] });
  });

  it("throws on an empty group (never expected from the guard query)", () => {
    expect(() => survivorAndDuplicates([])).toThrow();
  });
});

describe("hasDuplicates (pre/post-remediation guard)", () => {
  it("true when any group has count > 1", () => {
    expect(hasDuplicates([{ sessionId: 1, sequence: 0, count: 2 }])).toBe(true);
  });
  it("false when all groups are singletons / empty", () => {
    expect(hasDuplicates([])).toBe(false);
    expect(hasDuplicates([{ sessionId: 1, sequence: 0, count: 1 }])).toBe(false);
  });
});

describe("reconcileSession", () => {
  it("OPEN session: fixes counters only, never touches awards", () => {
    const r = reconcileSession({
      status: "OPEN",
      offline: false,
      survivingDrops: [{ accepted: true }, { accepted: false }],
      perVape: 1,
      batteriesPerVape: 5,
      previousShopPointsAwarded: 0,
    });
    expect(r.detectedDropCount).toBe(2);
    expect(r.acceptedDropCount).toBe(1);
    expect(r.awardsRecomputed).toBe(false);
    expect(r.shopPointsDelta).toBe(0);
  });

  it("EXPIRED session: counters only, no award recompute", () => {
    const r = reconcileSession({
      status: "EXPIRED",
      offline: false,
      survivingDrops: [],
      perVape: 2,
      batteriesPerVape: 5,
      previousShopPointsAwarded: 0,
    });
    expect(r.acceptedDropCount).toBe(0);
    expect(r.awardsRecomputed).toBe(false);
  });

  it("FINALIZED live session: recomputes batteries + points and the compensating delta", () => {
    // Before dedup the session had 4 accepted (one was a retry duplicate) and was
    // finalized at perVape=2 => shop_points_awarded=8. After dedup: 3 accepted.
    const r = reconcileSession({
      status: "FINALIZED",
      offline: false,
      survivingDrops: [{ accepted: true }, { accepted: true }, { accepted: true }],
      perVape: 2,
      batteriesPerVape: 5,
      previousShopPointsAwarded: 8,
    });
    expect(r.acceptedDropCount).toBe(3);
    expect(r.awardsRecomputed).toBe(true);
    expect(r.shopPointsAwarded).toBe(6); // 3 * 2
    expect(r.batteriesEstimated).toBe(15); // 3 * 5
    expect(r.shopPointsDelta).toBe(-2); // 6 - 8 -> compensating ADJUST of -2
  });

  it("FINALIZED offline session: shop points recomputed, zero batteries", () => {
    const r = reconcileSession({
      status: "FINALIZED",
      offline: true,
      survivingDrops: [{ accepted: true }, { accepted: true }],
      perVape: 3,
      batteriesPerVape: 5,
      previousShopPointsAwarded: 9, // was 3 accepted * 3
    });
    expect(r.awardsRecomputed).toBe(true);
    expect(r.shopPointsAwarded).toBe(6); // 2 * 3
    expect(r.batteriesEstimated).toBe(0); // offline
    expect(r.shopPointsDelta).toBe(-3);
  });

  it("CLAIMED session: still recomputes awards (idempotent read of surviving drops)", () => {
    const r = reconcileSession({
      status: "CLAIMED",
      offline: false,
      survivingDrops: [{ accepted: true }],
      perVape: 1,
      batteriesPerVape: 5,
      previousShopPointsAwarded: 2,
    });
    expect(r.awardsRecomputed).toBe(true);
    expect(r.shopPointsAwarded).toBe(1);
    expect(r.shopPointsDelta).toBe(-1);
  });

  it("no over-count (delta 0): award columns land on the same values, no ledger row needed", () => {
    const r = reconcileSession({
      status: "FINALIZED",
      offline: false,
      survivingDrops: [{ accepted: true }, { accepted: true }],
      perVape: 1,
      batteriesPerVape: 5,
      previousShopPointsAwarded: 2,
    });
    expect(r.shopPointsDelta).toBe(0);
  });
});
