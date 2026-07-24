import "dotenv/config"; // load .env so `npm run db:push` finds DATABASE_URL in local dev
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  // ── push-only safety. Both keys are read ONLY by `drizzle-kit push`
  // (pgPush(schemaPath, verbose, strict, ...) in node_modules/drizzle-kit/bin.cjs);
  // `drizzle-kit migrate` parses the config with `migrateConfig`, which accepts
  // only { dialect, out, migrations }, so neither key affects db:migrate.
  //
  // WHY: push's "THIS ACTION WILL CAUSE DATA LOSS" prompt is gated on row count.
  // In pgSuggestions, both `drop_table` and `alter_table_drop_column` only set
  // shouldAskForApprove `if (count > 0)` — so an EMPTY table or column that is
  // in the database but not in shared/schema.ts is dropped with
  // `DROP TABLE ... CASCADE` and NO prompt whatsoever. Dropped indexes, unique
  // constraints and views have no branch there at all, so they are silent
  // regardless of row count.
  //
  //   verbose -> print every statement before running any of them.
  //   strict  -> always ask for confirmation, even when nothing is "data loss".
  //              (pgPush only shows this when shouldAskForApprove is false; when
  //              there IS a data-loss statement you get the data-loss prompt
  //              instead, never neither.)
  verbose: true,
  strict: true,
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
