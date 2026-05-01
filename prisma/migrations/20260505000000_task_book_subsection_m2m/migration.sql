-- v1.51.0: parallel Task ↔ BookSubsection m2m alongside the existing
-- Task ↔ BookSection m2m. Drives the inline tasks panel on each
-- card on /book/[slug]. Additive only — no data movement; existing
-- bookSections links continue to work unchanged.
--
-- Implicit Prisma m2m → table name is `_BookSubsectionToTask` with
-- A = BookSubsection.id, B = Task.id, primary key on the pair.

CREATE TABLE "_BookSubsectionToTask" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BookSubsectionToTask_AB_pkey" PRIMARY KEY ("A","B")
);

CREATE INDEX "_BookSubsectionToTask_B_index" ON "_BookSubsectionToTask"("B");

ALTER TABLE "_BookSubsectionToTask"
    ADD CONSTRAINT "_BookSubsectionToTask_A_fkey"
    FOREIGN KEY ("A") REFERENCES "BookSubsection"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_BookSubsectionToTask"
    ADD CONSTRAINT "_BookSubsectionToTask_B_fkey"
    FOREIGN KEY ("B") REFERENCES "Task"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
