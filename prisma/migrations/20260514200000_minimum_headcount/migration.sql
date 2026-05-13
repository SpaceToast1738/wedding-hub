-- v1.81.0: minimum headcount on per-head budget rows. Vendors often
-- impose a floor ("min 80 covers regardless of RSVPs"). When set, the
-- effective multiplier becomes max(resolvedCount, minimumHeadcount).
-- Applies on BOTH BudgetLine (standalone per-head lines) and
-- BudgetLineComponent (sub-costs inside a composite line). Same rule
-- regardless of headcount source — including MANUAL, since some
-- vendors quote a minimum that floors any number you type.
ALTER TABLE "BudgetLine"          ADD COLUMN "minimumHeadcount" INTEGER;
ALTER TABLE "BudgetLineComponent" ADD COLUMN "minimumHeadcount" INTEGER;
