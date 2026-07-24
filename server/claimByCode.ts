import type { devices } from "@shared/schema";

// Pure module (no db import, safe for unit tests) — the device patch applied when
// a bin claims its pair code (spec §2.3).
//
// It deliberately does NOT include shopId: the shop was attached to the
// PROVISIONING device when the pair code was created, so re-pairing an existing
// bin must LEAVE shopId untouched (W2a). Nulling shopId here would orphan the
// bin's drop sessions from its shop and hide them in the partner/staff dashboards.
// Keeping it pure lets claimByCode.test.ts lock the "never touches shopId" invariant.
export function buildClaimByCodeUpdate(
  device: { serial: string | null; firmwareVersion: string | null },
  input: { uid: string; firmwareVersion?: string },
  opts: { deviceKeyHash: string; now: Date },
): Partial<typeof devices.$inferInsert> {
  return {
    // Fresh key, returned to the bin exactly once — only its hash is stored.
    deviceKeyHash: opts.deviceKeyHash,
    status: "LIVE",
    firmwareVersion: input.firmwareVersion || device.firmwareVersion,
    lastHeartbeatAt: opts.now,
    // serial is NOT NULL so pair-code devices always have a generated one; the
    // MAC-derived uid only backfills legacy rows missing a serial (§2.3).
    ...(device.serial ? {} : { serial: input.uid }),
  };
}
