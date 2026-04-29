-- v1.23.1: global seating checklist on the WeddingSettings singleton.
-- Replaces the v1.23.0 per-table Table.checklist UX — user wanted one
-- shared day-of list for the whole plan, not one per table.
--
-- Table.notes + Table.checklist columns are kept (no data drop) so any
-- planner who already populated them can still pull their text via raw
-- SQL if needed. UI for those mounts is removed in this release.

ALTER TABLE "WeddingSettings"
  ADD COLUMN "seatingChecklist" JSONB;
