import "dotenv/config"; // load .env for local dev (no-op when vars already set, e.g. Replit)
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Timeouts are NOT optional here. node-postgres defaults connectionTimeoutMillis
// to 0 = "wait forever", so if the database is unreachable, asleep (Neon/Replit
// free tiers suspend), or the pool is saturated, an `await db...` never settles.
// Combined with Express 4 not forwarding async-handler rejections, that presents
// to the user as a button that spins forever with no error — which is exactly
// how the "Generate pair code" hang manifested. Fail fast and loudly instead.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5_000,   // give up acquiring a connection
  query_timeout: 15_000,            // give up on a slow/stuck query
  idleTimeoutMillis: 30_000,
  max: 10,
});

// An idle client erroring (server restart, network drop) emits on the POOL. With
// no listener, node treats it as an unhandled 'error' event and CRASHES.
pool.on("error", (err) => {
  console.error("[pg] idle client error:", err);
});

export const db = drizzle(pool, { schema });
