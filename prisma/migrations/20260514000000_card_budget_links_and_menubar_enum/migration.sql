-- v1.78.0: close the financial loop. Each Wedding Book card kind that
-- carries a cost (MENU, BAR, OUTFIT, STAY) gains a budgetLineId FK so
-- card saves auto-resync the linked BudgetLine. Mirrors v1.31.1's
-- BookBuildCard pattern. SetNull on delete — orphaned card retains a
-- null FK gracefully.
ALTER TABLE "BookMenuCard"   ADD COLUMN "budgetLineId" TEXT;
ALTER TABLE "BookBarCard"    ADD COLUMN "budgetLineId" TEXT;
ALTER TABLE "BookOutfitCard" ADD COLUMN "budgetLineId" TEXT;
ALTER TABLE "BookStayCard"   ADD COLUMN "budgetLineId" TEXT;

ALTER TABLE "BookMenuCard"
  ADD CONSTRAINT "BookMenuCard_budgetLineId_fkey"
  FOREIGN KEY ("budgetLineId") REFERENCES "BudgetLine"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookBarCard"
  ADD CONSTRAINT "BookBarCard_budgetLineId_fkey"
  FOREIGN KEY ("budgetLineId") REFERENCES "BudgetLine"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookOutfitCard"
  ADD CONSTRAINT "BookOutfitCard_budgetLineId_fkey"
  FOREIGN KEY ("budgetLineId") REFERENCES "BudgetLine"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookStayCard"
  ADD CONSTRAINT "BookStayCard_budgetLineId_fkey"
  FOREIGN KEY ("budgetLineId") REFERENCES "BudgetLine"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "BookMenuCard_budgetLineId_idx"   ON "BookMenuCard"("budgetLineId");
CREATE INDEX "BookBarCard_budgetLineId_idx"    ON "BookBarCard"("budgetLineId");
CREATE INDEX "BookOutfitCard_budgetLineId_idx" ON "BookOutfitCard"("budgetLineId");
CREATE INDEX "BookStayCard_budgetLineId_idx"   ON "BookStayCard"("budgetLineId");

-- v1.78.0: MENU adopts the unified PerHeadSource enum from v1.77.0.
-- confirmedHeadcount kept one release as a recovery buffer (drop in
-- v1.79). Backfill: rows with explicit confirmedHeadcount → MANUAL
-- with that value carried; null rows that have a per-head price →
-- ALL_CONFIRMED (matches today's fallback to attending-count).
ALTER TABLE "BookMenuCard" ADD COLUMN "headcountSource" "PerHeadSource";
ALTER TABLE "BookMenuCard" ADD COLUMN "manualHeadcount" INTEGER;
UPDATE "BookMenuCard"
   SET "headcountSource" = 'MANUAL',
       "manualHeadcount" = "confirmedHeadcount"
 WHERE "confirmedHeadcount" IS NOT NULL;
UPDATE "BookMenuCard"
   SET "headcountSource" = 'ALL_CONFIRMED'
 WHERE "confirmedHeadcount" IS NULL
   AND "pricePerHeadPence" IS NOT NULL;

-- v1.78.0: BAR per-item adopts the enum. ADULTS_CONFIRMED matches
-- the existing hardcoded source (page query computes
-- `confirmedAdults = count(attending && !isChild)`).
ALTER TABLE "BookBarItem" ADD COLUMN "headcountSource" "PerHeadSource";
UPDATE "BookBarItem"
   SET "headcountSource" = 'ADULTS_CONFIRMED'
 WHERE "pricePerHeadPence" IS NOT NULL;
