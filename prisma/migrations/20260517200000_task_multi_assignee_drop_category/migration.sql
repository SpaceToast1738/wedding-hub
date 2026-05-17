-- v1.96.0: Tasks switch from single Task.assigneeId → m2m Task ↔ User
-- ("assignees"). Couple can co-own a task without "primary owner"
-- forcing one of them off the chip. Existing `assigneeId` values
-- backfilled into the junction before the column drops.
--
-- v1.96.2 (in-place revision): made idempotent + orphan-safe after the
-- first attempt rolled back in prod. Two failure modes were possible:
--
--   1. Task.assigneeId had no DB-level FK on the User table (it was
--      declared as `String?` on the schema, never as a relation), so
--      historical rows could point at users that have since been
--      deleted. The backfill INSERT then violated `_TaskAssignees_B_fkey`
--      and aborted the whole transaction.
--   2. If the first attempt's CREATE TABLE succeeded but the INSERT
--      failed, the table exists empty — re-running the original
--      CREATE TABLE would fail with "relation already exists".
--
-- This rewrite handles both: DROP IF EXISTS clears any partial state,
-- the INSERT filters orphans via `WHERE EXISTS`, and ALTER … DROP
-- COLUMN IF EXISTS tolerates the column having already been dropped
-- by a previous partial run.
--
-- Recovery for the v1.96.0 failed apply: the operator runs
--   docker compose --env-file .env exec db psql -U "$POSTGRES_USER" "$POSTGRES_DB" \
--     -c "DELETE FROM \"_prisma_migrations\" WHERE migration_name = '20260517200000_task_multi_assignee_drop_category';"
-- against the running db container, then Pull & Up — this migration
-- (with the new idempotent SQL) re-applies cleanly.

-- Clean up any partial state from the v1.96.0 failed attempt before
-- recreating the table.
DROP TABLE IF EXISTS "_TaskAssignees";

CREATE TABLE "_TaskAssignees" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL,
  CONSTRAINT "_TaskAssignees_AB_unique" UNIQUE ("A", "B"),
  CONSTRAINT "_TaskAssignees_A_fkey" FOREIGN KEY ("A") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "_TaskAssignees_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "_TaskAssignees_B_index" ON "_TaskAssignees"("B");

-- Backfill: every existing assigneeId becomes one junction row, but
-- only when the target user actually exists. Orphans (Task.assigneeId
-- pointing at a deleted user) are silently dropped — those rows lose
-- their stale assignment, which is correct behaviour given the user
-- they referenced no longer exists. ON CONFLICT for idempotency.
INSERT INTO "_TaskAssignees" ("A", "B")
SELECT t."id", t."assigneeId"
FROM "Task" t
WHERE t."assigneeId" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "User" u WHERE u."id" = t."assigneeId")
ON CONFLICT DO NOTHING;

-- IF EXISTS: tolerates the column having been dropped already by a
-- prior partial run.
ALTER TABLE "Task" DROP COLUMN IF EXISTS "assigneeId";
