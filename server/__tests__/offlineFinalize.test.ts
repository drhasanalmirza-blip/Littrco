import { describe, it, expect } from "vitest";
import { finalizeDecision, finalizeReplayKind } from "../offlineFinalize";

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

describe("finalizeReplayKind (audit M-8 — idempotent-by-replay finalize)", () => {
  it("OPEN session runs the real awarding path", () => {
    expect(finalizeReplayKind("OPEN", false)).toBe("award");
    expect(finalizeReplayKind("OPEN", true)).toBe("award");
  });

  it("live FINALIZED session replays the existing claim token (no re-award)", () => {
    // The lost-200 case: shop already got points + a token was minted. A retry
    // must echo the live outcome, never award again.
    expect(finalizeReplayKind("FINALIZED", false)).toBe("live");
  });

  it("offline FINALIZED session replays shop-points-only", () => {
    expect(finalizeReplayKind("FINALIZED", true)).toBe("offline");
  });

  it("CLAIMED session still replays its outcome (offline flag respected)", () => {
    // A customer may have already scanned before the device retried; the read is
    // idempotent, so still return the existing outcome rather than 400.
    expect(finalizeReplayKind("CLAIMED", false)).toBe("live");
    expect(finalizeReplayKind("CLAIMED", true)).toBe("offline");
  });

  it("EXPIRED session echoes the no-award expired response, never a live replay", () => {
    // An expired session had zero accepted drops: no token, nothing to replay.
    expect(finalizeReplayKind("EXPIRED", false)).toBe("expired");
    expect(finalizeReplayKind("EXPIRED", true)).toBe("expired");
  });
});
