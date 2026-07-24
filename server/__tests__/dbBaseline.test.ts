import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { readMigrationFiles } from "drizzle-orm/migrator";
import {
  CREATE_MIGRATIONS_TABLE_SQL,
  LIVE_COLUMNS_SQL,
  LIVE_ENUMS_SQL,
  LIVE_INDEXES_SQL,
  MIGRATIONS_SCHEMA,
  MIGRATIONS_TABLE,
  MIGRATIONS_TABLE_EXISTS_SQL,
  MIGRATION_ROWS_SQL,
  decideBaseline,
  diffSchema,
  expectedSchema,
  latestSnapshotPath,
  migrationHash,
  readBaselineMigration,
  readJournal,
  readLiveSchema,
  readMigrationRows,
  snapshotPathForTag,
  snapshotSchema,
  type BaselineMigration,
  type QueryFn,
  type SchemaDrift,
} from "../dbBaseline";

/** Canned Postgres, keyed by the SQL each reader issues. */
function stubQuery(responses: Record<string, unknown[]>): { query: QueryFn; seen: string[] } {
  const seen: string[] = [];
  const query: QueryFn = async <T>(sql: string) => {
    seen.push(sql);
    return (responses[sql] ?? []) as T[];
  };
  return { query, seen };
}

const MIGRATIONS_FOLDER = path.resolve(import.meta.dirname, "..", "..", "migrations");

// ── The load-bearing claim: our idea of "which migration, which hash, which
// watermark" is IDENTICAL to what the installed drizzle computes. If drizzle
// ever changes the journal format or the hash input, this fails loudly instead
// of silently writing a bookkeeping row that means nothing.
describe("baseline identity matches drizzle-orm's own readMigrationFiles", () => {
  const journal = readJournal(MIGRATIONS_FOLDER);
  const drizzleMigrations = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER });

  it("reads the same set of migrations as drizzle (journal-driven, not file-driven)", () => {
    expect(drizzleMigrations.length).toBe(journal.entries.length);
    // The hand-written DBA file is deliberately NOT a journal entry, so drizzle
    // never executes it — assert that stays true.
    expect(fs.existsSync(path.join(MIGRATIONS_FOLDER, "0001_dedup_drops_before_unique.sql"))).toBe(true);
    expect(journal.entries.some((e) => e.tag === "0001_dedup_drops_before_unique")).toBe(false);
  });

  it("computes the same sha256 hash drizzle stores", () => {
    for (const entry of journal.entries) {
      const ours = migrationHash(MIGRATIONS_FOLDER, entry.tag);
      const theirs = drizzleMigrations[entry.idx].hash;
      expect(ours).toBe(theirs);
    }
  });

  it("uses the same created_at watermark drizzle compares against", () => {
    const baseline = readBaselineMigration(MIGRATIONS_FOLDER);
    expect(baseline.when).toBe(drizzleMigrations[0].folderMillis);
    expect(baseline.hash).toBe(drizzleMigrations[0].hash);
    // Recorded created_at == folderMillis means migrate's `<` test is false for
    // the baseline (skipped) and true for everything generated after it.
    expect(drizzleMigrations[0].folderMillis < baseline.when).toBe(false);
  });

  it("targets drizzle's default migrations table", () => {
    expect(MIGRATIONS_SCHEMA).toBe("drizzle");
    expect(MIGRATIONS_TABLE).toBe("__drizzle_migrations");
    expect(CREATE_MIGRATIONS_TABLE_SQL).toContain(`"drizzle"."__drizzle_migrations"`);
    expect(CREATE_MIGRATIONS_TABLE_SQL).toContain("hash text NOT NULL");
    expect(CREATE_MIGRATIONS_TABLE_SQL).toContain("created_at bigint");
  });
});

// ── The migrations must never go stale: if shared/schema.ts changes and nobody
// runs `npx drizzle-kit generate`, prod (which only runs db:migrate) silently
// misses the change. This is the guard.
describe("committed migrations cover shared/schema.ts", () => {
  it("the newest snapshot matches the TypeScript schema exactly", () => {
    const drift = diffSchema(expectedSchema(), snapshotSchema(latestSnapshotPath(MIGRATIONS_FOLDER)));
    expect({
      missingTables: drift.missingTables,
      missingColumns: drift.missingColumns,
      missingEnumValues: drift.missingEnumValues,
      missingIndexes: drift.missingIndexes,
      extraTables: drift.extraTables,
      extraColumns: drift.extraColumns,
    }).toEqual({
      missingTables: [],
      missingColumns: [],
      missingEnumValues: [],
      missingIndexes: [],
      extraTables: [],
      extraColumns: [],
    });
  });

  it("the baseline snapshot describes every table the baseline SQL creates", () => {
    const baseline = readBaselineMigration(MIGRATIONS_FOLDER);
    const sql = fs.readFileSync(path.join(MIGRATIONS_FOLDER, `${baseline.tag}.sql`), "utf8");
    const created = [...sql.matchAll(/CREATE TABLE "([^"]+)"/g)].map((m) => m[1]).sort();
    const snapshot = snapshotSchema(snapshotPathForTag(MIGRATIONS_FOLDER, 0));
    expect(created).toEqual(Object.keys(snapshot.tables).sort());
    // Still guards the B3 pre-condition: the unique constraint is in the baseline.
    expect(sql).toContain("drops_session_sequence_uniq");
  });
});

describe("diffSchema", () => {
  const expected = {
    tables: { drops: ["id", "sequence"], devices: ["id", "temp_raw_c"] },
    enums: { ledger_type: ["EARNED", "ADJUST"] },
    indexes: ["drops_session_sequence_uniq"],
  };

  it("clean when the database matches", () => {
    const drift = diffSchema(expected, expected);
    expect(drift.missingTables).toEqual([]);
    expect(drift.missingColumns).toEqual([]);
    expect(drift.missingEnumValues).toEqual([]);
    expect(drift.missingIndexes).toEqual([]);
    expect(drift.extraTables).toEqual([]);
    expect(drift.extraColumns).toEqual([]);
    expect(drift.tablesPresent).toBe(2);
    expect(drift.tablesExpected).toBe(2);
  });

  it("reports what the database is missing", () => {
    const drift = diffSchema(expected, {
      tables: { drops: ["id", "sequence"] },
      enums: { ledger_type: ["EARNED"] },
      indexes: [],
    });
    expect(drift.missingTables).toEqual(["devices"]);
    expect(drift.missingEnumValues).toEqual(["ledger_type:ADJUST"]);
    expect(drift.missingIndexes).toEqual(["drops_session_sequence_uniq"]);
    expect(drift.tablesPresent).toBe(1);
  });

  it("reports what only the database has (what push would DROP)", () => {
    const drift = diffSchema(expected, {
      tables: {
        drops: ["id", "sequence"],
        devices: ["id", "temp_raw_c"],
        bin_requests: ["id"],
      },
      enums: { ledger_type: ["EARNED", "ADJUST", "LEGACY"] },
      indexes: ["drops_session_sequence_uniq"],
    });
    expect(drift.extraTables).toEqual(["bin_requests"]);
    expect(drift.missingTables).toEqual([]);
  });

  it("reports a missing column on a present table", () => {
    const drift = diffSchema(expected, {
      tables: { drops: ["id", "sequence"], devices: ["id"] },
      enums: { ledger_type: ["EARNED", "ADJUST"] },
      indexes: ["drops_session_sequence_uniq"],
    });
    expect(drift.missingColumns).toEqual(["devices.temp_raw_c"]);
  });
});

describe("reading the live database", () => {
  it("shapes rows into the same structure a snapshot has", async () => {
    const { query } = stubQuery({
      [LIVE_COLUMNS_SQL]: [
        { table_name: "drops", column_name: "sequence" },
        { table_name: "drops", column_name: "id" },
        { table_name: "devices", column_name: "id" },
      ],
      [LIVE_ENUMS_SQL]: [
        { name: "ledger_type", label: "EARNED" },
        { name: "ledger_type", label: "ADJUST" },
      ],
      [LIVE_INDEXES_SQL]: [{ indexname: "drops_session_sequence_uniq" }],
    });
    expect(await readLiveSchema(query)).toEqual({
      tables: { drops: ["id", "sequence"], devices: ["id"] },
      enums: { ledger_type: ["EARNED", "ADJUST"] },
      indexes: ["drops_session_sequence_uniq"],
    });
  });

  it("an empty database yields an empty snapshot (→ fresh-database, never a baseline)", async () => {
    const { query } = stubQuery({});
    const live = await readLiveSchema(query);
    expect(live).toEqual({ tables: {}, enums: {}, indexes: [] });
    const drift = diffSchema(expectedSchema(), live);
    expect(drift.tablesPresent).toBe(0);
    expect(
      decideBaseline({
        drift,
        rows: [],
        baseline: { tag: "0000_baseline", when: 1000, hash: "abc" },
      }).action,
    ).toBe("fresh-database");
  });

  it("does not query the migrations table before checking that it exists", async () => {
    const { query, seen } = stubQuery({ [MIGRATIONS_TABLE_EXISTS_SQL]: [{ present: false }] });
    expect(await readMigrationRows(query)).toEqual([]);
    expect(seen).toEqual([MIGRATIONS_TABLE_EXISTS_SQL]);
  });

  it("reads bigint created_at back as a number (the pg driver returns a string)", async () => {
    const { query } = stubQuery({
      [MIGRATIONS_TABLE_EXISTS_SQL]: [{ present: true }],
      [MIGRATION_ROWS_SQL]: [{ hash: "abc", created_at: "1784928250033" }],
    });
    expect(await readMigrationRows(query)).toEqual([{ hash: "abc", createdAt: 1784928250033 }]);
  });

  it("probes the schema/table drizzle actually uses", () => {
    expect(MIGRATION_ROWS_SQL).toContain(`"drizzle"."__drizzle_migrations"`);
    expect(MIGRATIONS_TABLE_EXISTS_SQL).toContain("$1");
    expect(MIGRATIONS_TABLE_EXISTS_SQL).toContain("$2");
  });
});

describe("decideBaseline", () => {
  const baseline: BaselineMigration = { tag: "0000_baseline", when: 1000, hash: "abc" };
  const clean: SchemaDrift = {
    missingTables: [],
    missingColumns: [],
    missingEnumValues: [],
    missingIndexes: [],
    extraTables: [],
    extraColumns: [],
    tablesExpected: 33,
    tablesPresent: 33,
  };

  it("records the baseline when the pushed database matches it", () => {
    const d = decideBaseline({ drift: clean, rows: [], baseline });
    expect(d.action).toBe("insert");
    expect(d.safeToInsert).toBe(true);
    expect(d.blockers).toEqual([]);
  });

  it("REFUSES on an empty database (migrate must create the schema instead)", () => {
    const d = decideBaseline({
      drift: { ...clean, tablesPresent: 0, missingTables: ["devices"] },
      rows: [],
      baseline,
    });
    expect(d.action).toBe("fresh-database");
    expect(d.safeToInsert).toBe(false);
  });

  it("REFUSES when the database is behind the baseline (a missing table)", () => {
    const d = decideBaseline({
      drift: { ...clean, tablesPresent: 32, missingTables: ["device_logs"] },
      rows: [],
      baseline,
    });
    expect(d.action).toBe("drift");
    expect(d.safeToInsert).toBe(false);
    expect(d.blockers.join(" ")).toContain("device_logs");
  });

  it("REFUSES when the database is behind by a single column or enum value", () => {
    expect(
      decideBaseline({
        drift: { ...clean, missingColumns: ["devices.temp_raw_c"] },
        rows: [],
        baseline,
      }).action,
    ).toBe("drift");
    expect(
      decideBaseline({
        drift: { ...clean, missingEnumValues: ["device_log_level:DEBUG"] },
        rows: [],
        baseline,
      }).action,
    ).toBe("drift");
  });

  it("is idempotent: a second run writes nothing", () => {
    const d = decideBaseline({
      drift: clean,
      rows: [{ hash: "abc", createdAt: 1000 }],
      baseline,
    });
    expect(d.action).toBe("already-baselined");
    expect(d.safeToInsert).toBe(false);
  });

  it("stays a no-op once later migrations have been applied", () => {
    const d = decideBaseline({
      drift: clean,
      rows: [
        { hash: "abc", createdAt: 1000 },
        { hash: "def", createdAt: 2000 },
      ],
      baseline,
    });
    expect(d.action).toBe("already-baselined");
    expect(d.safeToInsert).toBe(false);
  });

  it("refuses on an unrecognised migration history rather than guessing", () => {
    const d = decideBaseline({
      drift: clean,
      rows: [{ hash: "old", createdAt: 1 }],
      baseline,
    });
    expect(d.action).toBe("unknown-history");
    expect(d.safeToInsert).toBe(false);
  });

  it("warns (without blocking) about objects only the database has — push would DROP them", () => {
    const d = decideBaseline({
      drift: clean,
      pushDrift: { ...clean, extraTables: ["bin_requests"], extraColumns: ["devices.legacy_flag"] },
      rows: [],
      baseline,
    });
    expect(d.action).toBe("insert");
    expect(d.warnings.join(" ")).toContain("bin_requests");
    expect(d.warnings.join(" ")).toContain("devices.legacy_flag");
  });

  it("warns about indexes the baseline claims but the database lacks", () => {
    const d = decideBaseline({
      drift: { ...clean, missingIndexes: ["drops_session_sequence_uniq"] },
      rows: [],
      baseline,
    });
    expect(d.action).toBe("insert");
    expect(d.warnings.join(" ")).toContain("drops_session_sequence_uniq");
  });

  it("flags a baseline file that changed after it was applied", () => {
    const d = decideBaseline({
      drift: clean,
      rows: [{ hash: "different", createdAt: 1000 }],
      baseline,
    });
    expect(d.action).toBe("already-baselined");
    expect(d.warnings.join(" ")).toContain("hash differs");
  });
});
