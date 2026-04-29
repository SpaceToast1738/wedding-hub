-- v1.30.0: optional Task → BookSubsection link. Nullable + ON DELETE
-- SET NULL so deleting a card doesn't cascade-delete the linked tasks
-- (mirrors the v1.28.0 supplier link pattern). Indexed because the
-- card-level "Linked tasks" panel will list tasks WHERE
-- bookSubsectionId = ?.

ALTER TABLE "Task" ADD COLUMN "bookSubsectionId" TEXT;

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_bookSubsectionId_fkey"
  FOREIGN KEY ("bookSubsectionId") REFERENCES "BookSubsection"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Task_bookSubsectionId_idx" ON "Task"("bookSubsectionId");
