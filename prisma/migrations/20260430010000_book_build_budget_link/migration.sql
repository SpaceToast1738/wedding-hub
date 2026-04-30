-- v1.31.1: link BookBuildCard to BudgetLine. Set by "Copy materials
-- total to Budget" so subsequent re-clicks update the existing line
-- instead of duplicating. Additive only — column nullable, FK with
-- SET NULL cascade so deleting a budget line just clears the link.

ALTER TABLE "BookBuildCard" ADD COLUMN "budgetLineId" TEXT;

ALTER TABLE "BookBuildCard"
    ADD CONSTRAINT "BookBuildCard_budgetLineId_fkey"
    FOREIGN KEY ("budgetLineId") REFERENCES "BudgetLine"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "BookBuildCard_budgetLineId_idx" ON "BookBuildCard"("budgetLineId");
