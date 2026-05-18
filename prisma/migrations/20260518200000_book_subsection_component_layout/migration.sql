-- v1.99.0: per-card body layout. componentOrder = explicit display
-- order of component IDs; empty = "use this kind's hard-coded default
-- order". hiddenComponents = component IDs to suppress entirely.
-- Both arrays default to empty so v1.98.x rows render identically.
ALTER TABLE "BookSubsection" ADD COLUMN "componentOrder"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "BookSubsection" ADD COLUMN "hiddenComponents"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
