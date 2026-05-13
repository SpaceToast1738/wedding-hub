-- v1.80.0: BudgetLineComponent — sub-cost rows on a single BudgetLine.
-- A composite line (e.g. "Venue") holds three components: "Meals"
-- (per-head £25), "Toast drinks" (per-head £2.50), "Wedding arch"
-- (flat £150). The line's effective estimated becomes the sum of its
-- components' effective values. Cascade-deletes with the parent line.

CREATE TABLE "BudgetLineComponent" (
  "id" TEXT NOT NULL,
  "lineId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "flatPence" INTEGER,
  "perHeadPence" INTEGER,
  "headcountSource" "PerHeadSource",
  "manualHeadcount" INTEGER,
  "order" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BudgetLineComponent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BudgetLineComponent_lineId_fkey"
    FOREIGN KEY ("lineId") REFERENCES "BudgetLine"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "BudgetLineComponent_lineId_idx" ON "BudgetLineComponent"("lineId");

-- v1.80.0: Payment can target a specific component (DIY-style
-- "I paid for the foam, not the whole BUILD card"). Optional —
-- lump-sum payments still link to the parent line as before.
ALTER TABLE "Payment" ADD COLUMN "budgetLineComponentId" TEXT;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_budgetLineComponentId_fkey"
  FOREIGN KEY ("budgetLineComponentId") REFERENCES "BudgetLineComponent"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Payment_budgetLineComponentId_idx" ON "Payment"("budgetLineComponentId");

-- v1.80.0: Wedding Book cards can target a component (in addition
-- to the v1.78.0 line-level FK). When the component FK is set it
-- wins; otherwise fall through to the line-level link.
ALTER TABLE "BookMenuCard"   ADD COLUMN "budgetLineComponentId" TEXT;
ALTER TABLE "BookBarCard"    ADD COLUMN "budgetLineComponentId" TEXT;
ALTER TABLE "BookOutfitCard" ADD COLUMN "budgetLineComponentId" TEXT;
ALTER TABLE "BookStayCard"   ADD COLUMN "budgetLineComponentId" TEXT;
ALTER TABLE "BookBuildCard"  ADD COLUMN "budgetLineComponentId" TEXT;

ALTER TABLE "BookMenuCard"   ADD CONSTRAINT "BookMenuCard_budgetLineComponentId_fkey"
  FOREIGN KEY ("budgetLineComponentId") REFERENCES "BudgetLineComponent"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookBarCard"    ADD CONSTRAINT "BookBarCard_budgetLineComponentId_fkey"
  FOREIGN KEY ("budgetLineComponentId") REFERENCES "BudgetLineComponent"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookOutfitCard" ADD CONSTRAINT "BookOutfitCard_budgetLineComponentId_fkey"
  FOREIGN KEY ("budgetLineComponentId") REFERENCES "BudgetLineComponent"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookStayCard"   ADD CONSTRAINT "BookStayCard_budgetLineComponentId_fkey"
  FOREIGN KEY ("budgetLineComponentId") REFERENCES "BudgetLineComponent"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookBuildCard"  ADD CONSTRAINT "BookBuildCard_budgetLineComponentId_fkey"
  FOREIGN KEY ("budgetLineComponentId") REFERENCES "BudgetLineComponent"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "BookMenuCard_budgetLineComponentId_idx"   ON "BookMenuCard"("budgetLineComponentId");
CREATE INDEX "BookBarCard_budgetLineComponentId_idx"    ON "BookBarCard"("budgetLineComponentId");
CREATE INDEX "BookOutfitCard_budgetLineComponentId_idx" ON "BookOutfitCard"("budgetLineComponentId");
CREATE INDEX "BookStayCard_budgetLineComponentId_idx"   ON "BookStayCard"("budgetLineComponentId");
CREATE INDEX "BookBuildCard_budgetLineComponentId_idx"  ON "BookBuildCard"("budgetLineComponentId");
