-- v1.36.0 (P6): STAY + LODGING_GUIDE card kinds for the Accommodation
-- section rebuild. Purely additive — two enum values + three tables +
-- FKs. No data migration; existing accommodation subsections (if any)
-- stay TEXT/FIELD until the couple converts them.

-- 1. Add the two new card-kind values. Postgres requires each
--    ADD VALUE in its own statement.
ALTER TYPE "BookSubsectionKind" ADD VALUE 'STAY';
ALTER TYPE "BookSubsectionKind" ADD VALUE 'LODGING_GUIDE';

-- 2. STAY card — one row per accommodation booking.
CREATE TABLE "BookStayCard" (
    "id"               TEXT NOT NULL,
    "subsectionId"     TEXT NOT NULL,
    "propertyName"     TEXT,
    "propertyContact"  TEXT,
    "bookingReference" TEXT,
    "checkInDate"      TIMESTAMP(3),
    "checkOutDate"     TIMESTAMP(3),
    "costPence"        INTEGER,
    "paidBy"           TEXT,
    "paid"             BOOLEAN NOT NULL DEFAULT false,
    "occupants"        TEXT[] DEFAULT ARRAY[]::TEXT[],
    "guestIds"         TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes"            TEXT,

    CONSTRAINT "BookStayCard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookStayCard_subsectionId_key" ON "BookStayCard"("subsectionId");

ALTER TABLE "BookStayCard"
    ADD CONSTRAINT "BookStayCard_subsectionId_fkey"
    FOREIGN KEY ("subsectionId") REFERENCES "BookSubsection"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. LODGING_GUIDE card — single card with rows for recommended hotels.
CREATE TABLE "BookLodgingCard" (
    "id"           TEXT NOT NULL,
    "subsectionId" TEXT NOT NULL,
    "notes"        TEXT,

    CONSTRAINT "BookLodgingCard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookLodgingCard_subsectionId_key" ON "BookLodgingCard"("subsectionId");

ALTER TABLE "BookLodgingCard"
    ADD CONSTRAINT "BookLodgingCard_subsectionId_fkey"
    FOREIGN KEY ("subsectionId") REFERENCES "BookSubsection"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. LODGING_GUIDE rows. Reference data, not tracked-state — no
--    obtained/expired/etc. boolean columns.
CREATE TABLE "BookLodgingItem" (
    "id"                TEXT NOT NULL,
    "cardId"            TEXT NOT NULL,
    "name"              TEXT NOT NULL,
    "distanceFromVenue" TEXT,
    "priceRangeLabel"   TEXT,
    "phone"             TEXT,
    "website"           TEXT,
    "groupRateCode"     TEXT,
    "notes"             TEXT,
    "order"             INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BookLodgingItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BookLodgingItem_cardId_idx" ON "BookLodgingItem"("cardId");

ALTER TABLE "BookLodgingItem"
    ADD CONSTRAINT "BookLodgingItem_cardId_fkey"
    FOREIGN KEY ("cardId") REFERENCES "BookLodgingCard"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
