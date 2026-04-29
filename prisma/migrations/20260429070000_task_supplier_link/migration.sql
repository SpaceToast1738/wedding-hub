-- v1.28.0: optional Task → Supplier link. Nullable + ON DELETE SET NULL
-- so a deleted supplier doesn't cascade-delete linked tasks. Indexed
-- because the supplier-detail page will list tasks WHERE supplierId = ?.

ALTER TABLE "Task" ADD COLUMN "supplierId" TEXT;

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Task_supplierId_idx" ON "Task"("supplierId");
