// Pure shaping + merging for the customer activity feed.
//
// Lives in shared/ (not inside a route handler or a React component) so it can
// be unit-tested by the existing server/__tests__ harness, which has no DB and
// no DOM. No imports, no I/O.

export type LedgerStatus = "PENDING" | "POSTED" | "VOID";
export type LedgerType = "EARNED" | "REDEEMED" | "ADJUST";

/** Raw joined row from storage.getClaimedSessionsByCustomer. */
export interface ClaimedSessionRow {
  sessionId: number;
  claimedAt: Date | string | null;
  createdAt: Date | string;
  acceptedDropCount: number;
  offline: boolean;
  amount: number;
  ledgerStatus: LedgerStatus;
  shopId: number | null;
  shopName: string | null;
  shopCity: string | null;
  selfReportId: number | null;
}

/** A claimed drop session as the customer dashboard sees it. */
export interface CustomerSession {
  sessionId: number;
  at: string | null;
  vapes: number;
  batteries: number;
  ledgerStatus: LedgerStatus;
  offline: boolean;
  shop: { id: number; name: string; city: string } | null;
  hasSelfReport: boolean;
}

/** A ledger row as returned by GET /api/customer/transactions. */
export interface CustomerTransaction {
  id: number;
  sessionId: number | null;
  amount: number;
  type: LedgerType;
  status: LedgerStatus;
  description: string;
  createdAt: Date | string;
}

export type FeedItem =
  | { kind: "drop"; key: string; at: string | null; title: string; subtitle: string | null;
      batteries: number; vapes: number; sessionId: number; hasSelfReport: boolean; pending: boolean }
  | { kind: "redeem" | "adjust"; key: string; at: string | null; title: string;
      subtitle: string | null; batteries: number; pending: boolean };

function toIso(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Sort key: null timestamps sink to the bottom rather than jumping to the top. */
function sortKey(at: string | null): number {
  return at ? new Date(at).getTime() : -Infinity;
}

/**
 * Shape one joined session row for the client.
 *
 * `batteries` comes from the LEDGER amount, not drop_sessions.batteriesEstimated
 * — the ledger is what the customer was actually credited, and estimated is 0
 * for offline sessions by design.
 */
export function mapCustomerSessionRow(row: ClaimedSessionRow): CustomerSession {
  return {
    sessionId: row.sessionId,
    at: toIso(row.claimedAt) ?? toIso(row.createdAt),
    vapes: Math.max(0, row.acceptedDropCount ?? 0),
    batteries: row.amount ?? 0,
    ledgerStatus: row.ledgerStatus,
    offline: !!row.offline,
    shop: row.shopId == null
      ? null
      : { id: row.shopId, name: row.shopName ?? "Unknown shop", city: row.shopCity ?? "" },
    hasSelfReport: row.selfReportId != null,
  };
}

/**
 * Merge drop sessions with ledger rows into one chronological feed.
 *
 * Sessions are the richer source (shop name, vape count, self-report flag) but
 * only cover EARNED rows. Redemptions and staff adjustments exist ONLY in the
 * ledger. So: take every session, then add any transaction that doesn't already
 * have a session in the list — deduping on sessionId, which is exactly why the
 * transactions endpoint must return it.
 */
export function mergeFeed(
  sessions: CustomerSession[],
  transactions: CustomerTransaction[],
): FeedItem[] {
  const claimedSessionIds = new Set(sessions.map((s) => s.sessionId));

  const items: FeedItem[] = sessions.map((s) => ({
    kind: "drop",
    key: `session-${s.sessionId}`,
    at: s.at,
    title: s.vapes === 1 ? "1 vape recycled" : `${s.vapes} vapes recycled`,
    subtitle: s.shop ? s.shop.name : null,
    batteries: s.batteries,
    vapes: s.vapes,
    sessionId: s.sessionId,
    hasSelfReport: s.hasSelfReport,
    // Only POSTED rows count toward the balance (see getBatteryBalance).
    pending: s.ledgerStatus !== "POSTED",
  }));

  for (const t of transactions) {
    // Already represented by its richer session row.
    if (t.sessionId != null && claimedSessionIds.has(t.sessionId)) continue;
    // REDEEMED reads as a purchase; ADJUST (a staff correction) and any EARNED
    // row we couldn't join to a session both read as a balance change. An
    // unjoined EARNED row is still shown rather than silently dropped.
    items.push({
      kind: t.type === "REDEEMED" ? "redeem" : "adjust",
      key: `tx-${t.id}`,
      at: toIso(t.createdAt),
      title: t.description,
      subtitle: null,
      batteries: t.amount,
      pending: t.status !== "POSTED",
    });
  }

  return items.sort((a, b) => sortKey(b.at) - sortKey(a.at));
}

/** Batteries earned per calendar month, oldest first — for the trend chart. */
export function monthlyEarnings(
  sessions: CustomerSession[],
  months = 6,
): { month: string; batteries: number; vapes: number }[] {
  const buckets = new Map<string, { batteries: number; vapes: number }>();
  for (const s of sessions) {
    if (!s.at) continue;
    const key = s.at.slice(0, 7); // YYYY-MM
    const b = buckets.get(key) ?? { batteries: 0, vapes: 0 };
    b.batteries += s.batteries;
    b.vapes += s.vapes;
    buckets.set(key, b);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-months)
    .map(([month, v]) => ({ month, ...v }));
}
