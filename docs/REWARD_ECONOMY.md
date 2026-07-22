# LITTR Reward Economy

Two currencies live in two separate ledgers:

| Currency      | Who earns it | Where it lives                | How it's spent                                  |
|---------------|--------------|-------------------------------|-------------------------------------------------|
| **Batteries** | Customers    | `battery_transactions`        | Customer reward store (`/app/store`)            |
| **Points**    | Host shops   | `shop_point_transactions`     | Per-shop reward catalog the partner manages     |

Balances are **derived**, never stored as counters. The "balance" is always (over rows
where `status = 'POSTED'`):
```
SUM(amount WHERE type = 'EARNED')
  - SUM(amount WHERE type = 'REDEEMED')
  + SUM(amount WHERE type = 'ADJUST')      -- signed: negative on staff reject, positive on restore
```
`EARNED` and `REDEEMED` amounts are stored positive; `ADJUST` amounts are **signed** and
can push a balance **negative** (see Drop review & revocation below). `lifetimeEarned` is
just `SUM(EARNED)`.

---

## When the ledgers move

Both ledgers are written from `POST /api/device/drop-sessions/:id/finalize`:

1. **Shop Points** — inserted immediately, no scan required. One row per finalized session: `amount = acceptedDropCount × perVape`, where `perVape = devices.pointsPerVapeOverride ?? reward_configs.shopPointsPerVape` (default 1). The **per-device override** (set by staff via `POST /api/staff/devices/:id/points-modifier`) lets a single high-traffic or promotional bin earn its shop a different rate without changing the shop-wide config. The receipt cannot un-do this credit at claim time; partners are paid at finalize for accepted drops (but staff can later revoke — see below).

2. **Batteries** — *not* inserted yet. The session is stamped with `batteriesEstimated`, a `claimToken`, and an `expiresAt`. No customer row exists until someone claims the receipt.

---

## Claim flow

`GET /claim/:token` is the public landing page.

`POST /api/customer/claim/:token` (customer auth required):
1. Validates token exists, is not claimed, and is not expired.
2. Updates the session: `claimedByCustomerId`, `claimedAt`, `status = CLAIMED`, `batteriesConfirmed = batteriesEstimated`.
3. Inserts one `battery_transactions` row: `type = EARNED`, `status = POSTED`, `sessionId = <session>`.

### Anti-double-claim guarantee
`battery_transactions.sessionId` has a `UNIQUE` constraint. A second claim attempt fails at the database level — there is no way to award batteries twice from the same session even under a race condition.

### Expiry
Default claim window: 7 days (`reward_configs.claimExpirySec`). Past expiry, the token returns `410 Gone` and the receipt is dead — those batteries are never minted.

---

## Ledger states (`ledger_status`)

| Status   | Counted in balance? | Use case                          |
|----------|---------------------|-----------------------------------|
| `PENDING`| No                  | (Reserved — not currently issued.)|
| `POSTED` | Yes                 | The normal state.                 |
| `VOID`   | No                  | Reversed manually by staff.       |

---

## Drop review & revocation (spec §6)

Staff review individual drops in the queue (`GET /api/staff/review/queue`) and
**approve** or **reject** each one. A drop carries its own `reviewStatus`
(`UNREVIEWED | APPROVED | REJECTED`), reviewer, timestamp, note, and a `pointsRevoked`
idempotency latch.

Value granted at finalize/claim is **never edited in place** and rows are never deleted.
Instead, a reject writes **compensating `ADJUST` ledger rows** so the audit trail is
complete and reversible. `POST /api/staff/review/drops/:dropId/reject` (body `{ reason }`)
runs it all in **one transaction**:

1. If already `REJECTED` → no-op `200` (idempotent).
2. Stamp the drop `REJECTED` (+ reviewer/time/note); set `accepted = false`; decrement
   the session's `acceptedDropCount` (floor 0).
3. **Shop Points** — if the session had a shop, insert a compensating
   `shop_point_transactions` row: `type = ADJUST`, `status = POSTED`,
   `amount = -perVape` (`perVape = devices.pointsPerVapeOverride ?? shopPointsPerVape`),
   `description: "Drop #<id> rejected: <reason>"`.
4. **Batteries** — depends on session state:
   - **CLAIMED** → insert `battery_transactions` `type = ADJUST`, `amount = -batteriesPerVape`
     for the customer. **The balance may go negative — this is by design** (they may have
     already spent); the wallet UI shows the negative balance.
   - **FINALIZED but unclaimed** (or EXPIRED) → decrement the session's
     `batteriesEstimated` (floor 0) so a later claim pays the corrected amount — no
     customer row exists yet to adjust.
   - **OPEN** → the accepted-count decrement alone is enough; finalize will compute from
     the corrected count.
5. Set `pointsRevoked = true`.

**Approve-after-reject is symmetric.** Approving a drop whose reject revoked value writes
the reverse `ADJUST` entries (positive amounts, `re-approved` descriptions) and clears
`pointsRevoked`, so the ledger never drifts. Plain approve of an `UNREVIEWED` drop is just
a review stamp — no value moves.

### Caveats (accepted trade-offs)
- **Rates are recomputed, not stored.** The per-vape rate finalize actually used is not
  persisted, so the reversal is recomputed from the **current** config + device override.
  If either changed between finalize and reject, the reversal amount may differ from the
  original grant.
- **Float-0 asymmetry.** When a reject clips `batteriesEstimated` at the 0 floor, a later
  approve-after-reject adds the full rate back, which can over-credit relative to the
  pre-reject estimate.
- **Concurrency.** Reject and claim both lock the session row (`SELECT … FOR UPDATE`), so
  a claim either happens first (reject then sees `CLAIMED` and writes the customer ADJUST)
  or after (claim reads the already-corrected estimate). No double-spend, no lost revoke.

The pure math lives in `server/reviewRules.ts` (`planReject` / `planApprove`, unit-tested);
the route in `server/routes/review.ts` applies the returned plan inside the transaction.

---

## Spending

### Customer reward store
`POST /api/customer/redeem { itemId }` checks balance, inserts a `REDEEMED` `battery_transactions` row, and creates a `redemptions` record. The catalog (`store_items` with `category = 'customer'`) is global.

### Shop reward store
Each shop has its own catalog (`shop_rewards`). `POST /api/partner/shops/:id/rewards/:rewardId/redeem` checks shop balance, inserts a `REDEEMED` `shop_point_transactions` row, and records a `shop_reward_redemptions` row. Only members of that shop can redeem.

---

## What's been removed
- The old "verdict" pipeline (AI accept/reject, classifier corrections, appeals) is gone. Drops are accepted on the bin via the IR-beam pattern; photos are stored as proof only.
- VeriScan, brands/subtypes/flavors taxonomy, partner-points-ledger (v1), pair-requests, and PENDING_SETUP no longer exist.
