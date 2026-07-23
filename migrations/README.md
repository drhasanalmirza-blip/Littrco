# Migrations & pre-deploy remediation

The schema is currently applied with `drizzle-kit push` (`npm run db:push`).
Audit **M-12** recommends moving to `drizzle-kit generate` + committed migrations
+ a migrate step for populated prod DBs; this directory holds the committed SQL
that must not be left to `push` alone.

## Audit B3 — deduplicate `drops` before the new unique constraint

`shared/schema.ts` adds `unique(session_id, sequence)` on `drops`
(`drops_session_sequence_uniq`). It stops future firmware-retry double-inserts,
but **it cannot be created while historical duplicate rows exist** — the very bug
it fixes is what produced those rows on any already-shipped bin. `CREATE UNIQUE
INDEX` would fail with a duplicate-key error and block the deploy. The same
double-insert also over-incremented `detected_drop_count` / `accepted_drop_count`
and the finalize-derived `batteries_estimated` / `shop_points_awarded`.

### Pre-deploy guard (must return **zero rows** before pushing the constraint)

```sql
SELECT session_id, sequence, COUNT(*)
FROM drops
GROUP BY session_id, sequence
HAVING COUNT(*) > 1;
```

### Required order

1. **`npm run db:dedup-drops`** — the authoritative, rate-aware remediation
   (`scripts/dedup-drops.ts`). In one transaction it dedups rows (keep `MIN(id)`),
   recomputes the session counters, recomputes the finalize-derived awards for
   `FINALIZED`/`CLAIMED` sessions using the same rate precedence as the finalize
   route (device override ?? shop cfg ?? default), writes a compensating signed
   `ADJUST` shop-point ledger row for any delta (so each shop's POSTED balance
   stays equal to the corrected column), and asserts the guard above returns zero
   rows — aborting (rolling back) otherwise. It reports any `CLAIMED` session whose
   `batteries_estimated` changed for a **manual** customer-battery review; it does
   not claw back a claimed customer's batteries automatically.
2. **`npm run db:push`** — applies the schema, including the now-safe unique
   constraint.

### DBA-only SQL equivalent

`0001_dedup_drops_before_unique.sql` is the committed, self-contained equivalent
for the **dedup + counters + constraint** (atomic, transactional) when applying
SQL directly instead of `push`. Run `npm run db:dedup-drops` first for the
rate-dependent award + ledger reconciliation, which the pure-SQL file cannot do
without per-session reward rates.
