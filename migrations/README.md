# Migrations

**Production applies the schema with `npm run db:migrate` (committed SQL).
Production NEVER runs `npm run db:push`.**

`push` diffs your TypeScript schema straight against the live database and
rewrites whatever it thinks is out of date — including `DROP TABLE` /
`DROP COLUMN` on anything it does not recognise. That is how the first prod DB
was lost (Replit warned *"You're about to delete bin_requests…"*). Audit **M-12**
called for `drizzle-kit generate` + committed migrations; this directory is it.

Three properties of `push` worth knowing before you ever run it again:

- **Its data-loss prompt is gated on row count.** `drop_table` and
  `alter_table_drop_column` only raise it `if (count > 0)`. An **empty** table or
  column is dropped with `DROP TABLE … CASCADE` and no prompt; dropped indexes,
  unique constraints and views never prompt at all.
- **It is not transactional and it exits 0 on failure.** Statements run one at a
  time with no `BEGIN`/`COMMIT`; a mid-list error is caught, printed, and the
  process still exits 0 — leaving the schema half applied. The only success
  signal is the final `[✓] Changes applied` line.
- **It can propose a truncate that is not a "deletion".** Adding a UNIQUE
  constraint to a non-empty table opens a menu whose second option queues
  `truncate table "…" cascade;`.

`drizzle.config.ts` therefore sets `verbose: true` (print every statement first)
and `strict: true` (always confirm). Both are read only by `push`; `db:migrate`
parses the config with drizzle-kit's `migrateConfig`, which accepts only
`{ dialect, out, migrations }`.

`db:push` is deliberately still in package.json — for **local/dev throwaway
databases only**, where losing the contents costs nothing.

## What's in here

| File | What it is |
|---|---|
| `0000_baseline.sql` | Generated baseline: the whole schema as of the migration switchover, from `shared/schema.ts`. |
| `meta/_journal.json`, `meta/*_snapshot.json` | drizzle's bookkeeping. **Commit these** — `db:migrate` reads the journal, and a migration that is not a journal entry is never executed. |
| `0001_dedup_drops_before_unique.sql` | Hand-written, **DBA-only** (see B3 below). It is *not* a journal entry, so `db:migrate` ignores it — you apply it deliberately, by hand. Its `0001` prefix is historical: a future generated migration will also be numbered `0001_…`, which is harmless (drizzle matches on the journal's `tag`, not the number). |

## Everyday flow — a schema change

1. Edit `shared/schema.ts`.
2. `npx drizzle-kit generate` — writes `migrations/000N_*.sql` + a new snapshot.
3. **Read the generated SQL.** If it contains a `DROP` or a column-type rewrite
   you did not intend, fix the schema and regenerate. This review is the whole
   point of migrations.
4. Commit the `.sql` *and* the `meta/` changes together with the schema change.
5. Deploy → `npm run db:migrate`.

`server/__tests__/dbBaseline.test.ts` fails the build if `shared/schema.ts` and
the newest snapshot disagree, i.e. if someone changed the schema and forgot
step 2. Prod only runs committed migrations, so an ungenerated schema change
would otherwise reach production as a silent 500.

## ONE-TIME: adopting migrations on the existing (pushed) database

The live database already contains these tables — `push` created them — so a
naive `db:migrate` would run `0000_baseline.sql` and die on *"relation already
exists"*. The one-time fix is to record the baseline as **applied without
executing it**:

```bash
npm run db:baseline              # read-only report — changes nothing
npm run db:baseline -- --confirm # writes ONE bookkeeping row
npm run db:migrate               # applies 0001+ only (no-op if there are none)
```

`scripts/db-baseline.ts` inserts a single row into
`drizzle.__drizzle_migrations` (schema/table/DDL taken verbatim from the
installed `drizzle-orm/pg-core/dialect.js`) whose `created_at` is the baseline's
journal `when`. drizzle's migrator applies a migration only when its `when` is
strictly greater than the newest recorded `created_at`, so the baseline is
skipped and everything generated after it still runs. See the header of
`server/dbBaseline.ts` for the exact drizzle sources this was verified against.

It refuses rather than guess. It writes nothing — and exits non-zero under
`--confirm` — when:

- **the database is empty** (none of the app tables): baselining would mark a
  schema created that isn't. Use `npm run db:migrate`, which creates it properly.
- **the database is behind the baseline** — any table, column, enum value or
  **foreign-key constraint** the baseline claims is missing. Marking the baseline
  applied would hide those objects forever, because migrate would never create
  them and push is gone.
- **a later migration's objects are all already present** — e.g. the database
  was closed up with `db:push` after a `0001_*` was committed. Baselining records
  only `0000`, so the next `db:migrate` would re-run `0001` against objects that
  exist and fail with *"already exists"*.
- **`drizzle.__drizzle_migrations` already has rows**: nothing to adopt. (Re-runs
  are a no-op — the script is idempotent.)

It issues no `DROP`, `ALTER`, `DELETE` or `UPDATE` — only
`CREATE SCHEMA IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS` and one guarded
`INSERT`.

**What the match check does and does not prove.** It compares object *names* —
tables, columns, index/unique-constraint names — plus enum labels plus
foreign-key constraint names. It does **not** compare column data types,
`NOT NULL`, defaults, primary keys or check constraints; those are not even read
from the live database. So a clean verdict means *"every object the baseline
names exists"*, not *"this database is what `0000_baseline.sql` would have
built"*. The script prints that caveat under **Verdict** too.

The report also lists every table/column that exists in the database but **not**
in `shared/schema.ts` — that list is exactly what `drizzle-kit push` would
**drop**. Read it before you ever answer a push prompt. Note push only *asks*
about a table or column that **contains rows**; an empty one is dropped with no
prompt at all, so the report is the real gate, not the prompt.

Two blind spots in that list, both covered by `verbose: true` in
`drizzle.config.ts` (which makes push print every statement before running any of
them): the report tracks `extraTables`/`extraColumns` but has no
`extraIndexes`, so an index or unique constraint the live DB has and
`shared/schema.ts` does not will not appear in it; and dropped views are not
tracked either.

### If the report says the database is behind

Expected on the first run, because the live DB predates the newest tables.
**Take a backup or Replit restore point first** — the fix below is the one step
in this whole procedure that can destroy data, and `db:push` is neither
transactional nor reliably interactive. Then close the gap and re-run the report:

- **the additive way** — one last `npm run db:push` **after** reading the
  "would be dropped" list above. Answer *no* to any drop you did not expect, and
  stop if it proposes dropping a table that holds data.
  **Only while `meta/_journal.json` holds a single entry (the baseline).** Once a
  generated `0001_*` is committed, `db:push` syncs the database to
  `shared/schema.ts` — i.e. past the baseline — while `db:baseline` still records
  only `0000`; the next `db:migrate` then re-runs `0001` against objects that
  already exist and fails with *"already exists"*. In that case use the surgical
  route. (`db:baseline` now detects this and blocks, but do not rely on that:
  read the journal.)
- **the surgical way** — apply the missing objects by hand with `psql`; their
  exact DDL is in `0000_baseline.sql`. Copy the whole `CREATE TABLE` body
  **plus** that table's `CREATE INDEX` lines **plus** its
  `ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY` lines from the bottom of the file.
  A table created without its foreign keys and indexes still reports as
  *present*, and nothing will ever add them afterwards.

### Indexes / unique constraints the baseline can't create

Because the baseline's SQL is skipped, an index the live DB never had is *not*
created by baselining. The script lists these as **warnings — they do not block
the baseline**, so acting on them is on you.

Notably `drops_session_sequence_uniq` (B3, below). **Deal with it BEFORE the
one-time `db:push`, not after the baseline:** run `npm run db:dedup-drops` first,
then apply `0001_dedup_drops_before_unique.sql` by hand — that file is precisely
the dedup + counter recompute + `ADD CONSTRAINT`, in one transaction.

Two reasons the order matters. (1) It is the B3 required order below: dedup
first, constraint second — `db:push` adds the constraint and knows nothing about
dedup, so on a DB with historical duplicates the `ADD CONSTRAINT` fails with a
duplicate-key error, and push neither rolls back nor exits non-zero. (2) While
the constraint is absent and `drops` is non-empty, push's diff contains a
`create_unique_constraint`, and drizzle-kit answers that with an unconditional
menu — *"Do you want to truncate drops table?"* → `[No, add the constraint
without truncating the table | Yes, truncate the table]`. Creating the constraint
beforehand removes that statement from the diff, and with it the menu.

---

## Audit B3 — deduplicate `drops` before the unique constraint

`shared/schema.ts` declares `unique(session_id, sequence)` on `drops`
(`drops_session_sequence_uniq`). It stops future firmware-retry double-inserts,
but **it cannot be created while historical duplicate rows exist** — the very bug
it fixes is what produced those rows on any already-shipped bin. `CREATE UNIQUE
INDEX` would fail with a duplicate-key error and block the deploy. The same
double-insert also over-incremented `detected_drop_count` / `accepted_drop_count`
and the finalize-derived `batteries_estimated` / `shop_points_awarded`.

### Pre-deploy guard (must return **zero rows** before the constraint is added)

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
2. **Then add the constraint** — on a fresh database it comes from
   `0000_baseline.sql` via `npm run db:migrate`; on the live (pushed) database,
   apply `0001_dedup_drops_before_unique.sql` by hand (see above). On a local
   throwaway DB, `npm run db:push` is fine.

   **Never let `db:push` be the thing that adds this constraint on a populated
   database.** It has no dedup step, it is not transactional, and it exits 0 when
   the `ADD CONSTRAINT` fails — so the failure is silent. And before the
   constraint exists, the same push offers to `truncate table "drops" cascade`.
   On the live database that means: do step 1, apply the `.sql` file, and only
   then run the one-time push (RUNBOOK §1 step 4).

**`npm run db:dedup-drops` reads full `devices` / `drop_sessions` rows through
`shared/schema.ts`**, so on a database that is still behind the code it can fail
with `column "…" does not exist` when there *are* duplicates to fix. That failure
is safe — it is one transaction and nothing is committed. Either close the schema
gap first and re-run it, or, if the guard query above returns zero rows, skip
straight to the `.sql` file (pure SQL, no schema coupling, safe on a
behind-the-code database).

### DBA-only SQL equivalent

`0001_dedup_drops_before_unique.sql` is the committed, self-contained equivalent
for the **dedup + counters + constraint** (atomic, transactional) when applying
SQL directly. Run `npm run db:dedup-drops` first for the rate-dependent award +
ledger reconciliation, which the pure-SQL file cannot do without per-session
reward rates.
