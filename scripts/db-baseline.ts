// ONE-TIME baseline step: adopt committed migrations on a database that was
// built with `drizzle-kit push`.
//
//   npm run db:baseline              # read-only report (safe, changes nothing)
//   npm run db:baseline -- --confirm # records the baseline migration as applied
//
// WHY: `npm run db:migrate` (drizzle-kit migrate) runs migrations/0000_*.sql,
// which is a full `CREATE TABLE ...` of the whole schema. On the live database —
// whose tables `push` already created — that fails with "relation already
// exists". The fix is not to weaken the migration: it is to tell drizzle that
// migration 0000 is ALREADY APPLIED, by inserting one row into
// drizzle.__drizzle_migrations. Then `db:migrate` starts at 0001 and every
// future deploy is a plain, reviewable, non-destructive `db:migrate`.
//
// WHAT THIS SCRIPT WILL NEVER DO: it issues no DROP, no ALTER, no DELETE, no
// UPDATE — only `CREATE SCHEMA IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`
// (drizzle's own bookkeeping table, verbatim) and one INSERT that is skipped if
// the table is not empty. It is idempotent: run it twice and the second run
// reports "already under migration control" and writes nothing.
//
// AND IT REFUSES TO LIE. Marking 0000 applied claims the database already
// contains everything 0000 creates. So before writing anything it compares the
// live database against the baseline snapshot and REFUSES when:
//   · the database is empty / has none of the tables  → use `db:migrate` instead
//   · the database is BEHIND the baseline (a missing table, column, enum value
//     or FOREIGN KEY) → baselining would hide those objects forever, since
//     migrate would never create them
//   · a LATER migration's objects are all already present → migrate would re-run
//     it and die on "already exists"
//   · drizzle.__drizzle_migrations already holds rows → nothing to adopt
// It also reports every table/column that exists in the DB but NOT in
// shared/schema.ts — that list is exactly what `drizzle-kit push` would DROP,
// which is how the previous production database was lost. Note push only PROMPTS
// for a table/column that contains rows (drizzle-kit's `count > 0` guard); an
// empty one goes with no prompt at all, so this report is the real gate.
//
// WHAT IT CANNOT SEE: column data types, NOT NULL, defaults, primary keys and
// CHECK constraints are not read from the live database at all. See the SCOPE
// note printed under Verdict, and the header of server/dbBaseline.ts.
//
// The migrations-table name, its DDL, the hash scheme and the created_at
// watermark rule were read out of the installed drizzle, not guessed — see the
// header of server/dbBaseline.ts for the file-by-file references.

import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CREATE_MIGRATIONS_SCHEMA_SQL,
  CREATE_MIGRATIONS_TABLE_SQL,
  MIGRATIONS_TABLE_FQN,
  decideBaseline,
  diffSchema,
  expectedSchema,
  readBaselineMigration,
  readJournal,
  readLiveForeignKeys,
  readLiveSchema,
  readMigrationRows,
  snapshotForeignKeys,
  snapshotPathForTag,
  snapshotSchema,
  type QueryFn,
} from "../server/dbBaseline";

const MIGRATIONS_FOLDER = fileURLToPath(new URL("../migrations", import.meta.url));

function log(line = "") {
  console.log(line);
}

function section(title: string) {
  log("");
  log(title);
  log("-".repeat(title.length));
}

function list(items: string[], indent = "  - ") {
  for (const item of items) log(`${indent}${item}`);
}

async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes("--confirm");
  const unknown = args.filter((a) => a !== "--confirm");
  if (unknown.length > 0) {
    log(`unknown argument(s): ${unknown.join(" ")}`);
    log("usage: npm run db:baseline [-- --confirm]");
    process.exit(2);
  }

  log("=".repeat(78));
  log("  ONE-TIME DATABASE BASELINE — run this once, on a database that was");
  log("  created with `db:push`, before you ever run `db:migrate` against it.");
  log(confirm ? "  MODE: --confirm (will write ONE bookkeeping row)" : "  MODE: read-only report (nothing is written)");
  log("=".repeat(78));

  const journal = readJournal(MIGRATIONS_FOLDER);
  const baseline = readBaselineMigration(MIGRATIONS_FOLDER);
  // Everything generated AFTER the baseline. While this is empty (today), the
  // baseline and shared/schema.ts describe the same state, so "close the gap
  // with one last db:push" is sound advice. The moment a 0001_* exists it stops
  // being sound — push syncs to shared/schema.ts, i.e. PAST the baseline, while
  // this script still records only 0000. Several branches below depend on that.
  const laterEntries = journal.entries.filter((e) => e.idx > 0);
  log("");
  log(`migrations folder : ${MIGRATIONS_FOLDER}`);
  log(`journal entries   : ${journal.entries.map((e) => e.tag).join(", ")}`);
  log(`baseline          : ${baseline.tag}.sql`);
  log(`  created_at      : ${baseline.when}  (the watermark migrate compares against)`);
  log(`  sha256          : ${baseline.hash}`);

  const { pool } = await import("../server/db");
  const query: QueryFn = async (sql, params) => (await pool.query(sql, params)).rows;

  try {
    const live = await readLiveSchema(query);
    const rows = await readMigrationRows(query);

    // Blockers are judged against what the BASELINE claims to create (its own
    // snapshot) — not against shared/schema.ts, because any migration generated
    // after the baseline is legitimately still un-applied at this point.
    const baselineSnapshot = snapshotSchema(snapshotPathForTag(MIGRATIONS_FOLDER, 0));
    const drift = diffSchema(baselineSnapshot, live);
    // `push` diffs against shared/schema.ts, so the "would be dropped" warning does too.
    const pushDrift = diffSchema(expectedSchema(), live);

    // FOREIGN KEYS. diffSchema compares object NAMES only, and FKs are not in
    // SchemaSnapshot at all — so without this a table `push` built (no FKs) and
    // a table 0000_baseline.sql built (45 of them) certify as identical. The
    // baseline's SQL is never executed, so a missing FK is missing forever.
    const liveFks = await readLiveForeignKeys(query);
    const baselineFks = snapshotForeignKeys(snapshotPathForTag(MIGRATIONS_FOLDER, 0));
    const missingForeignKeys = baselineFks.filter((fk) => !liveFks.includes(fk));

    // Later migrations whose objects the database ALREADY has. `migrate` would
    // re-run them (only 0000 gets recorded) and die on "already exists" — the
    // classic aftermath of closing the gap with `db:push` once a 0001 exists.
    const satisfiedLaterMigrations = laterEntries
      .filter((e) => {
        // Snapshots are CUMULATIVE, so this is "state after e" both times.
        const after = snapshotSchema(snapshotPathForTag(MIGRATIONS_FOLDER, e.idx));
        // What e adds on top of the baseline. If that is nothing this check can
        // see (a data-only migration, a rename, a check constraint), say nothing
        // rather than block on a guess.
        const adds = diffSchema(after, baselineSnapshot);
        const addsSomethingVisible =
          adds.missingTables.length > 0 ||
          adds.missingColumns.length > 0 ||
          adds.missingEnumValues.length > 0 ||
          adds.missingIndexes.length > 0;
        if (!addsSomethingVisible) return false;
        // ...and the live database already has every one of those objects.
        const ahead = diffSchema(after, live);
        return (
          ahead.missingTables.length === 0 &&
          ahead.missingColumns.length === 0 &&
          ahead.missingEnumValues.length === 0 &&
          ahead.missingIndexes.length === 0
        );
      })
      .map((e) => e.tag);

    const decision = decideBaseline({
      drift,
      pushDrift,
      missingForeignKeys,
      satisfiedLaterMigrations,
      rows,
      baseline,
    });

    section("Database");
    log(`  application tables present : ${drift.tablesPresent} / ${drift.tablesExpected}`);
    log(`  baseline foreign keys      : ${baselineFks.length - missingForeignKeys.length} / ${baselineFks.length}`);
    log(`  ${MIGRATIONS_TABLE_FQN} rows : ${rows.length}`);

    if (decision.blockers.length > 0) {
      section("BLOCKERS");
      list(decision.blockers);
    }
    if (decision.warnings.length > 0) {
      section("Warnings (not blocking — but they are still real differences)");
      list(decision.warnings);
    }

    // Two DIFFERENT "objects only the database has" sets, and conflating them
    // hides the failure this script exists to catch. pushDrift is measured
    // against shared/schema.ts (what push would delete); drift is measured
    // against the baseline snapshot, so anything extra there is a sign the DB is
    // AHEAD of the baseline — i.e. someone already pushed a later schema.
    const aheadTables = drift.extraTables.filter((t) => !pushDrift.extraTables.includes(t));
    const aheadColumns = drift.extraColumns.filter((c) => !pushDrift.extraColumns.includes(c));
    if (aheadTables.length > 0 || aheadColumns.length > 0) {
      section("Ahead of the baseline (in the DB and in shared/schema.ts, not in the baseline)");
      log("  These exist because the database was synced to a schema NEWER than the baseline.");
      log("  Baselining still records only " + baseline.tag + ", so `db:migrate` will re-run the");
      log("  migration that creates them and fail with \"already exists\".");
      if (aheadTables.length > 0) list([`table(s): ${aheadTables.join(", ")}`]);
      if (aheadColumns.length > 0) list([`column(s): ${aheadColumns.join(", ")}`]);
    }

    section("Verdict");
    log(`  ${decision.action.toUpperCase()}: ${decision.headline}`);
    log("");
    log("  SCOPE: this compares object NAMES — tables, columns, index/unique-constraint");
    log("  names — plus enum labels and FOREIGN KEY constraint names. Column data types,");
    log("  NOT NULL, defaults, primary keys and CHECK constraints are NOT verified. A");
    log("  clean verdict means \"every object the baseline names exists\", not \"this database");
    log("  is what 0000_baseline.sql would have built\".");

    if (!decision.safeToInsert) {
      log("");
      if (decision.action === "already-baselined") {
        log("  Nothing to do. Deploys from here on are just:");
        log("    npm run db:migrate");
      } else if (decision.action === "fresh-database") {
        log("  Do NOT baseline this database. Create the schema properly with:");
        log("    npm run db:migrate");
      } else if (decision.action === "drift") {
        log("  The database is missing objects the baseline claims to create, so it is not");
        log("  ready to be baselined. Close the gap first, then re-run this script:");
        log("");
        if (laterEntries.length === 0) {
          log("    a) review the 'would be dropped' warnings above — that is what `push` will");
          log("       delete. Note it only PROMPTS for a table/column that contains rows; an");
          log("       empty one is dropped silently, so that list is the real gate. If it is");
          log("       empty or you accept it, the simplest way to close the gap is ONE last");
          log("       `npm run db:push` (answer NO to any drop you did not expect, and stop if");
          log("       it proposes dropping a table with data).");
          log("       Back the database up first — push is not transactional.");
        } else {
          const last = laterEntries[laterEntries.length - 1].tag;
          const all = laterEntries.map((e) => e.tag).join(", ");
          log("    a) do NOT use `npm run db:push` here. It syncs this database to");
          log(`       shared/schema.ts, which is migration ${last}, not the baseline.`);
          log(`       Baselining would still record only ${baseline.tag}, and the following`);
          log(`       \`db:migrate\` would re-run ${all} against objects that already exist and`);
          log("       fail with \"already exists\".");
        }
        log("    b) apply the missing objects by hand: their exact DDL is in");
        log(`       migrations/${baseline.tag}.sql — the \`CREATE TABLE\` bodies (columns AND`);
        log("       their types/NOT NULL/DEFAULT clauses), the `CREATE INDEX` statements, and");
        log("       the `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY` section at the bottom.");
        log("       A table created without its foreign keys and indexes still reports as");
        log("       present here, and nothing will ever add them afterwards.");
        log("");
        log("  Then: npm run db:baseline   (report)   ->   npm run db:baseline -- --confirm");
      } else {
        log("  Inspect the migrations table by hand before continuing.");
      }
      log("");
      // Read-only mode is a report, so it always exits 0. --confirm exits
      // non-zero when it REFUSED — except for an already-baselined database,
      // where "nothing to do" is the idempotent success case.
      process.exit(confirm && decision.action !== "already-baselined" ? 1 : 0);
    }

    if (!confirm) {
      log("");
      log("  Nothing was written (read-only). To record the baseline as applied, run:");
      log("    npm run db:baseline -- --confirm");
      log("  and then, from now on and forever, deploy schema changes with:");
      log("    npm run db:migrate");
      log("");
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(CREATE_MIGRATIONS_SCHEMA_SQL);
      await client.query(CREATE_MIGRATIONS_TABLE_SQL);
      // Skipped (0 rows) if anything is already recorded — never a second baseline.
      const res = await client.query(
        `insert into ${MIGRATIONS_TABLE_FQN} ("hash", "created_at")
         select $1::text, $2::bigint
          where not exists (select 1 from ${MIGRATIONS_TABLE_FQN})`,
        [baseline.hash, String(baseline.when)],
      );
      await client.query("COMMIT");

      section("Result");
      if (res.rowCount === 1) {
        log(`  recorded ${baseline.tag} as applied (created_at=${baseline.when}).`);
        log(`  NO SQL from ${baseline.tag}.sql was executed — your data is untouched.`);
      } else {
        log(`  ${MIGRATIONS_TABLE_FQN} was not empty — nothing inserted (already baselined).`);
      }
      log("");
      if (laterEntries.length === 0) {
        log("  Next: npm run db:migrate   (nothing after the baseline yet — a no-op today)");
      } else {
        log(`  Next: npm run db:migrate   — this will EXECUTE: ${laterEntries.map((e) => e.tag).join(", ")}`);
        log("  Read those .sql files before you run it.");
      }
      log("  From now on prod NEVER runs `db:push` again.");
      log("");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("");
  console.error("[db-baseline] FAILED (nothing was written):", err);
  process.exit(1);
});
