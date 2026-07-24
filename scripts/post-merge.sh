#!/bin/bash
set -e

echo "[post-merge] Installing dependencies..."
npm install --no-audit --no-fund

# The schema is deliberately NOT touched here any more.
#
# This hook used to run `npm run db:push -- --force`. `--force` is drizzle-kit's
# "apply everything without asking" mode: it skips drizzle's own "THIS ACTION
# WILL CAUSE DATA LOSS AND CANNOT BE REVERTED" prompt and executes DROP TABLE /
# DROP COLUMN / TRUNCATE unattended (node_modules/drizzle-kit/bin.cjs, pgPush:
# `if (!force && shouldAskForApprove)`). On a populated production database that
# is an automatic, invisible way to lose data on a merge.
#
# Schema changes are committed migrations now, applied deliberately by a human:
#   npm run db:baseline   # ONCE, on the database `push` originally created
#   npm run db:migrate    # every deploy after that
# See RUNBOOK.md §1 and migrations/README.md.
echo "[post-merge] Schema NOT applied — db:push --force removed (it was destructive)."
echo "[post-merge] Apply schema changes yourself:  npm run db:migrate"
echo "[post-merge]   (first time on this database: npm run db:baseline)"

echo "[post-merge] Done."
