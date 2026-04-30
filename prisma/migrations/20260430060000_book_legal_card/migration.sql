-- v1.34.0 (P4): LEGAL card — document checklist with optional
-- per-item deadlines + file attachments. One card per coherent
-- deadline group (Notice of Marriage / Marriage cert / Name change
-- checklist / etc.). Additive only.

-- 1. Discriminator enum value.
ALTER TYPE "BookSubsectionKind" ADD VALUE 'LEGAL';

-- 2. BookLegalCard table — 1:1 with BookSubsection.
CREATE TABLE "BookLegalCard" (
    "id"               TEXT NOT NULL,
    "subsectionId"     TEXT NOT NULL,
    "regulator"        TEXT,
    "regulatorContact" TEXT,
    "dueByDate"        TIMESTAMP(3),
    "notes"            TEXT,
    CONSTRAINT "BookLegalCard_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BookLegalCard_subsectionId_key" ON "BookLegalCard"("subsectionId");
ALTER TABLE "BookLegalCard"
    ADD CONSTRAINT "BookLegalCard_subsectionId_fkey"
    FOREIGN KEY ("subsectionId") REFERENCES "BookSubsection"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. BookLegalItem table — line items per card.
CREATE TABLE "BookLegalItem" (
    "id"          TEXT NOT NULL,
    "cardId"      TEXT NOT NULL,
    "label"       TEXT NOT NULL,
    "requiredFor" TEXT,
    "obtained"    BOOLEAN NOT NULL DEFAULT false,
    "obtainedAt"  TIMESTAMP(3),
    "expiresAt"   TIMESTAMP(3),
    "fileId"      TEXT,
    "notes"       TEXT,
    "order"       INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BookLegalItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BookLegalItem_cardId_idx" ON "BookLegalItem"("cardId");
CREATE INDEX "BookLegalItem_fileId_idx" ON "BookLegalItem"("fileId");
ALTER TABLE "BookLegalItem"
    ADD CONSTRAINT "BookLegalItem_cardId_fkey"
    FOREIGN KEY ("cardId") REFERENCES "BookLegalCard"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookLegalItem"
    ADD CONSTRAINT "BookLegalItem_fileId_fkey"
    FOREIGN KEY ("fileId") REFERENCES "File"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
