import { describe, it, expect } from "vitest";
import {
  mapCustomerSessionRow,
  mergeFeed,
  monthlyEarnings,
  type ClaimedSessionRow,
  type CustomerSession,
  type CustomerTransaction,
} from "@shared/customerFeed";

const baseRow: ClaimedSessionRow = {
  sessionId: 1,
  claimedAt: new Date("2026-07-01T12:00:00.000Z"),
  createdAt: new Date("2026-07-01T11:59:00.000Z"),
  acceptedDropCount: 3,
  offline: false,
  amount: 15,
  ledgerStatus: "POSTED",
  shopId: 7,
  shopName: "Red Eye Smoke Shop",
  shopCity: "Albany",
  selfReportId: null,
};

describe("mapCustomerSessionRow", () => {
  it("maps a normal claimed session", () => {
    expect(mapCustomerSessionRow(baseRow)).toEqual({
      sessionId: 1,
      at: "2026-07-01T12:00:00.000Z",
      vapes: 3,
      batteries: 15,
      ledgerStatus: "POSTED",
      offline: false,
      shop: { id: 7, name: "Red Eye Smoke Shop", city: "Albany" },
      hasSelfReport: false,
    });
  });

  it("returns a null shop when the shop was deleted (shopId is nullable)", () => {
    const s = mapCustomerSessionRow({ ...baseRow, shopId: null, shopName: null, shopCity: null });
    expect(s.shop).toBeNull();
  });

  it("flags a self-report when one exists", () => {
    expect(mapCustomerSessionRow({ ...baseRow, selfReportId: 42 }).hasSelfReport).toBe(true);
  });

  it("falls back to createdAt when claimedAt is null", () => {
    const s = mapCustomerSessionRow({ ...baseRow, claimedAt: null });
    expect(s.at).toBe("2026-07-01T11:59:00.000Z");
  });

  it("uses the LEDGER amount, not batteriesEstimated — offline sessions still credit", () => {
    // An offline session has batteriesEstimated 0 by design, but if a ledger row
    // exists the customer really was credited; the feed must show that.
    const s = mapCustomerSessionRow({ ...baseRow, offline: true, amount: 10 });
    expect(s.batteries).toBe(10);
    expect(s.offline).toBe(true);
  });

  it("carries a non-POSTED ledger status through", () => {
    expect(mapCustomerSessionRow({ ...baseRow, ledgerStatus: "VOID" }).ledgerStatus).toBe("VOID");
  });

  it("never reports a negative vape count", () => {
    expect(mapCustomerSessionRow({ ...baseRow, acceptedDropCount: -2 }).vapes).toBe(0);
  });
});

const session = (over: Partial<CustomerSession> = {}): CustomerSession => ({
  sessionId: 1,
  at: "2026-07-01T12:00:00.000Z",
  vapes: 3,
  batteries: 15,
  ledgerStatus: "POSTED",
  offline: false,
  shop: { id: 7, name: "Red Eye", city: "Albany" },
  hasSelfReport: false,
  ...over,
});

const tx = (over: Partial<CustomerTransaction> = {}): CustomerTransaction => ({
  id: 100,
  sessionId: null,
  amount: -50,
  type: "REDEEMED",
  status: "POSTED",
  description: "Reward redemption",
  createdAt: new Date("2026-07-02T09:00:00.000Z"),
  ...over,
});

describe("mergeFeed", () => {
  it("is empty for empty inputs", () => {
    expect(mergeFeed([], [])).toEqual([]);
  });

  it("dedupes a transaction against its own session row", () => {
    // The EARNED ledger row and the session describe the SAME drop. Only the
    // richer session row should survive — this is why the transactions endpoint
    // must return sessionId.
    const out = mergeFeed(
      [session({ sessionId: 5 })],
      [tx({ id: 9, sessionId: 5, amount: 15, type: "EARNED" })],
    );
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("drop");
  });

  it("keeps redemptions and adjustments, which exist only in the ledger", () => {
    const out = mergeFeed(
      [session({ sessionId: 5 })],
      [
        tx({ id: 9, sessionId: 5, amount: 15, type: "EARNED" }), // deduped
        tx({ id: 10, type: "REDEEMED", amount: -50 }),
        tx({ id: 11, type: "ADJUST", amount: -15, description: "Drop rejected on review" }),
      ],
    );
    expect(out).toHaveLength(3);
    expect(out.filter((i) => i.kind === "redeem")).toHaveLength(1);
    expect(out.filter((i) => i.kind === "adjust")).toHaveLength(1);
  });

  it("keeps an EARNED row whose session could not be joined", () => {
    const out = mergeFeed([], [tx({ id: 12, type: "EARNED", amount: 20, sessionId: 999 })]);
    expect(out).toHaveLength(1);
    expect(out[0].batteries).toBe(20);
  });

  it("sorts newest first across both sources", () => {
    const out = mergeFeed(
      [
        session({ sessionId: 1, at: "2026-07-01T00:00:00.000Z" }),
        session({ sessionId: 2, at: "2026-07-05T00:00:00.000Z" }),
      ],
      [tx({ id: 10, createdAt: new Date("2026-07-03T00:00:00.000Z") })],
    );
    expect(out.map((i) => i.key)).toEqual(["session-2", "tx-10", "session-1"]);
  });

  it("sinks null timestamps to the bottom instead of floating them to the top", () => {
    const out = mergeFeed(
      [session({ sessionId: 1, at: null }), session({ sessionId: 2, at: "2026-07-05T00:00:00.000Z" })],
      [],
    );
    expect(out[0].key).toBe("session-2");
    expect(out[1].key).toBe("session-1");
  });

  it("marks non-POSTED rows pending so the UI can avoid implying they were paid", () => {
    const out = mergeFeed([session({ ledgerStatus: "PENDING" })], []);
    expect(out[0].pending).toBe(true);
  });

  it("singularises the one-vape case", () => {
    expect(mergeFeed([session({ vapes: 1 })], [])[0].title).toBe("1 vape recycled");
    expect(mergeFeed([session({ vapes: 2 })], [])[0].title).toBe("2 vapes recycled");
  });
});

describe("monthlyEarnings", () => {
  it("buckets by calendar month, oldest first", () => {
    const out = monthlyEarnings([
      session({ sessionId: 1, at: "2026-05-02T00:00:00.000Z", batteries: 10, vapes: 2 }),
      session({ sessionId: 2, at: "2026-05-20T00:00:00.000Z", batteries: 5, vapes: 1 }),
      session({ sessionId: 3, at: "2026-06-01T00:00:00.000Z", batteries: 20, vapes: 4 }),
    ]);
    expect(out).toEqual([
      { month: "2026-05", batteries: 15, vapes: 3 },
      { month: "2026-06", batteries: 20, vapes: 4 },
    ]);
  });

  it("keeps only the most recent N months", () => {
    const sessions = ["2026-01", "2026-02", "2026-03", "2026-04"].map((m, i) =>
      session({ sessionId: i, at: `${m}-01T00:00:00.000Z` }),
    );
    expect(monthlyEarnings(sessions, 2).map((r) => r.month)).toEqual(["2026-03", "2026-04"]);
  });

  it("ignores sessions with no timestamp", () => {
    expect(monthlyEarnings([session({ at: null })])).toEqual([]);
  });
});
