-- v1.61.0 (XL1): Task ↔ GuestGroup m2m. Closes the last open item
-- from the v1.52.1 review punch list — guest detail page surfacing
-- tasks linked via the guest's groups.
--
-- Same shape as the v1.51.0 Task ↔ BookSubsection m2m: implicit
-- Prisma relation, alphabetical naming → `_GuestGroupToTask` with
-- A = GuestGroup.id, B = Task.id. Additive only — no data movement.
-- Cascades on both sides so deleting the GuestGroup or the Task
-- cleans the row up automatically.

CREATE TABLE "_GuestGroupToTask" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_GuestGroupToTask_AB_pkey" PRIMARY KEY ("A","B")
);

CREATE INDEX "_GuestGroupToTask_B_index" ON "_GuestGroupToTask"("B");

ALTER TABLE "_GuestGroupToTask"
    ADD CONSTRAINT "_GuestGroupToTask_A_fkey"
    FOREIGN KEY ("A") REFERENCES "GuestGroup"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_GuestGroupToTask"
    ADD CONSTRAINT "_GuestGroupToTask_B_fkey"
    FOREIGN KEY ("B") REFERENCES "Task"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
