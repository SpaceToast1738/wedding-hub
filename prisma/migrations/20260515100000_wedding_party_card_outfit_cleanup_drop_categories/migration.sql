-- v1.92.0: course-correct on v1.91.0.
--
-- (1) Drop the v1.91.0 BookSubsection.category column + index. The
--     categorisation feature missed what the user actually wanted (a
--     grouped wedding-party tracker), so it's reverted entirely.
-- (2) Drop the v1.91.0 OUTFIT trackingMode toggle + per-item paidBy.
--     Replaced by a per-item `alreadyOwned` boolean. Finance for
--     OUTFIT items continues via the existing v1.78.0 BookOutfitCard
--     -> BudgetLine sync and v1.75.0 Payment.bookOutfitId per-item
--     link — no parallel "paid by" text needed on each item.
-- (3) Add the new WEDDING_PARTY card kind + four backing tables for
--     tracking bridesmaid / groomsman / flower-girl readiness as a
--     group (matrix layout — items as rows, people as columns).

-- (1) Drop subsection categorisation.
DROP INDEX IF EXISTS "BookSubsection_category_idx";
ALTER TABLE "BookSubsection" DROP COLUMN IF EXISTS "category";

-- (2) Drop trackingMode + per-item paidBy; add alreadyOwned.
ALTER TABLE "BookOutfitCard" DROP COLUMN IF EXISTS "trackingMode";
ALTER TABLE "BookOutfit" DROP COLUMN IF EXISTS "paidBy";
DROP TYPE IF EXISTS "OutfitTrackingMode";
ALTER TABLE "BookOutfit"
  ADD COLUMN "alreadyOwned" BOOLEAN NOT NULL DEFAULT false;

-- (3) WEDDING_PARTY card kind + tables. Cells are sparse (only
--     materialised when the user sets a status other than the
--     default NEED), so a 5x8 matrix with 3 set cells is 3 rows.
ALTER TYPE "BookSubsectionKind" ADD VALUE 'WEDDING_PARTY';

CREATE TABLE "BookWeddingPartyCard" (
  "id"           TEXT NOT NULL,
  "subsectionId" TEXT NOT NULL,
  "groupLabel"   TEXT,
  "notes"        TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookWeddingPartyCard_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BookWeddingPartyCard_subsectionId_key" ON "BookWeddingPartyCard"("subsectionId");
ALTER TABLE "BookWeddingPartyCard" ADD CONSTRAINT "BookWeddingPartyCard_subsectionId_fkey"
  FOREIGN KEY ("subsectionId") REFERENCES "BookSubsection"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BookWeddingPartyMember" (
  "id"     TEXT NOT NULL,
  "cardId" TEXT NOT NULL,
  "name"   TEXT NOT NULL,
  "role"   TEXT,
  "order"  INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "BookWeddingPartyMember_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BookWeddingPartyMember_cardId_idx" ON "BookWeddingPartyMember"("cardId");
ALTER TABLE "BookWeddingPartyMember" ADD CONSTRAINT "BookWeddingPartyMember_cardId_fkey"
  FOREIGN KEY ("cardId") REFERENCES "BookWeddingPartyCard"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BookWeddingPartyItem" (
  "id"     TEXT NOT NULL,
  "cardId" TEXT NOT NULL,
  "label"  TEXT NOT NULL,
  "notes"  TEXT,
  "order"  INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "BookWeddingPartyItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BookWeddingPartyItem_cardId_idx" ON "BookWeddingPartyItem"("cardId");
ALTER TABLE "BookWeddingPartyItem" ADD CONSTRAINT "BookWeddingPartyItem_cardId_fkey"
  FOREIGN KEY ("cardId") REFERENCES "BookWeddingPartyCard"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BookWeddingPartyCell" (
  "id"        TEXT NOT NULL,
  "memberId"  TEXT NOT NULL,
  "itemId"    TEXT NOT NULL,
  "status"    TEXT NOT NULL,
  "notes"     TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookWeddingPartyCell_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BookWeddingPartyCell_memberId_itemId_key" ON "BookWeddingPartyCell"("memberId", "itemId");
CREATE INDEX "BookWeddingPartyCell_memberId_idx" ON "BookWeddingPartyCell"("memberId");
CREATE INDEX "BookWeddingPartyCell_itemId_idx" ON "BookWeddingPartyCell"("itemId");
ALTER TABLE "BookWeddingPartyCell" ADD CONSTRAINT "BookWeddingPartyCell_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "BookWeddingPartyMember"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookWeddingPartyCell" ADD CONSTRAINT "BookWeddingPartyCell_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "BookWeddingPartyItem"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
