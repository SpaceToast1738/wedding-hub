-- v1.46.0: CeremonyRow — per-row group assignments for the ceremony
-- seating canvas. Maps (side, rowIndex) → GuestGroup so the canvas
-- can tint each row with the group's colour. Additive only.

CREATE TABLE "CeremonyRow" (
    "id" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "guestGroupId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CeremonyRow_pkey" PRIMARY KEY ("id")
);

-- One assignment per (side, rowIndex). Server action upserts against
-- this constraint; deletes the row when the couple clears the
-- assignment (no row = no colour tint).
CREATE UNIQUE INDEX "CeremonyRow_side_rowIndex_key"
    ON "CeremonyRow"("side", "rowIndex");

-- Lookup index for "all rows assigned to this group" — useful for
-- the legend ("Spencer extended family — 3 rows on left").
CREATE INDEX "CeremonyRow_guestGroupId_idx"
    ON "CeremonyRow"("guestGroupId");

-- FK with SetNull so deleting a GuestGroup clears the row assignment
-- rather than cascading the delete (we never want to lose the row
-- itself; the canvas just falls back to the neutral fill).
ALTER TABLE "CeremonyRow"
    ADD CONSTRAINT "CeremonyRow_guestGroupId_fkey"
    FOREIGN KEY ("guestGroupId") REFERENCES "GuestGroup"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
