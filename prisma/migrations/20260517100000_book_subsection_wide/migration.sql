-- v1.95.0: BookSubsection.wide — per-card column-span on the /book/[slug]
-- two-column grid. `false` (default) = single column; `true` = spans both
-- columns. Existing rows default to narrow so the layout doesn't shift on
-- migration.
ALTER TABLE "BookSubsection" ADD COLUMN "wide" BOOLEAN NOT NULL DEFAULT false;
