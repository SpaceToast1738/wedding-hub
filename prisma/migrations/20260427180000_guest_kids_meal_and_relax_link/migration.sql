-- AlterTable: add the children's-meal indicator (Q8 in the Say I Do export)
ALTER TABLE "Guest" ADD COLUMN "childrenMeal" BOOLEAN NOT NULL DEFAULT false;

-- DropIndex: rsvpUniqueLink is shared across guests within a household when
-- it comes from Say I Do (per-party links), so the @unique constraint must
-- go. The column itself stays — just the unique enforcement is dropped.
DROP INDEX "Guest_rsvpUniqueLink_key";
