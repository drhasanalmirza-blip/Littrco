-- 0001_dedup_drops_before_unique.sql
-- Audit B3 remediation — must run BEFORE the drops_session_sequence_uniq
-- constraint (shared/schema.ts) is applied to any populated database.
--
-- Context: the constraint fixes a firmware-retry double-insert. On a DB that
-- already saw that bug, duplicate (session_id, sequence) rows exist and
-- CREATE UNIQUE INDEX would fail and block the deploy. This migration removes
-- the duplicates, recomputes the two session COUNTERS from the surviving rows,
-- then adds the constraint — atomically, in one transaction.
--
-- The finalize-derived AWARD reconciliation (batteries_estimated /
-- shop_points_awarded) and the compensating shop-point ADJUST ledger rows depend
-- on each session's reward rate (device override ?? shop cfg ?? default), so they
-- are handled by the rate-aware `npm run db:dedup-drops` script, which should be
-- run FIRST. This SQL is the committed, DBA-facing equivalent for the dedup +
-- counters + constraint (audit M-12: prefer committed migrations over bare
-- `drizzle-kit push` on populated prod DBs).
--
-- Pre-flight guard (must be run before this migration; if it returns rows on a
-- prod DB, run `npm run db:dedup-drops` first for the full award reconciliation):
--   SELECT session_id, sequence, COUNT(*)
--   FROM drops GROUP BY session_id, sequence HAVING COUNT(*) > 1;

BEGIN;

-- 1. Dedup: keep the earliest (MIN id) row per (session_id, sequence); the higher
--    ids are the firmware-retry duplicates.
DELETE FROM drops d
USING (
  SELECT session_id, sequence, MIN(id) AS keep_id
  FROM drops
  GROUP BY session_id, sequence
  HAVING COUNT(*) > 1
) g
WHERE d.session_id = g.session_id
  AND d.sequence   = g.sequence
  AND d.id <> g.keep_id;

-- 2. Recompute the session counters from the surviving rows (only where they now
--    disagree — cheap and safe on every session).
UPDATE drop_sessions s
SET detected_drop_count = c.detected,
    accepted_drop_count = c.accepted
FROM (
  SELECT session_id,
         COUNT(*)                         AS detected,
         COUNT(*) FILTER (WHERE accepted) AS accepted
  FROM drops
  GROUP BY session_id
) c
WHERE s.id = c.session_id
  AND (s.detected_drop_count <> c.detected OR s.accepted_drop_count <> c.accepted);

-- 3. Post-guard: fail the transaction if any duplicate group somehow survived,
--    so the constraint below is never reached on dirty data.
DO $$
DECLARE
  dupes int;
BEGIN
  SELECT COUNT(*) INTO dupes FROM (
    SELECT 1 FROM drops GROUP BY session_id, sequence HAVING COUNT(*) > 1
  ) x;
  IF dupes > 0 THEN
    RAISE EXCEPTION 'dedup incomplete: % duplicate (session_id, sequence) group(s) remain', dupes;
  END IF;
END $$;

-- 4. Now safe to enforce idempotency for all future firmware retries.
ALTER TABLE drops
  ADD CONSTRAINT drops_session_sequence_uniq UNIQUE (session_id, sequence);

COMMIT;
