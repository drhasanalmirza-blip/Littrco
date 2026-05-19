import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { createDropV2Handler } from "../handlers/dropV2";
import type { DropV2Storage } from "../handlers/dropV2";

function makeStorage(overrides: Partial<DropV2Storage> = {}): DropV2Storage {
  return {
    getDeviceByUid: vi.fn(),
    updateDeviceLastSeen: vi.fn().mockResolvedValue(undefined),
    getDropEventByDeviceEventId: vi.fn().mockResolvedValue(undefined),
    getRewardSession: vi.fn().mockResolvedValue(undefined),
    getBinByDeviceId: vi.fn(),
    getDeviceConfig: vi.fn().mockResolvedValue({ sessionWindowSec: 60 }),
    getDropByEventId: vi.fn().mockResolvedValue(undefined),
    getRewardConfig: vi.fn().mockResolvedValue({ enabled: true, rewardTableJson: [{ points: 10, weight: 1 }] }),
    createDropEventIdempotent: vi.fn().mockResolvedValue({ id: 1, sessionId: null, pointsAwarded: 0 }),
    processDropAtomic: vi.fn().mockResolvedValue({
      duplicate: false,
      dropEvent: { id: 1, sessionId: 42 },
      session: { id: 42, pointsTotal: 10, dropCount: 1, token: "tok123" },
    }),
    ...overrides,
  };
}

const ACTIVE_DEVICE = {
  id: 1,
  shopId: 1,
  status: "ACTIVE",
  uid: "device-uid-001",
};

const NORMAL_BIN = {
  id: 1,
  mode: "normal",
  status: "active",
  rejectNonVapes: true,
  rejectThcVapes: false,
};

function makeApp(store: DropV2Storage) {
  const app = express();
  app.use(express.json());
  app.post("/api/v2/device/drop", createDropV2Handler(store, () => "test-token"));
  return app;
}

describe("POST /api/v2/device/drop — rejection gating", () => {
  describe("Test 1: denied verdict → rejected: true, points: 0, sessionId: null, no ledger row", () => {
    let store: DropV2Storage;

    beforeEach(() => {
      store = makeStorage({
        getDeviceByUid: vi.fn().mockResolvedValue(ACTIVE_DEVICE),
        getBinByDeviceId: vi.fn().mockResolvedValue({
          ...NORMAL_BIN,
          rejectNonVapes: true,
          rejectThcVapes: false,
        }),
        getDropByEventId: vi.fn().mockResolvedValue({
          id: 99,
          verdictReady: true,
          verdictAccepted: false,
          verdictReason: "not_a_vape",
        }),
      });
    });

    it("returns rejected:true, points:0, sessionId:null", async () => {
      const res = await request(makeApp(store))
        .post("/api/v2/device/drop")
        .send({ uid: "device-uid-001", event_id: "evt-abc" });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.rejected).toBe(true);
      expect(res.body.points).toBe(0);
      expect(res.body.sessionId).toBeNull();
      expect(res.body.rejectionReason).toBe("not_a_vape");
    });

    it("writes no partner_points_ledger row (processDropAtomic is never called)", async () => {
      await request(makeApp(store))
        .post("/api/v2/device/drop")
        .send({ uid: "device-uid-001", event_id: "evt-abc" });

      expect(store.processDropAtomic).not.toHaveBeenCalled();
    });

    it("still writes a minimal drop-event row for idempotency", async () => {
      await request(makeApp(store))
        .post("/api/v2/device/drop")
        .send({ uid: "device-uid-001", event_id: "evt-abc" });

      expect(store.createDropEventIdempotent).toHaveBeenCalledWith(
        expect.objectContaining({
          shopId: 1,
          deviceId: 1,
          deviceEventId: "evt-abc",
          sessionId: null,
          pointsAwarded: 0,
        }),
      );
    });

    it("also rejects thc_vape when rejectThcVapes is enabled", async () => {
      const thcStore = makeStorage({
        getDeviceByUid: vi.fn().mockResolvedValue(ACTIVE_DEVICE),
        getBinByDeviceId: vi.fn().mockResolvedValue({
          ...NORMAL_BIN,
          rejectNonVapes: false,
          rejectThcVapes: true,
        }),
        getDropByEventId: vi.fn().mockResolvedValue({
          id: 100,
          verdictReady: true,
          verdictAccepted: false,
          verdictReason: "thc_vape",
        }),
      });

      const res = await request(makeApp(thcStore))
        .post("/api/v2/device/drop")
        .send({ uid: "device-uid-001", event_id: "evt-thc" });

      expect(res.body.rejected).toBe(true);
      expect(res.body.rejectionReason).toBe("thc_vape");
      expect(res.body.points).toBe(0);
      expect(thcStore.processDropAtomic).not.toHaveBeenCalled();
    });
  });

  describe("Test 2: pending response when gating enabled but verdict not yet ready", () => {
    let store: DropV2Storage;

    beforeEach(() => {
      store = makeStorage({
        getDeviceByUid: vi.fn().mockResolvedValue(ACTIVE_DEVICE),
        getBinByDeviceId: vi.fn().mockResolvedValue({
          ...NORMAL_BIN,
          rejectNonVapes: true,
        }),
        getDropByEventId: vi.fn().mockResolvedValue(undefined),
      });
    });

    it("returns pending:true with retryAfterMs", async () => {
      const res = await request(makeApp(store))
        .post("/api/v2/device/drop")
        .send({ uid: "device-uid-001", event_id: "evt-new" });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.pending).toBe(true);
      expect(res.body.reason).toBe("awaiting_classifier_verdict");
      expect(res.body.retryAfterMs).toBe(1000);
    });

    it("does not call processDropAtomic while pending", async () => {
      await request(makeApp(store))
        .post("/api/v2/device/drop")
        .send({ uid: "device-uid-001", event_id: "evt-new" });

      expect(store.processDropAtomic).not.toHaveBeenCalled();
    });

    it("still returns pending when verdict exists but verdictReady=false", async () => {
      const pendingVerdictStore = makeStorage({
        getDeviceByUid: vi.fn().mockResolvedValue(ACTIVE_DEVICE),
        getBinByDeviceId: vi.fn().mockResolvedValue({
          ...NORMAL_BIN,
          rejectNonVapes: true,
        }),
        getDropByEventId: vi.fn().mockResolvedValue({
          id: 77,
          verdictReady: false,
          verdictAccepted: null,
          verdictReason: null,
        }),
      });

      const res = await request(makeApp(pendingVerdictStore))
        .post("/api/v2/device/drop")
        .send({ uid: "device-uid-001", event_id: "evt-partial" });

      expect(res.body.pending).toBe(true);
    });
  });

  describe("Test 3: accepted verdict → normal reward path", () => {
    let store: DropV2Storage;

    beforeEach(() => {
      store = makeStorage({
        getDeviceByUid: vi.fn().mockResolvedValue(ACTIVE_DEVICE),
        getBinByDeviceId: vi.fn().mockResolvedValue({
          ...NORMAL_BIN,
          rejectNonVapes: true,
        }),
        getDropByEventId: vi.fn().mockResolvedValue({
          id: 55,
          verdictReady: true,
          verdictAccepted: true,
          verdictReason: "vape",
        }),
      });
    });

    it("returns sessionId and points > 0 when verdict is accepted", async () => {
      const res = await request(makeApp(store))
        .post("/api/v2/device/drop")
        .send({ uid: "device-uid-001", event_id: "evt-accepted" });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.rejected).toBe(false);
      expect(res.body.sessionId).toBe(42);
      expect(res.body.points).toBeGreaterThan(0);
    });

    it("calls processDropAtomic (which writes the ledger row)", async () => {
      await request(makeApp(store))
        .post("/api/v2/device/drop")
        .send({ uid: "device-uid-001", event_id: "evt-accepted" });

      expect(store.processDropAtomic).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: 1,
          shopId: 1,
          eventId: "evt-accepted",
        }),
      );
    });

    it("does NOT reject when verdict accepted even with rejectNonVapes=true", async () => {
      const res = await request(makeApp(store))
        .post("/api/v2/device/drop")
        .send({ uid: "device-uid-001", event_id: "evt-accepted" });

      expect(res.body.rejected).toBe(false);
      expect(res.body.sessionId).not.toBeNull();
    });
  });

  describe("Edge: gating disabled → skip verdict check, award immediately", () => {
    it("calls processDropAtomic even with no verdict when gating is off", async () => {
      const store = makeStorage({
        getDeviceByUid: vi.fn().mockResolvedValue(ACTIVE_DEVICE),
        getBinByDeviceId: vi.fn().mockResolvedValue({
          ...NORMAL_BIN,
          rejectNonVapes: false,
          rejectThcVapes: false,
        }),
        getDropByEventId: vi.fn().mockResolvedValue(undefined),
      });

      const res = await request(makeApp(store))
        .post("/api/v2/device/drop")
        .send({ uid: "device-uid-001", event_id: "evt-no-gate" });

      expect(res.body.rejected).toBe(false);
      expect(store.processDropAtomic).toHaveBeenCalled();
    });
  });
});
