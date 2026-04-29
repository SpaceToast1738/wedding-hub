-- v1.26.0: modular page cards.
--
-- Adds:
--   * BookSubsectionKind enum (TEXT, FIELD, RECIPE, SHOT_LIST, OUTFIT).
--   * BookSubsection.kind column (NOT NULL DEFAULT 'TEXT' so existing
--     rows behave identically).
--   * BookFieldDef table — FIELD card field defs.
--   * BookRecipe table — RECIPE card structured data (1:1).
--   * BookShotList + BookShot tables — SHOT_LIST card (1:1, 1:m).
--   * BookOutfitCard + BookOutfit tables — OUTFIT card (1:1, 1:m).
--
-- The legacy PhotographyShot table is left in place — a follow-up
-- release will migrate the data into BookShot rows under a single
-- SHOT_LIST card on the Photography section, then drop the legacy
-- table once verified.

-- ─── Discriminator ────────────────────────────────────────────────
CREATE TYPE "BookSubsectionKind" AS ENUM (
  'TEXT',
  'FIELD',
  'RECIPE',
  'SHOT_LIST',
  'OUTFIT'
);

ALTER TABLE "BookSubsection"
  ADD COLUMN "kind" "BookSubsectionKind" NOT NULL DEFAULT 'TEXT';

-- ─── FIELD card ───────────────────────────────────────────────────
CREATE TABLE "BookFieldDef" (
  "id"           TEXT NOT NULL,
  "subsectionId" TEXT NOT NULL,
  "label"        TEXT NOT NULL,
  "type"         TEXT NOT NULL,
  "options"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "order"        INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "BookFieldDef_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BookFieldDef"
  ADD CONSTRAINT "BookFieldDef_subsectionId_fkey"
    FOREIGN KEY ("subsectionId") REFERENCES "BookSubsection"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── RECIPE card ──────────────────────────────────────────────────
CREATE TABLE "BookRecipe" (
  "id"           TEXT NOT NULL,
  "subsectionId" TEXT NOT NULL,
  "ingredients"  JSONB NOT NULL,
  "steps"        JSONB NOT NULL,
  "notes"        TEXT,
  CONSTRAINT "BookRecipe_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookRecipe_subsectionId_key" ON "BookRecipe"("subsectionId");

ALTER TABLE "BookRecipe"
  ADD CONSTRAINT "BookRecipe_subsectionId_fkey"
    FOREIGN KEY ("subsectionId") REFERENCES "BookSubsection"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── SHOT_LIST card ───────────────────────────────────────────────
CREATE TABLE "BookShotList" (
  "id"           TEXT NOT NULL,
  "subsectionId" TEXT NOT NULL,
  CONSTRAINT "BookShotList_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookShotList_subsectionId_key" ON "BookShotList"("subsectionId");

ALTER TABLE "BookShotList"
  ADD CONSTRAINT "BookShotList_subsectionId_fkey"
    FOREIGN KEY ("subsectionId") REFERENCES "BookSubsection"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BookShot" (
  "id"         TEXT NOT NULL,
  "shotListId" TEXT NOT NULL,
  "title"      TEXT NOT NULL,
  "withWhom"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "location"   TEXT,
  "notes"      TEXT,
  "captured"   BOOLEAN NOT NULL DEFAULT false,
  "capturedAt" TIMESTAMP(3),
  "order"      INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "BookShot_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BookShot"
  ADD CONSTRAINT "BookShot_shotListId_fkey"
    FOREIGN KEY ("shotListId") REFERENCES "BookShotList"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── OUTFIT card ──────────────────────────────────────────────────
CREATE TABLE "BookOutfitCard" (
  "id"           TEXT NOT NULL,
  "subsectionId" TEXT NOT NULL,
  CONSTRAINT "BookOutfitCard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookOutfitCard_subsectionId_key" ON "BookOutfitCard"("subsectionId");

ALTER TABLE "BookOutfitCard"
  ADD CONSTRAINT "BookOutfitCard_subsectionId_fkey"
    FOREIGN KEY ("subsectionId") REFERENCES "BookSubsection"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BookOutfit" (
  "id"         TEXT NOT NULL,
  "cardId"     TEXT NOT NULL,
  "personName" TEXT NOT NULL,
  "role"       TEXT,
  "items"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "supplier"   TEXT,
  "status"     TEXT,
  "notes"      TEXT,
  "order"      INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "BookOutfit_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BookOutfit"
  ADD CONSTRAINT "BookOutfit_cardId_fkey"
    FOREIGN KEY ("cardId") REFERENCES "BookOutfitCard"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
