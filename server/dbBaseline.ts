// Adoption logic for moving an ALREADY-POPULATED database off `drizzle-kit push`
// and onto committed migrations (`drizzle-kit migrate`).
//
// NO server/db import — db.ts throws without DATABASE_URL, and this module must stay
// importable from unit tests (server/__tests__/dbBaseline.test.ts). The DB-touching
// one-time step lives in scripts/db-baseline.ts; everything here is deterministic
// file-in / data-in → data-out.
//
// ─────────────────────────────────────────────────────────────────────────────
// VERIFIED AGAINST THE INSTALLED DRIZZLE (read, not guessed) — drizzle-kit 0.31.4
// + drizzle-orm 0.39.3. `npm run db:migrate` is `drizzle-kit migrate`, and with
// `pg` present drizzle-kit delegates to drizzle-orm's own migrator
// (node_modules/drizzle-kit/bin.cjs → preparePostgresDB → "drizzle-orm/node-postgres/migrator").
// So the on-disk + in-DB contract is exactly:
//
//   node_modules/drizzle-orm/migrator.js — readMigrationFiles()
//     · migrations are enumerated from migrations/meta/_journal.json ENTRIES; a
//       .sql file that is not a journal entry is NEVER read (which is why the
//       hand-written 0001_dedup_drops_before_unique.sql is inert here).
//     · hash = sha256 hex of the RAW .sql file contents — the whole file, taken
//       before the `--> statement-breakpoint` split.
//     · folderMillis = that journal entry's `when`.
//
//   node_modules/drizzle-orm/pg-core/dialect.js — PgDialect.migrate()
//     · CREATE SCHEMA IF NOT EXISTS "drizzle"
//     · CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations"
//         (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)
//     · reads ONE row: `select id, hash, created_at ... order by created_at desc limit 1`
//     · applies every migration whose `when` is STRICTLY GREATER than that row's
//       created_at:  `if (!last || Number(last.created_at) < migration.folderMillis)`
//
// Two consequences the baseline step rests on:
//   1. Inserting ONE row with created_at = the baseline entry's `when` makes
//      migrate skip the baseline and apply everything generated after it. That is
//      the whole trick: none of the baseline's CREATE TABLEs are executed, which
//      is what a DB that `push` already built needs.
//   2. `hash` is stored but NEVER compared by the migrator. We still write the
//      real hash (drizzle Studio / forensics), computed from the file at run time
//      — so a CRLF-vs-LF checkout difference can never desync anything.
//
// The other half of "safe" is refusing to lie: marking the baseline applied on a
// database that does NOT actually have the baseline's tables/columns would hide
// them forever (migrate would never create them, push is no longer being run).
// Hence expectedSchema/snapshotSchema/diffSchema/decideBaseline below.
//
// SCOPE OF THAT CHECK — say it out loud so nobody reads more into a green
// verdict than it carries. Compared: table names, column names, enum labels,
// index/unique-constraint names, and FOREIGN KEY constraint names
// (snapshotForeignKeys vs readLiveForeignKeys). NOT compared: column data types,
// NOT NULL, defaults, primary keys, check constraints — `LIVE_COLUMNS_SQL` does
// not read them. A table `push` built and a table `0000_baseline.sql` would have
// built are indistinguishable here as long as the names line up.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { is } from "drizzle-orm";
import { PgTable, getTableConfig, isPgEnum } from "drizzle-orm/pg-core";
import * as schema from "@shared/schema";

/** Schema + table drizzle records applied migrations in (PgDialect.migrate defaults). */
export const MIGRATIONS_SCHEMA = "drizzle";
export const MIGRATIONS_TABLE = "__drizzle_migrations";
export const MIGRATIONS_TABLE_FQN = `"${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}"`;

/** Same DDL PgDialect.migrate() issues, so drizzle's own IF NOT EXISTS is a no-op. */
export const CREATE_MIGRATIONS_SCHEMA_SQL = `CREATE SCHEMA IF NOT EXISTS "${MIGRATIONS_SCHEMA}"`;
export const CREATE_MIGRATIONS_TABLE_SQL =
  `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE_FQN} (\n` +
  `\tid SERIAL PRIMARY KEY,\n` +
  `\thash text NOT NULL,\n` +
  `\tcreated_at bigint\n` +
  `)`;

// ─── migrations/meta/_journal.json ───────────────────────────────────────────

export interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

export interface Journal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

export function readJournal(migrationsFolder: string): Journal {
  const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
  if (!fs.existsSync(journalPath)) {
    throw new Error(
      `no migrations journal at ${journalPath} — run \`npx drizzle-kit generate\` before baselining`,
    );
  }
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as Journal;
  if (!Array.isArray(journal.entries) || journal.entries.length === 0) {
    throw new Error(`${journalPath} has no entries — nothing to baseline`);
  }
  return journal;
}

/**
 * sha256 of the raw .sql file — byte-for-byte the same computation as
 * drizzle-orm's readMigrationFiles() (node_modules/drizzle-orm/migrator.js).
 */
export function migrationHash(migrationsFolder: string, tag: string): string {
  const contents = fs.readFileSync(path.join(migrationsFolder, `${tag}.sql`)).toString();
  return crypto.createHash("sha256").update(contents).digest("hex");
}

export interface BaselineMigration {
  tag: string;
  /** journal `when` — becomes created_at, the watermark migrate compares against. */
  when: number;
  hash: string;
}

/** The idx-0 journal entry: the one migration a pushed database already "has". */
export function readBaselineMigration(migrationsFolder: string): BaselineMigration {
  const journal = readJournal(migrationsFolder);
  const entry = journal.entries.find((e) => e.idx === 0);
  if (!entry) {
    throw new Error("journal has no idx 0 entry — cannot identify the baseline migration");
  }
  return { tag: entry.tag, when: entry.when, hash: migrationHash(migrationsFolder, entry.tag) };
}

/** Newest cumulative snapshot drizzle-kit wrote (same lexicographic sort drizzle uses). */
export function latestSnapshotPath(migrationsFolder: string): string {
  const metaDir = path.join(migrationsFolder, "meta");
  const snapshots = fs
    .readdirSync(metaDir)
    .filter((f) => f.endsWith("_snapshot.json"))
    .sort();
  const last = snapshots[snapshots.length - 1];
  if (!last) throw new Error(`no *_snapshot.json in ${metaDir}`);
  return path.join(metaDir, last);
}

export function snapshotPathForTag(migrationsFolder: string, idx: number): string {
  return path.join(migrationsFolder, "meta", `${String(idx).padStart(4, "0")}_snapshot.json`);
}

// ─── comparable schema shapes ────────────────────────────────────────────────

/** Table→columns, enum→labels and index/unique-constraint names, all public-schema. */
export interface SchemaSnapshot {
  tables: Record<string, string[]>;
  enums: Record<string, string[]>;
  indexes: string[];
}

/** What shared/schema.ts declares — i.e. what `drizzle-kit push` diffs against. */
export function expectedSchema(): SchemaSnapshot {
  const tables: Record<string, string[]> = {};
  const enums: Record<string, string[]> = {};
  const indexes: string[] = [];

  for (const value of Object.values(schema)) {
    if (is(value, PgTable)) {
      const cfg = getTableConfig(value);
      if (cfg.schema && cfg.schema !== "public") continue; // public schema only
      tables[cfg.name] = cfg.columns.map((c) => c.name).sort();
      for (const idx of cfg.indexes) {
        if (idx.config.name) indexes.push(idx.config.name);
      }
      for (const uq of cfg.uniqueConstraints) {
        // A UNIQUE constraint is backed by an index of the same name in Postgres.
        if (uq.name) indexes.push(uq.name);
      }
    } else if (isPgEnum(value)) {
      if (value.schema && value.schema !== "public") continue;
      enums[value.enumName] = [...value.enumValues];
    }
  }

  return { tables, enums, indexes: indexes.sort() };
}

interface RawSnapshotTable {
  name: string;
  schema?: string;
  columns?: Record<string, { name?: string }>;
  indexes?: Record<string, unknown>;
  uniqueConstraints?: Record<string, unknown>;
  foreignKeys?: Record<string, unknown>;
}
interface RawSnapshotEnum {
  name: string;
  schema?: string;
  values?: string[];
}
interface RawSnapshot {
  tables?: Record<string, RawSnapshotTable>;
  enums?: Record<string, RawSnapshotEnum>;
}

/**
 * The cumulative state a drizzle-kit snapshot describes — i.e. exactly what a
 * migration claims the database looks like once it has been applied.
 */
export function snapshotSchema(snapshotPath: string): SchemaSnapshot {
  const raw = JSON.parse(fs.readFileSync(snapshotPath, "utf8")) as RawSnapshot;
  const tables: Record<string, string[]> = {};
  const enums: Record<string, string[]> = {};
  const indexes: string[] = [];

  for (const t of Object.values(raw.tables ?? {})) {
    if (t.schema && t.schema !== "public") continue;
    tables[t.name] = Object.keys(t.columns ?? {}).sort();
    indexes.push(...Object.keys(t.indexes ?? {}), ...Object.keys(t.uniqueConstraints ?? {}));
  }
  for (const e of Object.values(raw.enums ?? {})) {
    if (e.schema && e.schema !== "public") continue;
    enums[e.name] = [...(e.values ?? [])];
  }

  return { tables, enums, indexes: indexes.sort() };
}

/**
 * FOREIGN KEY constraint names a snapshot claims — the keys of each table's
 * `foreignKeys` object. Kept OUT of `SchemaSnapshot` on purpose: that shape is
 * what `diffSchema` compares and what the unit tests pin, and FKs are compared
 * on their own (see `readLiveForeignKeys`) so neither shape has to change.
 *
 * Why they matter: `0000_baseline.sql` ends with 45 `ALTER TABLE … ADD
 * CONSTRAINT … FOREIGN KEY` statements. Baselining marks that file applied
 * without executing it, so an FK the live database never had is never created —
 * and `diffSchema` (names of tables/columns/enums/indexes only) cannot see the
 * difference between a table `push` built and one the baseline SQL built.
 */
export function snapshotForeignKeys(snapshotPath: string): string[] {
  const raw = JSON.parse(fs.readFileSync(snapshotPath, "utf8")) as RawSnapshot;
  const names: string[] = [];
  for (const t of Object.values(raw.tables ?? {})) {
    if (t.schema && t.schema !== "public") continue;
    names.push(...Object.keys(t.foreignKeys ?? {}));
  }
  return names.sort();
}

// ─── drift ───────────────────────────────────────────────────────────────────

export interface SchemaDrift {
  /** In `expected`, absent from the database — a baseline here would hide them. */
  missingTables: string[];
  missingColumns: string[]; // "table.column"
  missingEnumValues: string[]; // "enum_type:LABEL"
  missingIndexes: string[];
  /** In the database, absent from `expected` — what `drizzle-kit push` wants to DROP. */
  extraTables: string[];
  extraColumns: string[]; // "table.column"
  tablesExpected: number;
  tablesPresent: number;
}

/**
 * WHAT THIS COMPARES — and, just as load-bearing, what it does NOT.
 *
 * Compared: table NAMES, column NAMES, enum labels, index/unique-constraint
 * NAMES. That is everything `SchemaSnapshot` carries.
 *
 * NOT compared: column data types, NOT NULL, defaults, primary keys, check
 * constraints. `LIVE_COLUMNS_SQL` does not even read them. FOREIGN KEYS are not
 * in here either — they are compared separately by the caller via
 * `readLiveForeignKeys()` / `snapshotForeignKeys()`, and a missing one IS a
 * blocker (see `decideBaseline`).
 *
 * So a clean drift means "every object the baseline names exists", NOT "the
 * database is what the baseline SQL would have built". Anything reported to an
 * operator off the back of this must say so.
 */
export function diffSchema(expected: SchemaSnapshot, actual: SchemaSnapshot): SchemaDrift {
  const missingTables: string[] = [];
  const missingColumns: string[] = [];
  const missingEnumValues: string[] = [];
  const extraTables: string[] = [];
  const extraColumns: string[] = [];
  let tablesPresent = 0;

  for (const [table, columns] of Object.entries(expected.tables)) {
    const actualColumns = actual.tables[table];
    if (!actualColumns) {
      missingTables.push(table);
      continue;
    }
    tablesPresent++;
    for (const column of columns) {
      if (!actualColumns.includes(column)) missingColumns.push(`${table}.${column}`);
    }
    for (const column of actualColumns) {
      if (!columns.includes(column)) extraColumns.push(`${table}.${column}`);
    }
  }

  for (const table of Object.keys(actual.tables)) {
    if (!expected.tables[table]) extraTables.push(table);
  }

  for (const [name, values] of Object.entries(expected.enums)) {
    const actualValues = actual.enums[name];
    if (!actualValues) {
      // Usually accompanies a missing table (both are created by the baseline);
      // reported anyway — a silently absent type breaks INSERTs at run time.
      missingEnumValues.push(`${name}:<type missing>`);
      continue;
    }
    for (const v of values) {
      if (!actualValues.includes(v)) missingEnumValues.push(`${name}:${v}`);
    }
  }

  const missingIndexes = expected.indexes.filter((i) => !actual.indexes.includes(i));

  return {
    missingTables: missingTables.sort(),
    missingColumns: missingColumns.sort(),
    missingEnumValues: missingEnumValues.sort(),
    missingIndexes,
    extraTables: extraTables.sort(),
    extraColumns: extraColumns.sort(),
    tablesExpected: Object.keys(expected.tables).length,
    tablesPresent,
  };
}

// ─── reading the live database ───────────────────────────────────────────────
// Injected query function, so these stay unit-testable and this module keeps its
// no-connection property.

export type QueryFn = <T>(sql: string, params?: unknown[]) => Promise<T[]>;

/** Base tables only — views and other relkinds are not what a migration creates. */
export const LIVE_COLUMNS_SQL = `select c.table_name, c.column_name
   from information_schema.columns c
   join information_schema.tables t
     on t.table_schema = c.table_schema and t.table_name = c.table_name
  where c.table_schema = 'public' and t.table_type = 'BASE TABLE'`;

export const LIVE_ENUMS_SQL = `select t.typname as name, e.enumlabel as label
   from pg_type t
   join pg_enum e on e.enumtypid = t.oid
   join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
  order by t.typname, e.enumsortorder`;

/** A UNIQUE constraint is backed by an index of the same name, so this covers both. */
export const LIVE_INDEXES_SQL = `select indexname from pg_indexes where schemaname = 'public'`;

/**
 * FOREIGN KEY constraint names in public. `contype = 'f'` is the FK relkind;
 * pg_catalog rather than information_schema because the latter only shows
 * constraints on tables the current role owns.
 */
export const LIVE_FKS_SQL = `select c.conname
   from pg_constraint c
   join pg_namespace n on n.oid = c.connamespace
  where n.nspname = 'public' and c.contype = 'f'`;

/** Existence probe that cannot error on a missing schema (unlike to_regclass). */
export const MIGRATIONS_TABLE_EXISTS_SQL = `select exists (
   select 1 from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = $1 and c.relname = $2 and c.relkind in ('r', 'p')
 ) as present`;

export const MIGRATION_ROWS_SQL = `select hash, created_at from ${MIGRATIONS_TABLE_FQN} order by created_at asc`;

/** The live database, shaped like a drizzle snapshot so diffSchema can compare them. */
export async function readLiveSchema(query: QueryFn): Promise<SchemaSnapshot> {
  const columnRows = await query<{ table_name: string; column_name: string }>(LIVE_COLUMNS_SQL);
  const tables: Record<string, string[]> = {};
  for (const row of columnRows) (tables[row.table_name] ??= []).push(row.column_name);
  for (const name of Object.keys(tables)) tables[name].sort();

  const enumRows = await query<{ name: string; label: string }>(LIVE_ENUMS_SQL);
  const enums: Record<string, string[]> = {};
  for (const row of enumRows) (enums[row.name] ??= []).push(row.label);

  const indexRows = await query<{ indexname: string }>(LIVE_INDEXES_SQL);

  return { tables, enums, indexes: indexRows.map((r) => r.indexname).sort() };
}

/**
 * FK constraint names the live database actually has. Separate from
 * `readLiveSchema` so that function's return shape (pinned by
 * server/__tests__/dbBaseline.test.ts) stays exactly as it is.
 */
export async function readLiveForeignKeys(query: QueryFn): Promise<string[]> {
  const rows = await query<{ conname: string }>(LIVE_FKS_SQL);
  return rows.map((r) => r.conname).sort();
}

/** Rows drizzle has recorded, or [] when it has never run here. */
export async function readMigrationRows(query: QueryFn): Promise<MigrationRow[]> {
  const [probe] = await query<{ present: boolean }>(MIGRATIONS_TABLE_EXISTS_SQL, [
    MIGRATIONS_SCHEMA,
    MIGRATIONS_TABLE,
  ]);
  if (!probe?.present) return [];
  const rows = await query<{ hash: string; created_at: string | null }>(MIGRATION_ROWS_SQL);
  // created_at is bigint → the pg driver hands it back as a string.
  return rows.map((r) => ({ hash: r.hash, createdAt: Number(r.created_at ?? 0) }));
}

// ─── the decision ────────────────────────────────────────────────────────────

export interface MigrationRow {
  hash: string;
  createdAt: number;
}

export type BaselineAction =
  /** DB matches the baseline: insert the row, execute none of its SQL. */
  | "insert"
  /** drizzle already tracks this DB — nothing to do (idempotent re-run). */
  | "already-baselined"
  /** Empty/unknown DB: baselining would permanently skip creating the schema. */
  | "fresh-database"
  /** DB is behind the baseline: baselining would hide the missing objects. */
  | "drift"
  /** Migration rows exist that predate the baseline — needs a human. */
  | "unknown-history";

export interface BaselineDecision {
  action: BaselineAction;
  /** Only true for "insert". `--confirm` refuses to write anything otherwise. */
  safeToInsert: boolean;
  headline: string;
  blockers: string[];
  warnings: string[];
}

export function decideBaseline(input: {
  drift: SchemaDrift;
  /** Drift of the live DB against shared/schema.ts — only used for push warnings. */
  pushDrift?: SchemaDrift;
  /**
   * FK constraint names the baseline snapshot claims that the live database does
   * NOT have (snapshotForeignKeys ∖ readLiveForeignKeys). OPTIONAL: callers that
   * cannot read pg_constraint simply omit it, and nothing about the decision
   * changes. Non-empty is a BLOCKER, in the same class as a missing table — an
   * absent FK is an object the baseline claims to create that `migrate` will
   * never create, because baselining skips the baseline's SQL entirely.
   */
  missingForeignKeys?: string[];
  /**
   * Journal tags after the baseline whose objects the database ALREADY has —
   * `migrate` would re-run them and fail with "already exists". OPTIONAL;
   * non-empty is a BLOCKER. Also only supplied by scripts/db-baseline.ts.
   */
  satisfiedLaterMigrations?: string[];
  rows: MigrationRow[];
  baseline: BaselineMigration;
}): BaselineDecision {
  const { drift, pushDrift, rows, baseline } = input;
  const missingForeignKeys = input.missingForeignKeys ?? [];
  const satisfiedLaterMigrations = input.satisfiedLaterMigrations ?? [];

  const warnings: string[] = [];
  // On an empty database every index is "missing"; that is noise on top of the
  // fresh-database blocker, so only warn when there is a schema to compare to.
  if (drift.missingIndexes.length > 0 && drift.tablesPresent > 0) {
    warnings.push(
      `${drift.missingIndexes.length} index/unique constraint(s) declared by the baseline are ` +
        `absent from the database: ${drift.missingIndexes.join(", ")} — the baseline will be ` +
        `marked applied WITHOUT creating them, and \`db:migrate\` will never create them ` +
        `either. This does NOT block the baseline, so it is on you to act on it: add them by ` +
        `hand (their exact DDL is the CREATE INDEX / UNIQUE section of ` +
        `migrations/${baseline.tag}.sql). If \`drops_session_sequence_uniq\` is in that list, ` +
        `run \`npm run db:dedup-drops\` FIRST, then apply ` +
        `migrations/0001_dedup_drops_before_unique.sql by hand (see migrations/README.md, ` +
        `"Audit B3")`,
    );
  }
  const extraTables = pushDrift?.extraTables ?? drift.extraTables;
  const extraColumns = pushDrift?.extraColumns ?? drift.extraColumns;
  if (extraTables.length > 0) {
    warnings.push(
      `${extraTables.length} table(s) exist in the database but not in shared/schema.ts — ` +
        `\`drizzle-kit push\` would DROP them (silently, with no prompt at all, if they are ` +
        `empty — its data-loss prompt only fires on a table that CONTAINS ROWS): ` +
        `${extraTables.join(", ")}`,
    );
  }
  if (extraColumns.length > 0) {
    warnings.push(
      `${extraColumns.length} column(s) exist in the database but not in shared/schema.ts — ` +
        `\`drizzle-kit push\` would DROP them (silently, with no prompt at all, if the table ` +
        `is empty — its data-loss prompt only fires on a column that CONTAINS ROWS): ` +
        `${extraColumns.join(", ")}`,
    );
  }

  if (rows.length > 0) {
    const known = rows.some((r) => r.createdAt >= baseline.when);
    if (known) {
      const exact = rows.find((r) => r.createdAt === baseline.when);
      if (exact && exact.hash !== baseline.hash) {
        warnings.push(
          `the recorded baseline row's hash differs from ${baseline.tag}.sql on disk ` +
            `(recorded ${exact.hash.slice(0, 12)}…, file ${baseline.hash.slice(0, 12)}…). ` +
            `Harmless — the migrator compares created_at, not hash — but it means the ` +
            `committed baseline file changed after it was applied.`,
        );
      }
      return {
        action: "already-baselined",
        safeToInsert: false,
        headline: `already under migration control (${rows.length} row(s) in ${MIGRATIONS_TABLE_FQN}) — nothing to do`,
        blockers: [],
        warnings,
      };
    }
    return {
      action: "unknown-history",
      safeToInsert: false,
      headline: `${MIGRATIONS_TABLE_FQN} holds ${rows.length} row(s) that all predate the baseline`,
      blockers: [
        `every recorded created_at is older than the baseline's ${baseline.when} — this is not a ` +
          `plain pushed database. Inspect ${MIGRATIONS_TABLE_FQN} by hand before doing anything.`,
      ],
      warnings,
    };
  }

  if (drift.tablesPresent === 0) {
    return {
      action: "fresh-database",
      safeToInsert: false,
      headline: `this database has none of the ${drift.tablesExpected} application tables`,
      blockers: [
        `an empty/foreign database must NOT be baselined — that would mark the schema created ` +
          `when it is not. Run \`npm run db:migrate\` instead: it creates everything and records ` +
          `the migration itself.`,
      ],
      warnings,
    };
  }

  const blockers: string[] = [];
  if (drift.missingTables.length > 0) {
    blockers.push(`missing table(s): ${drift.missingTables.join(", ")}`);
  }
  if (drift.missingColumns.length > 0) {
    blockers.push(`missing column(s): ${drift.missingColumns.join(", ")}`);
  }
  if (drift.missingEnumValues.length > 0) {
    blockers.push(`missing enum value(s): ${drift.missingEnumValues.join(", ")}`);
  }
  if (missingForeignKeys.length > 0) {
    blockers.push(
      `missing FOREIGN KEY constraint(s): ${missingForeignKeys.join(", ")} — the baseline ` +
        `claims to create them, and baselining executes none of its SQL, so \`db:migrate\` ` +
        `never will either. Their exact DDL is the \`ALTER TABLE … ADD CONSTRAINT … FOREIGN ` +
        `KEY\` section at the bottom of migrations/${baseline.tag}.sql.`,
    );
  }
  if (satisfiedLaterMigrations.length > 0) {
    blockers.push(
      `this database already contains everything ${satisfiedLaterMigrations.join(", ")} ` +
        `create(s), but baselining records only ${baseline.tag}. The next \`db:migrate\` would ` +
        `re-run ${satisfiedLaterMigrations.length > 1 ? "those migrations" : "that migration"} ` +
        `against objects that already exist and fail with "already exists". Record them too, ` +
        `or hand-fix, before baselining.`,
    );
  }
  if (blockers.length > 0) {
    // "behind" is the usual case; a database that only trips the later-migration
    // blocker is AHEAD, and calling that "behind" sends the operator the wrong way.
    const behind =
      drift.missingTables.length > 0 ||
      drift.missingColumns.length > 0 ||
      drift.missingEnumValues.length > 0 ||
      missingForeignKeys.length > 0;
    return {
      action: "drift",
      safeToInsert: false,
      headline: behind
        ? `the database is BEHIND the baseline (${drift.tablesPresent}/${drift.tablesExpected} tables present)`
        : `the database is AHEAD of the baseline — it already has objects only ` +
          `${satisfiedLaterMigrations.join(", ")} create(s)`,
      blockers,
      warnings,
    };
  }

  // NOTE the wording. This check compares object NAMES (tables, columns,
  // index/unique-constraint names) plus enum labels plus FK constraint names —
  // NOT column types, NOT NULL, defaults, primary keys or check constraints. And
  // any warning above (a missing index, objects push would drop) is a real
  // difference, so the headline must not read as a clean bill of health when one
  // fired: that is what turns "read the Warnings block" into "skim the verdict".
  return {
    action: "insert",
    safeToInsert: true,
    headline:
      warnings.length > 0
        ? `every table/column/enum value/FK the baseline names is present ` +
          `(${drift.tablesPresent}/${drift.tablesExpected} tables) — recording ${baseline.tag} is ` +
          `safe, but ${warnings.length} warning(s) above describe real differences: READ THEM FIRST`
        : `database matches the baseline (${drift.tablesPresent}/${drift.tablesExpected} tables) — ` +
          `safe to record ${baseline.tag} as applied`,
    blockers: [],
    warnings,
  };
}
