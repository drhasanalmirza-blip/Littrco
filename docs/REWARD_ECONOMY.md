# LITTR Reward Economy

Two currencies live in two separate ledgers:

| Currency      | Who earns it | Where it lives                | How it's spent                                  |
|---------------|--------------|-------------------------------|-------------------------------------------------|
| **Batteries** | Customers    | `battery_transactions`        | Customer reward store (`/app/store`)            |
| **Points**    | Host shops   | `shop_point_transactions`     | Per-shop reward catalog the partner manages     |

Balances are **derived**, never stored as counters. The "balance" is always:
```
SUM(amount WHERE type = 'EARNED' AND status = 'POSTED')
  - SUM(amount WHERE type = 'REDEEMED' AND status = 'POSTED')
```

---

## When the ledgers move

Both ledgers are written from `POST /api/device/drop-sessions/:id/finalize`:

1. **Shop Points** — inserted immediately, no scan required. One row per finalized session: `amount = acceptedDropCount × shopPointsPerVape` (default 1). The receipt cannot un-do this credit; partners always get paid for accepted drops.

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

## Spending

### Customer reward store
`POST /api/customer/redeem { itemId }` checks balance, inserts a `REDEEMED` `battery_transactions` row, and creates a `redemptions` record. The catalog (`store_items` with `category = 'customer'`) is global.

### Shop reward store
Each shop has its own catalog (`shop_rewards`). `POST /api/partner/shops/:id/rewards/:rewardId/redeem` checks shop balance, inserts a `REDEEMED` `shop_point_transactions` row, and records a `shop_reward_redemptions` row. Only members of that shop can redeem.

---

## What's been removed
- The old "verdict" pipeline (AI accept/reject, classifier corrections, appeals) is gone. Drops are accepted on the bin via the IR-beam pattern; photos are stored as proof only.
- VeriScan, brands/subtypes/flavors taxonomy, partner-points-ledger (v1), pair-requests, and PENDING_SETUP no longer exist.
