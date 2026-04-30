-- v1.32.0 (P2): MENU + BAR card kinds. Additive only.

-- 1. Discriminator enum values. Postgres requires ALTER TYPE ADD
--    VALUE in separate statements when the new value is referenced
--    later in the same migration; safe because the new enum values
--    aren't USED in the DDL below (only column types).
ALTER TYPE "BookSubsectionKind" ADD VALUE 'MENU';
ALTER TYPE "BookSubsectionKind" ADD VALUE 'BAR';

-- 2. MENU card.
CREATE TABLE "BookMenuCard" (
    "id"                  TEXT NOT NULL,
    "subsectionId"        TEXT NOT NULL,
    "serviceType"         TEXT,
    "serviceTime"         TEXT,
    "pricePerHeadPence"   INTEGER,
    "confirmedHeadcount"  INTEGER,
    "notes"               TEXT,
    CONSTRAINT "BookMenuCard_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BookMenuCard_subsectionId_key" ON "BookMenuCard"("subsectionId");
ALTER TABLE "BookMenuCard"
    ADD CONSTRAINT "BookMenuCard_subsectionId_fkey"
    FOREIGN KEY ("subsectionId") REFERENCES "BookSubsection"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BookMenuCourse" (
    "id"          TEXT NOT NULL,
    "cardId"      TEXT NOT NULL,
    "courseLabel" TEXT NOT NULL,
    "order"       INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BookMenuCourse_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BookMenuCourse_cardId_idx" ON "BookMenuCourse"("cardId");
ALTER TABLE "BookMenuCourse"
    ADD CONSTRAINT "BookMenuCourse_cardId_fkey"
    FOREIGN KEY ("cardId") REFERENCES "BookMenuCard"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BookMenuOption" (
    "id"               TEXT NOT NULL,
    "courseId"         TEXT NOT NULL,
    "label"            TEXT NOT NULL,
    "description"      TEXT,
    "dietary"          TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "isVegetarianMain" BOOLEAN NOT NULL DEFAULT false,
    "isKidsMeal"       BOOLEAN NOT NULL DEFAULT false,
    "order"            INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BookMenuOption_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BookMenuOption_courseId_idx" ON "BookMenuOption"("courseId");
ALTER TABLE "BookMenuOption"
    ADD CONSTRAINT "BookMenuOption_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "BookMenuCourse"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. BAR card.
CREATE TABLE "BookBarCard" (
    "id"            TEXT NOT NULL,
    "subsectionId"  TEXT NOT NULL,
    "barType"       TEXT,
    "tabLimitPence" INTEGER,
    "toastDrink"    TEXT,
    "corkagePence"  INTEGER,
    "notes"         TEXT,
    CONSTRAINT "BookBarCard_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BookBarCard_subsectionId_key" ON "BookBarCard"("subsectionId");
ALTER TABLE "BookBarCard"
    ADD CONSTRAINT "BookBarCard_subsectionId_fkey"
    FOREIGN KEY ("subsectionId") REFERENCES "BookSubsection"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BookBarItem" (
    "id"              TEXT NOT NULL,
    "cardId"          TEXT NOT NULL,
    "category"        TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "quantityPlanned" DOUBLE PRECISION,
    "unit"            TEXT,
    "supplier"        TEXT,
    "costPence"       INTEGER,
    "notes"           TEXT,
    "order"           INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BookBarItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BookBarItem_cardId_idx" ON "BookBarItem"("cardId");
ALTER TABLE "BookBarItem"
    ADD CONSTRAINT "BookBarItem_cardId_fkey"
    FOREIGN KEY ("cardId") REFERENCES "BookBarCard"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
