-- v1.30.5: replace v1.30.0's Task.bookSubsectionId 1:1 link with two
-- many-to-many junction tables (Task ↔ BookSection and Task ↔ NavTag).
-- Tasks can now carry multiple "topics" via a unified Topics multi-
-- select.

-- 1. NavTag table — small user-configurable list of nav-menu tags.
CREATE TABLE "NavTag" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "slug"      TEXT NOT NULL,
    "route"     TEXT,
    "order"     INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NavTag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NavTag_slug_key" ON "NavTag"("slug");

-- 2. Implicit-m2m junction tables. Column conventions taken from
--    `prisma migrate diff --from-empty --to-schema-datamodel`. A is
--    alphabetically-first model (BookSection / NavTag), B is Task.
CREATE TABLE "_BookSectionToTask" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);
CREATE UNIQUE INDEX "_BookSectionToTask_AB_unique" ON "_BookSectionToTask"("A", "B");
CREATE INDEX "_BookSectionToTask_B_index" ON "_BookSectionToTask"("B");
ALTER TABLE "_BookSectionToTask"
    ADD CONSTRAINT "_BookSectionToTask_A_fkey"
    FOREIGN KEY ("A") REFERENCES "BookSection"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_BookSectionToTask"
    ADD CONSTRAINT "_BookSectionToTask_B_fkey"
    FOREIGN KEY ("B") REFERENCES "Task"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "_NavTagToTask" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);
CREATE UNIQUE INDEX "_NavTagToTask_AB_unique" ON "_NavTagToTask"("A", "B");
CREATE INDEX "_NavTagToTask_B_index" ON "_NavTagToTask"("B");
ALTER TABLE "_NavTagToTask"
    ADD CONSTRAINT "_NavTagToTask_A_fkey"
    FOREIGN KEY ("A") REFERENCES "NavTag"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_NavTagToTask"
    ADD CONSTRAINT "_NavTagToTask_B_fkey"
    FOREIGN KEY ("B") REFERENCES "Task"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Backfill from v1.30.0's bookSubsectionId. Each task that pointed at
--    a subsection gets linked to that subsection's parent section.
INSERT INTO "_BookSectionToTask" ("A", "B")
SELECT DISTINCT bs."sectionId", t."id"
FROM "Task" t
JOIN "BookSubsection" bs ON bs."id" = t."bookSubsectionId"
WHERE t."bookSubsectionId" IS NOT NULL
ON CONFLICT DO NOTHING;

-- 4. Drop v1.30.0's column / FK / index on Task.
ALTER TABLE "Task" DROP CONSTRAINT "Task_bookSubsectionId_fkey";
DROP INDEX "Task_bookSubsectionId_idx";
ALTER TABLE "Task" DROP COLUMN "bookSubsectionId";
