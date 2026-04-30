-- v1.33.0 (P3): SETUP card — per-space spatial walkthrough. One
-- card per physical space (Ceremony room / Reception room / etc.).
-- Additive only.

-- 1. Discriminator enum value.
ALTER TYPE "BookSubsectionKind" ADD VALUE 'SETUP';

-- 2. BookSetupCard table — 1:1 with BookSubsection.
CREATE TABLE "BookSetupCard" (
    "id"            TEXT NOT NULL,
    "subsectionId"  TEXT NOT NULL,
    "space"         TEXT,
    "setupStartsAt" TEXT,
    "setupOwner"    TEXT,
    "notes"         TEXT,
    CONSTRAINT "BookSetupCard_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BookSetupCard_subsectionId_key" ON "BookSetupCard"("subsectionId");
ALTER TABLE "BookSetupCard"
    ADD CONSTRAINT "BookSetupCard_subsectionId_fkey"
    FOREIGN KEY ("subsectionId") REFERENCES "BookSubsection"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. BookSetupItem table — line items per card.
CREATE TABLE "BookSetupItem" (
    "id"           TEXT NOT NULL,
    "cardId"       TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "quantity"     INTEGER,
    "location"     TEXT,
    "source"       TEXT,
    "packed"       BOOLEAN NOT NULL DEFAULT false,
    "placed"       BOOLEAN NOT NULL DEFAULT false,
    "packDownPlan" TEXT,
    "notes"        TEXT,
    "order"        INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BookSetupItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BookSetupItem_cardId_idx" ON "BookSetupItem"("cardId");
ALTER TABLE "BookSetupItem"
    ADD CONSTRAINT "BookSetupItem_cardId_fkey"
    FOREIGN KEY ("cardId") REFERENCES "BookSetupCard"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
