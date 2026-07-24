import { describe, it, expect } from "vitest";
import { buildClaimByCodeUpdate } from "../claimByCode";

const now = new Date("2026-07-23T00:00:00.000Z");
const opts = { deviceKeyHash: "hash123", now };

describe("buildClaimByCodeUpdate — W2a shopId preservation", () => {
  it("never includes shopId in the patch (re-pairing must not null the shop link)", () => {
    const patch = buildClaimByCodeUpdate(
      { serial: "LITTR-ABC", firmwareVersion: "1.0.0" },
      { uid: "AABBCCDDEEFF", firmwareVersion: "1.2.0" },
      opts,
    );
    expect("shopId" in patch).toBe(false);
    expect(patch.shopId).toBeUndefined();
  });

  it("brings the device LIVE and stores the fresh key hash + heartbeat", () => {
    const patch = buildClaimByCodeUpdate(
      { serial: "LITTR-ABC", firmwareVersion: "1.0.0" },
      { uid: "AABBCCDDEEFF" },
      opts,
    );
    expect(patch.status).toBe("LIVE");
    expect(patch.deviceKeyHash).toBe("hash123");
    expect(patch.lastHeartbeatAt).toBe(now);
  });
});

describe("buildClaimByCodeUpdate — firmware + serial handling", () => {
  it("uses the reported firmware version when present", () => {
    const patch = buildClaimByCodeUpdate(
      { serial: "LITTR-ABC", firmwareVersion: "1.0.0" },
      { uid: "AABBCCDDEEFF", firmwareVersion: "1.2.0" },
      opts,
    );
    expect(patch.firmwareVersion).toBe("1.2.0");
  });

  it("falls back to the stored firmware version when none reported", () => {
    const patch = buildClaimByCodeUpdate(
      { serial: "LITTR-ABC", firmwareVersion: "1.0.0" },
      { uid: "AABBCCDDEEFF" },
      opts,
    );
    expect(patch.firmwareVersion).toBe("1.0.0");
  });

  it("does NOT overwrite an existing serial", () => {
    const patch = buildClaimByCodeUpdate(
      { serial: "LITTR-ABC", firmwareVersion: null },
      { uid: "AABBCCDDEEFF" },
      opts,
    );
    expect("serial" in patch).toBe(false);
  });

  it("backfills serial from uid only for a legacy row missing one", () => {
    const patch = buildClaimByCodeUpdate(
      { serial: null, firmwareVersion: null },
      { uid: "AABBCCDDEEFF" },
      opts,
    );
    expect(patch.serial).toBe("AABBCCDDEEFF");
  });
});
