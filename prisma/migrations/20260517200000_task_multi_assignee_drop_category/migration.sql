-- v1.96.0: Tasks switch from single Task.assigneeId → m2m Task ↔ User
-- ("assignees"). Couple can co-own a task without "primary owner"
-- forcing one of them off the chip. Existing `assigneeId` values
-- backfilled into the junction before the column drops.
--
-- Junction naming follows Prisma's implicit-m2m convention so the
-- schema can use `assignees User[]` / `assignedTasks Task[]` and
-- Prisma manages the table automatically: `_TaskAssignees("A","B")`
-- with A = Task.id, B = User.id.

CREATE TABLE "_TaskAssignees" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL,
  CONSTRAINT "_TaskAssignees_AB_unique" UNIQUE ("A", "B"),
  CONSTRAINT "_TaskAssignees_A_fkey" FOREIGN KEY ("A") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "_TaskAssignees_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "_TaskAssignees_B_index" ON "_TaskAssignees"("B");

-- Backfill: every existing assigneeId becomes one junction row.
-- The unique constraint protects against duplicate runs (idempotent).
INSERT INTO "_TaskAssignees" ("A", "B")
SELECT "id", "assigneeId" FROM "Task" WHERE "assigneeId" IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE "Task" DROP COLUMN "assigneeId";
