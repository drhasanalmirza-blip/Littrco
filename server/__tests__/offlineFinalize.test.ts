import { describe, it, expect } from "vitest";
import { finalizeDecision } from "../offlineFinalize";

describe("finalizeDecision (spec §3.4)", () => {
  it("live branch: awards batteries + shop points and mints a claim", () => {
    const d = finalizeDecision({
      offline: false,
      acceptedDropCount: 3,
      perVape: 2,
      batteriesPerVape: 5,
    });
    expect(d).toEqual({
      shopPoints: 6, // 3 * 2
      batteries: 15, // 3 * 5
      mintClaim: true,
      status: "FINALIZED",
    });
  });

  it("offline branch: awards shop points but 0 batteries and no claim", () => {
    const d = finalizeDecision({
      offline: true,
      acceptedDropCount: 3,
      perVape: 2,
      batteriesPerVape: 5,
    });
    expect(d).toEqual({
      shopPoints: 6, // 3 * 2, awarded exactly like live
      batteries: 0, // owner decision: no customer batteries offline
      mintClaim: false, // no QR/claim token minted offline
      status: "FINALIZED", // has real drops -> FINALIZED, not EXPIRED
    });
  });

  it("offline shop points match the live shop points for the same count", () => {
    const live = finalizeDecision({ offline: false, acceptedDropCount: 4, perVape: 1, batteriesPerVape: 5 });
    const offline = finalizeDecision({ offline: true, acceptedDropCount: 4, perVape: 1, batteriesPerVape: 5 });
    expect(offline.shopPoints).toBe(live.shopPoints);
    expect(offline.batteries).toBe(0);
    expect(offline.mintClaim).toBe(false);
  });

  it("zero accepted drops: expires with no awards (live)", () => {
    expect(finalizeDecision({ offline: false, acceptedDropCount: 0, perVape: 2, batteriesPerVape: 5 })).toEqual({
      shopPoints: 0,
      batteries: 0,
      mintClaim: false,
      status: "EXPIRED",
    });
  });

  it("zero accepted drops: expires with no awards (offline)", () => {
    expect(finalizeDecision({ offline: true, acceptedDropCount: 0, perVape: 2, batteriesPerVape: 5 })).toEqual({
      shopPoints: 0,
      batteries: 0,
      mintClaim: false,
      status: "EXPIRED",
    });
  });
});
