-- v1.31.0 (P1): BUILD card — DIY production tracker. One card per
-- project. Additive only.

-- 1. Discriminator enum value.
ALTER TYPE "BookSubsectionKind" ADD VALUE 'BUILD';

-- 2. BookBuildCard table — 1:1 with BookSubsection.
CREATE TABLE "BookBuildCard" (
    "id"                       TEXT NOT NULL,
    "subsectionId"             TEXT NOT NULL,
    "quantityNeeded"           INTEGER,
    "targetDate"               TIMESTAMP(3),
    "status"                   TEXT,
    "prototypeDone"            BOOLEAN NOT NULL DEFAULT false,
    "prototypeNotes"           TEXT,
    "estimatedMinutesPerUnit"  INTEGER,
    "notes"                    TEXT,
    CONSTRAINT "BookBuildCard_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BookBuildCard_subsectionId_key" ON "BookBuildCard"("subsectionId");
ALTER TABLE "BookBuildCard"
    ADD CONSTRAINT "BookBuildCard_subsectionId_fkey"
    FOREIGN KEY ("subsectionId") REFERENCES "BookSubsection"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. BookBuildMaterial table — line items per card.
CREATE TABLE "BookBuildMaterial" (
    "id"        TEXT NOT NULL,
    "cardId"    TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "quantity"  DOUBLE PRECISION,
    "unit"      TEXT,
    "supplier"  TEXT,
    "costPence" INTEGER,
    "ordered"   BOOLEAN NOT NULL DEFAULT false,
    "arrived"   BOOLEAN NOT NULL DEFAULT false,
    "notes"     TEXT,
    "order"     INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BookBuildMaterial_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BookBuildMaterial_cardId_idx" ON "BookBuildMaterial"("cardId");
ALTER TABLE "BookBuildMaterial"
    ADD CONSTRAINT "BookBuildMaterial_cardId_fkey"
    FOREIGN KEY ("cardId") REFERENCES "BookBuildCard"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. BookBuildSession table — production sessions logged per card.
CREATE TABLE "BookBuildSession" (
    "id"              TEXT NOT NULL,
    "cardId"          TEXT NOT NULL,
    "date"            TIMESTAMP(3) NOT NULL,
    "minutes"         INTEGER NOT NULL,
    "unitsCompleted"  INTEGER,
    "notes"           TEXT,
    "loggedById"      TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookBuildSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BookBuildSession_cardId_idx" ON "BookBuildSession"("cardId");
ALTER TABLE "BookBuildSession"
    ADD CONSTRAINT "BookBuildSession_cardId_fkey"
    FOREIGN KEY ("cardId") REFERENCES "BookBuildCard"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
