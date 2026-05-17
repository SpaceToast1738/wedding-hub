-- v1.91.0: three coordinated additions in one migration.
--
-- 1. DRESS_CODE card kind — couple-internal reference for the dress
--    code + colour/footwear/weather guidance the couple gives guests
--    who ask. Lives on /book like every other card kind. No public
--    surface yet (deferred to a future release).
-- 2. OUTFIT card flexibility — `trackingMode` (FULL | LIGHT) lets the
--    couple collapse the bridesmaid / groomsman editor to just
--    "items + status + who's paying" while keeping their own (Bryony
--    / Jamie) cards on the full fitting / alterations / pickup
--    tracker. `BookOutfit.paidBy` is a per-item override of the
--    card-level `paidBy` (so a bridesmaid card can carry "Dress:
--    Aimee" alongside "Bouquet: Couple").
-- 3. `BookSubsection.category` — free-text grouping label so the
--    section page renders cards under category headers (Bride /
--    Bridesmaids / Groomsmen / etc.). Sections themselves are the
--    coarsest grouping; this adds finer in-section grouping without
--    requiring a parent-subsection hierarchy.

-- (1) DRESS_CODE kind + per-kind row.
ALTER TYPE "BookSubsectionKind" ADD VALUE 'DRESS_CODE';

CREATE TABLE "BookDressCodeCard" (
  "id"             TEXT NOT NULL,
  "subsectionId"   TEXT NOT NULL,
  "dressCode"      TEXT,
  "summary"        TEXT,
  "bodyHtml"       TEXT,
  "colourGuidance" TEXT,
  "footwear"       TEXT,
  "weather"        TEXT,
  "accessories"    TEXT,
  "fileIds"        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookDressCodeCard_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BookDressCodeCard_subsectionId_key" ON "BookDressCodeCard"("subsectionId");
ALTER TABLE "BookDressCodeCard" ADD CONSTRAINT "BookDressCodeCard_subsectionId_fkey"
  FOREIGN KEY ("subsectionId") REFERENCES "BookSubsection"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- (2) OUTFIT flexibility.
CREATE TYPE "OutfitTrackingMode" AS ENUM ('FULL', 'LIGHT');
ALTER TABLE "BookOutfitCard"
  ADD COLUMN "trackingMode" "OutfitTrackingMode" NOT NULL DEFAULT 'FULL';
ALTER TABLE "BookOutfit" ADD COLUMN "paidBy" TEXT;

-- (3) Subsection categorisation.
ALTER TABLE "BookSubsection" ADD COLUMN "category" TEXT;
CREATE INDEX "BookSubsection_category_idx" ON "BookSubsection"("category");
