-- v2.16.0: RUNSHEET card — time-ordered rows {time, event, owner,
-- notes, done} rendered as a schedule. Ceremony running order, morning
-- setup window, supplier arrivals, the day-of runsheet all want the
-- same kind. Additive only.

-- 1. Discriminator enum value.
ALTER TYPE "BookSubsectionKind" ADD VALUE 'RUNSHEET';

-- 2. BookRunsheetCard table — 1:1 with BookSubsection.
CREATE TABLE "BookRunsheetCard" (
    "id"            TEXT NOT NULL,
    "subsectionId"  TEXT NOT NULL,
    "notes"         TEXT,
    CONSTRAINT "BookRunsheetCard_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BookRunsheetCard_subsectionId_key" ON "BookRunsheetCard"("subsectionId");
ALTER TABLE "BookRunsheetCard"
    ADD CONSTRAINT "BookRunsheetCard_subsectionId_fkey"
    FOREIGN KEY ("subsectionId") REFERENCES "BookSubsection"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. BookRunsheetRow table — one schedule entry per row.
CREATE TABLE "BookRunsheetRow" (
    "id"      TEXT NOT NULL,
    "cardId"  TEXT NOT NULL,
    "time"    TEXT,
    "event"   TEXT NOT NULL,
    "owner"   TEXT,
    "notes"   TEXT,
    "done"    BOOLEAN NOT NULL DEFAULT false,
    "order"   INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BookRunsheetRow_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BookRunsheetRow_cardId_idx" ON "BookRunsheetRow"("cardId");
ALTER TABLE "BookRunsheetRow"
    ADD CONSTRAINT "BookRunsheetRow_cardId_fkey"
    FOREIGN KEY ("cardId") REFERENCES "BookRunsheetCard"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
