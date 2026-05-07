-- v1.77.0: variable / per-head budget lines. A line can now carry a
-- price-per-head + headcount source, and `estimated` becomes a
-- derived value (perHeadPence × computed-count) at render time.
-- Source enum covers the obvious RSVP slices + a manual escape hatch.
-- Additive — existing flat-estimated lines keep working unchanged.

CREATE TYPE "PerHeadSource" AS ENUM (
  'ALL_INVITED',
  'CONFIRMED_PLUS_PENDING',
  'ALL_CONFIRMED',
  'ADULTS_CONFIRMED',
  'CHILDREN_CONFIRMED',
  'MANUAL'
);

ALTER TABLE "BudgetLine" ADD COLUMN "perHeadPence" INTEGER;
ALTER TABLE "BudgetLine" ADD COLUMN "headcountSource" "PerHeadSource";
ALTER TABLE "BudgetLine" ADD COLUMN "manualHeadcount" INTEGER;
