-- v1.86.0: funding-source enum + nullable columns on the three money
-- entities (BudgetLine, BudgetLineComponent, Payment). All additive;
-- existing rows are NULL ("unassigned") and the UI treats NULL as a
-- fifth bucket alongside the four explicit funds. No backfill needed.
--
-- `fundSource` is the enum bucket; `fundLabel` is an optional free-text
-- annotation that's most useful when fundSource = 'OTHER' (e.g.
-- "Bryony's parents", "Aunt Lisa's gift") but can also be set on the
-- other three for a per-row note ("Joint — Monzo joint pot").
--
-- Indices are narrow B-trees on the enum column only — the filter
-- queries on /budget + /payments scan by fund within a category set
-- so the enum-only index is the right shape.

CREATE TYPE "FundSource" AS ENUM ('JOINT', 'PERSONAL_BRIDE', 'PERSONAL_GROOM', 'OTHER');

ALTER TABLE "BudgetLine"          ADD COLUMN "fundSource" "FundSource";
ALTER TABLE "BudgetLine"          ADD COLUMN "fundLabel"  TEXT;
ALTER TABLE "BudgetLineComponent" ADD COLUMN "fundSource" "FundSource";
ALTER TABLE "BudgetLineComponent" ADD COLUMN "fundLabel"  TEXT;
ALTER TABLE "Payment"             ADD COLUMN "fundSource" "FundSource";
ALTER TABLE "Payment"             ADD COLUMN "fundLabel"  TEXT;

CREATE INDEX "BudgetLine_fundSource_idx"          ON "BudgetLine"("fundSource");
CREATE INDEX "BudgetLineComponent_fundSource_idx" ON "BudgetLineComponent"("fundSource");
CREATE INDEX "Payment_fundSource_idx"             ON "Payment"("fundSource");
