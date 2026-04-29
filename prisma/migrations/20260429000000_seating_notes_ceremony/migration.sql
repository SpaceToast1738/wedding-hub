-- v1.23.0: seating notes + ceremony placeholder
--
-- Adds:
--   * Table.notes (free-form per-table notes — game plan, dietary, position cues)
--   * Table.checklist (Json — day-of items per table: place cards, menu cards, …)
--   * WeddingSettings.seatingNotes (plan-level notes — table-size policy, board-game allocation, etc.)
--   * CeremonySeating (singleton — left/right rows + seats-per-row + notes)
--
-- All additive; existing rows untouched.

ALTER TABLE "Table"
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "checklist" JSONB;

ALTER TABLE "WeddingSettings"
  ADD COLUMN "seatingNotes" TEXT;

CREATE TABLE "CeremonySeating" (
  "id"             INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
  "leftRows"       INTEGER NOT NULL DEFAULT 8,
  "leftSeatsRow"   INTEGER NOT NULL DEFAULT 8,
  "rightRows"      INTEGER NOT NULL DEFAULT 8,
  "rightSeatsRow"  INTEGER NOT NULL DEFAULT 8,
  "notes"          TEXT,
  "updatedAt"      TIMESTAMP(3) NOT NULL
);
